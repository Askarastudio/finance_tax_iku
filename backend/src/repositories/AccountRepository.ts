import { eq, and, isNull, sql, desc, asc } from 'drizzle-orm';
import { db } from '../db/connection';
import { accounts, AccountType, validateAccountCode, getAccountTypeFromCode, validateAccountHierarchy } from '../db/schema/accounts';
import { journalEntries } from '../db/schema/transactions';

export interface CreateAccountData {
  code: string;
  name: string;
  type: AccountType;
  parentId?: string;
  description?: string;
}

export interface UpdateAccountData {
  name?: string;
  description?: string;
  parentId?: string;
}

export interface AccountWithBalance {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  parentId: string | null;
  isActive: boolean;
  balance: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  calculatedBalance: string;
}

export interface AccountHierarchy {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  balance: string;
  children: AccountHierarchy[];
}

export class AccountRepository {
  /**
   * Create a new account with validation
   */
  async create(data: CreateAccountData): Promise<AccountWithBalance> {
    // Validate account code format
    if (!validateAccountCode(data.code)) {
      throw new Error(`Invalid account code format: ${data.code}. Must follow Indonesian standard (1xxx-5xxx)`);
    }

    // Validate account type matches code
    const expectedType = getAccountTypeFromCode(data.code);
    if (expectedType !== data.type) {
      throw new Error(`Account type ${data.type} does not match code ${data.code}. Expected: ${expectedType}`);
    }

    // Check if account code already exists
    const existingAccount = await this.findByCode(data.code);
    if (existingAccount) {
      throw new Error(`Account code ${data.code} already exists`);
    }

    // Validate parent-child hierarchy if parent is specified
    if (data.parentId) {
      const parent = await this.findById(data.parentId);
      if (!parent) {
        throw new Error(`Parent account with ID ${data.parentId} not found`);
      }

      if (!validateAccountHierarchy(parent.code, data.code)) {
        throw new Error(`Invalid hierarchy: child code ${data.code} must start with parent code ${parent.code}`);
      }

      // Ensure parent and child have same account type
      if (parent.type !== data.type) {
        throw new Error(`Child account type ${data.type} must match parent type ${parent.type}`);
      }
    }

    const [newAccount] = await db.insert(accounts).values({
      code: data.code,
      name: data.name,
      type: data.type,
      parentId: data.parentId || null,
      description: data.description || null,
      updatedAt: new Date()
    }).returning();

    return this.calculateBalance(newAccount);
  }

  /**
   * Find account by ID
   */
  async findById(id: string): Promise<AccountWithBalance | null> {
    const [account] = await db.select().from(accounts).where(eq(accounts.id, id));
    if (!account) return null;
    return this.calculateBalance(account);
  }

  /**
   * Find account by code
   */
  async findByCode(code: string): Promise<AccountWithBalance | null> {
    const [account] = await db.select().from(accounts).where(eq(accounts.code, code));
    if (!account) return null;
    return this.calculateBalance(account);
  }

  /**
   * Get all accounts with optional filtering
   */
  async findAll(filters?: {
    type?: AccountType;
    isActive?: boolean;
    parentId?: string | null;
  }): Promise<AccountWithBalance[]> {
    let query = db.select().from(accounts);

    if (filters) {
      const conditions = [];
      
      if (filters.type) {
        conditions.push(eq(accounts.type, filters.type));
      }
      
      if (filters.isActive !== undefined) {
        conditions.push(eq(accounts.isActive, filters.isActive));
      }
      
      if (filters.parentId !== undefined) {
        if (filters.parentId === null) {
          conditions.push(isNull(accounts.parentId));
        } else {
          conditions.push(eq(accounts.parentId, filters.parentId));
        }
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
    }

    const accountList = await query.orderBy(asc(accounts.code));
    return Promise.all(accountList.map(account => this.calculateBalance(account)));
  }

  /**
   * Update account with validation
   */
  async update(id: string, data: UpdateAccountData): Promise<AccountWithBalance> {
    const existingAccount = await this.findById(id);
    if (!existingAccount) {
      throw new Error(`Account with ID ${id} not found`);
    }

    // Validate parent-child hierarchy if parent is being changed
    if (data.parentId !== undefined) {
      if (data.parentId) {
        const parent = await this.findById(data.parentId);
        if (!parent) {
          throw new Error(`Parent account with ID ${data.parentId} not found`);
        }

        if (!validateAccountHierarchy(parent.code, existingAccount.code)) {
          throw new Error(`Invalid hierarchy: child code ${existingAccount.code} must start with parent code ${parent.code}`);
        }

        // Ensure parent and child have same account type
        if (parent.type !== existingAccount.type) {
          throw new Error(`Child account type ${existingAccount.type} must match parent type ${parent.type}`);
        }
      }
    }

    const [updatedAccount] = await db.update(accounts)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(accounts.id, id))
      .returning();

    return this.calculateBalance(updatedAccount);
  }

