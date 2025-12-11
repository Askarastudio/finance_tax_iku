import { eq, and, desc, asc, sql, gte, lte, between } from 'drizzle-orm';
import { db } from '../db/connection';
import { transactions, journalEntries, generateTransactionReference, validateDoubleEntry, calculateTransactionTotal } from '../db/schema/transactions';
import { accounts } from '../db/schema/accounts';

export interface CreateTransactionData {
  date: Date;
  description: string;
  entries: CreateJournalEntryData[];
  createdBy: string;
}

export interface CreateJournalEntryData {
  accountId: string;
  debitAmount: string;
  creditAmount: string;
  description?: string;
}

export interface TransactionWithEntries {
  id: string;
  referenceNumber: string;
  date: Date;
  description: string;
  totalAmount: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  entries: JournalEntryWithAccount[];
}

export interface JournalEntryWithAccount {
  id: string;
  transactionId: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  debitAmount: string;
  creditAmount: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TransactionFilter {
  dateFrom?: Date;
  dateTo?: Date;
  accountId?: string;
  createdBy?: string;
  referenceNumber?: string;
}

export class TransactionRepository {
  /**
   * Create a new transaction with journal entries and double-entry validation
   */
  async create(data: CreateTransactionData): Promise<TransactionWithEntries> {
    // Validate double-entry bookkeeping rules
    if (!validateDoubleEntry(data.entries)) {
      throw new Error('Transaction violates double-entry bookkeeping: total debits must equal total credits');
    }

    // Validate that all referenced accounts exist
    await this.validateAccountReferences(data.entries);

    // Calculate total transaction amount
    const totalAmount = calculateTransactionTotal(data.entries);

    // Generate unique reference number
    const referenceNumber = await this.generateUniqueReference();

    // Start transaction to ensure atomicity
    return await db.transaction(async (tx) => {
      // Create the transaction record
      const [newTransaction] = await tx.insert(transactions).values({
        referenceNumber,
        date: data.date,
        description: data.description,
        totalAmount: totalAmount.toFixed(2),
        createdBy: data.createdBy,
        updatedAt: new Date()
      }).returning();

      // Create journal entries
      const journalEntryPromises = data.entries.map(entry => 
        tx.insert(journalEntries).values({
          transactionId: newTransaction.id,
          accountId: entry.accountId,
          debitAmount: entry.debitAmount,
          creditAmount: entry.creditAmount,
          description: entry.description || null,
          updatedAt: new Date()
        }).returning()
      );

      await Promise.all(journalEntryPromises);

      // Update account balances in real-time
      await this.updateAccountBalances(tx, data.entries);

      // Return the complete transaction with entries
      return this.findById(newTransaction.id);
    });
  }

  /**
   * Find transaction by ID with all journal entries
   */
  async findById(id: string): Promise<TransactionWithEntries | null> {
    const transaction = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, id))
      .limit(1);

    if (transaction.length === 0) return null;

    const entries = await db
      .select({
        id: journalEntries.id,
        transactionId: journalEntries.transactionId,
        accountId: journalEntries.accountId,
        accountCode: accounts.code,
        accountName: accounts.name,
        debitAmount: journalEntries.debitAmount,
        creditAmount: journalEntries.creditAmount,
        description: journalEntries.description,
        createdAt: journalEntries.createdAt,
        updatedAt: journalEntries.updatedAt
      })
      .from(journalEntries)
      .innerJoin(accounts, eq(journalEntries.accountId, accounts.id))
      .where(eq(journalEntries.transactionId, id))
      .orderBy(asc(journalEntries.createdAt));

    return {
      ...transaction[0],
      entries
    };
  }

  /**
   * Find transaction by reference number
   */
  async findByReference(referenceNumber: string): Promise<TransactionWithEntries | null> {
    const transaction = await db
      .select()
      .from(transactions)
      .where(eq(transactions.referenceNumber, referenceNumber))
      .limit(1);

    if (transaction.length === 0) return null;

    return this.findById(transaction[0].id);
  }

  /**
   * Get all transactions with optional filtering
   */
  async findAll(filters?: TransactionFilter, limit?: number, offset?: number): Promise<TransactionWithEntries[]> {
    let query = db.select().from(transactions);

    // Apply filters
    if (filters) {
      const conditions = [];

      if (filters.dateFrom) {
        conditions.push(gte(transactions.date, filters.dateFrom));
      }

      if (filters.dateTo) {
        conditions.push(lte(transactions.date, filters.dateTo));
      }

      if (filters.createdBy) {
        conditions.push(eq(transactions.createdBy, filters.createdBy));
      }

      if (filters.referenceNumber) {
        conditions.push(eq(transactions.referenceNumber, filters.referenceNumber));
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
    }

    // Apply ordering, limit, and offset
    query = query.orderBy(desc(transactions.date), desc(transactions.createdAt));

    if (limit) {
      query = query.limit(limit);
    }

    if (offset) {
      query = query.offset(offset);
    }

    const transactionList = await query;

    // Load entries for each transaction
    const transactionsWithEntries = await Promise.all(
      transactionList.map(async (transaction) => {
        const fullTransaction = await this.findById(transaction.id);
        return fullTransaction!;
      })
    );

    return transactionsWithEntries;
  }

  /**
   * Get transactions for a specific account
   */
  async findByAccount(accountId: string, limit?: number, offset?: number): Promise<TransactionWithEntries[]> {
    // Get transaction IDs that have entries for this account
    const transactionIds = await db
      .selectDistinct({ transactionId: journalEntries.transactionId })
      .from(journalEntries)
      .where(eq(journalEntries.accountId, accountId));

    if (transactionIds.length === 0) return [];

    // Get full transactions
    let query = db
      .select()
      .from(transactions)
      .where(sql`${transactions.id} IN ${sql.raw(`(${transactionIds.map(t => `'${t.transactionId}'`).join(',')})`)}`)
      .orderBy(desc(transactions.date), desc(transactions.createdAt));

    if (limit) {
      query = query.limit(limit);
    }

    if (offset) {
      query = query.offset(offset);
    }

    const transactionList = await query;

    // Load entries for each transaction
    const transactionsWithEntries = await Promise.all(
      transactionList.map(async (transaction) => {
        const fullTransaction = await this.findById(transaction.id);
        return fullTransaction!;
      })
    );

    return transactionsWithEntries;
  }

  /**
   * Get account balance from journal entries
   */
  async getAccountBalance(accountId: string, asOfDate?: Date): Promise<string> {
    let query = db
      .select({
        totalDebits: sql<string>`COALESCE(SUM(${journalEntries.debitAmount}), 0)`,
        totalCredits: sql<string>`COALESCE(SUM(${journalEntries.creditAmount}), 0)`
      })
      .from(journalEntries)
      .innerJoin(transactions, eq(journalEntries.transactionId, transactions.id))
      .where(eq(journalEntries.accountId, accountId));

    if (asOfDate) {
      query = query.where(
        and(
          eq(journalEntries.accountId, accountId),
          lte(transactions.date, asOfDate)
        )
      );
    }

    const result = await query;
    const { totalDebits, totalCredits } = result[0];

    // Get account type to determine balance calculation
    const [account] = await db
      .select({ type: accounts.type })
      .from(accounts)
      .where(eq(accounts.id, accountId));

    if (!account) {
      throw new Error(`Account with ID ${accountId} not found`);
    }

    const debits = parseFloat(totalDebits);
    const credits = parseFloat(totalCredits);

    // Calculate balance based on account type
    let balance: number;
    if (account.type === 'ASSET' || account.type === 'EXPENSE') {
      balance = debits - credits;
    } else {
      balance = credits - debits;
    }

    return balance.toFixed(2);
  }

  /**
   * Get transaction history for audit trail
   */
  async getTransactionHistory(transactionId: string): Promise<any[]> {
    // This would typically include audit logs, but for now return the transaction details
    const transaction = await this.findById(transactionId);
    if (!transaction) return [];

    return [{
      action: 'CREATED',
      timestamp: transaction.createdAt,
      userId: transaction.createdBy,
      details: {
        referenceNumber: transaction.referenceNumber,
        description: transaction.description,
        totalAmount: transaction.totalAmount,
        entriesCount: transaction.entries.length
      }
    }];
  }

  /**
   * Validate that all account references exist
   */
  private async validateAccountReferences(entries: CreateJournalEntryData[]): Promise<void> {
    const accountIds = [...new Set(entries.map(entry => entry.accountId))];
    
    const existingAccounts = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(sql`${accounts.id} IN ${sql.raw(`(${accountIds.map(id => `'${id}'`).join(',')})`)}`)
      .where(eq(accounts.isActive, true));

    const existingAccountIds = new Set(existingAccounts.map(acc => acc.id));
    
    for (const accountId of accountIds) {
      if (!existingAccountIds.has(accountId)) {
        throw new Error(`Account with ID ${accountId} not found or is inactive`);
      }
    }
  }

  /**
   * Generate unique transaction reference number
   */
  private async generateUniqueReference(): Promise<string> {
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const reference = generateTransactionReference();
      
      const existing = await db
        .select({ id: transactions.id })
        .from(transactions)
        .where(eq(transactions.referenceNumber, reference))
        .limit(1);

      if (existing.length === 0) {
        return reference;
      }

      attempts++;
      // Add small delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 1));
    }

    throw new Error('Failed to generate unique transaction reference after multiple attempts');
  }

  /**
   * Update account balances in real-time
   */
  private async updateAccountBalances(tx: any, entries: CreateJournalEntryData[]): Promise<void> {
    // Group entries by account
    const accountUpdates = new Map<string, { debits: number; credits: number }>();

    for (const entry of entries) {
      const existing = accountUpdates.get(entry.accountId) || { debits: 0, credits: 0 };
      existing.debits += parseFloat(entry.debitAmount);
      existing.credits += parseFloat(entry.creditAmount);
      accountUpdates.set(entry.accountId, existing);
    }

    // Update each account's balance
    for (const [accountId, { debits, credits }] of accountUpdates) {
      // Get current account info
      const [account] = await tx
        .select({ balance: accounts.balance, type: accounts.type })
        .from(accounts)
        .where(eq(accounts.id, accountId));

      if (!account) continue;

      const currentBalance = parseFloat(account.balance);
      let newBalance: number;

      // Calculate new balance based on account type
      if (account.type === 'ASSET' || account.type === 'EXPENSE') {
        newBalance = currentBalance + debits - credits;
      } else {
        newBalance = currentBalance + credits - debits;
      }

      // Update account balance
      await tx
        .update(accounts)
        .set({ 
          balance: newBalance.toFixed(2),
          updatedAt: new Date()
        })
        .where(eq(accounts.id, accountId));
    }
  }

  /**
   * Get transaction count for pagination
   */
  async getTransactionCount(filters?: TransactionFilter): Promise<number> {
    let query = db.select({ count: sql<number>`count(*)` }).from(transactions);

    if (filters) {
      const conditions = [];

      if (filters.dateFrom) {
        conditions.push(gte(transactions.date, filters.dateFrom));
      }

      if (filters.dateTo) {
        conditions.push(lte(transactions.date, filters.dateTo));
      }

      if (filters.createdBy) {
        conditions.push(eq(transactions.createdBy, filters.createdBy));
      }

      if (filters.referenceNumber) {
        conditions.push(eq(transactions.referenceNumber, filters.referenceNumber));
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
    }

    const [result] = await query;
    return result.count;
  }

  /**
   * Search transactions by description or reference number
   */
  async search(query: string, limit?: number, offset?: number): Promise<TransactionWithEntries[]> {
    const searchPattern = `%${query}%`;
    
    const transactionList = await db
      .select()
      .from(transactions)
      .where(
        sql`(${transactions.description} ILIKE ${searchPattern} OR ${transactions.referenceNumber} ILIKE ${searchPattern})`
      )
      .orderBy(desc(transactions.date), desc(transactions.createdAt))
      .limit(limit || 50)
      .offset(offset || 0);

    // Load entries for each transaction
    const transactionsWithEntries = await Promise.all(
      transactionList.map(async (transaction) => {
        const fullTransaction = await this.findById(transaction.id);
        return fullTransaction!;
      })
    );

    return transactionsWithEntries;
  }
}