  /**
   * Deactivate account (soft delete) with transaction validation
   */
  async deactivate(id: string): Promise<AccountWithBalance> {
    const account = await this.findById(id);
    if (!account) {
      throw new Error(`Account with ID ${id} not found`);
    }

    // Check if account has transactions
    const hasTransactions = await this.hasTransactions(id);
    if (hasTransactions) {
      // Deactivate instead of delete
      const [deactivatedAccount] = await db.update(accounts)
        .set({
          isActive: false,
          updatedAt: new Date()
        })
        .where(eq(accounts.id, id))
        .returning();

      return this.calculateBalance(deactivatedAccount);
    } else {
      throw new Error(`Account ${account.code} cannot be deactivated. Use delete for accounts without transactions.`);
    }
  }

  /**
   * Delete account (only if no transactions exist)
   */
  async delete(id: string): Promise<void> {
    const account = await this.findById(id);
    if (!account) {
      throw new Error(`Account with ID ${id} not found`);
    }

    // Prevent deletion if account has transactions
    const hasTransactions = await this.hasTransactions(id);
    if (hasTransactions) {
      throw new Error(`Cannot delete account ${account.code} because it has associated transactions. Use deactivate instead.`);
    }

    // Check if account has child accounts
    const children = await this.findAll({ parentId: id });
    if (children.length > 0) {
      throw new Error(`Cannot delete account ${account.code} because it has child accounts`);
    }

    await db.delete(accounts).where(eq(accounts.id, id));
  }

  /**
   * Get account hierarchy tree
   */
  async getHierarchy(rootAccountType?: AccountType): Promise<AccountHierarchy[]> {
    let rootAccounts: AccountWithBalance[];
    
    if (rootAccountType) {
      rootAccounts = await this.findAll({ 
        type: rootAccountType, 
        parentId: null,
        isActive: true 
      });
    } else {
      rootAccounts = await this.findAll({ 
        parentId: null,
        isActive: true 
      });
    }

    const buildHierarchy = async (account: AccountWithBalance): Promise<AccountHierarchy> => {
      const children = await this.findAll({ parentId: account.id, isActive: true });
      const childHierarchies = await Promise.all(children.map(buildHierarchy));

      return {
        id: account.id,
        code: account.code,
        name: account.name,
        type: account.type,
        balance: account.calculatedBalance,
        children: childHierarchies
      };
    };

    return Promise.all(rootAccounts.map(buildHierarchy));
  }

  /**
   * Calculate real-time account balance from journal entries
   */
  private async calculateBalance(account: any): Promise<AccountWithBalance> {
    // Calculate balance from journal entries
    const balanceResult = await db
      .select({
        totalDebits: sql<string>`COALESCE(SUM(${journalEntries.debitAmount}), 0)`,
        totalCredits: sql<string>`COALESCE(SUM(${journalEntries.creditAmount}), 0)`
      })
      .from(journalEntries)
      .where(eq(journalEntries.accountId, account.id));

    const { totalDebits, totalCredits } = balanceResult[0];
    
    // Calculate balance based on account type
    // Assets and Expenses: Debit increases balance
    // Liabilities, Equity, Revenue: Credit increases balance
    let calculatedBalance: number;
    const debits = parseFloat(totalDebits);
    const credits = parseFloat(totalCredits);

    if (account.type === 'ASSET' || account.type === 'EXPENSE') {
      calculatedBalance = debits - credits;
    } else {
      calculatedBalance = credits - debits;
    }

    return {
      ...account,
      calculatedBalance: calculatedBalance.toFixed(2)
    };
  }

  /**
   * Check if account has associated transactions
   */
  private async hasTransactions(accountId: string): Promise<boolean> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(journalEntries)
      .where(eq(journalEntries.accountId, accountId));

    return result.count > 0;
  }

  /**
   * Get accounts by type with balances
   */
  async getAccountsByType(type: AccountType): Promise<AccountWithBalance[]> {
    return this.findAll({ type, isActive: true });
  }

  /**
   * Search accounts by name or code
   */
  async search(query: string): Promise<AccountWithBalance[]> {
    const searchPattern = `%${query}%`;
    const accountList = await db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.isActive, true),
          sql`(${accounts.name} ILIKE ${searchPattern} OR ${accounts.code} ILIKE ${searchPattern})`
        )
      )
      .orderBy(asc(accounts.code));

    return Promise.all(accountList.map(account => this.calculateBalance(account)));
  }
}