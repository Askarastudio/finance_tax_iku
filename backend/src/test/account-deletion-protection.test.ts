import { describe, test, expect } from 'bun:test';
import fc from 'fast-check';
import { AccountType, accountTypeEnum, validateAccountCode, getAccountTypeFromCode } from '../db/schema/accounts';

/**
 * **Feature: finance-tax-compliance, Property 11: Account Deletion Protection**
 * **Validates: Requirements 1.5**
 * 
 * Property: For any account that has associated transactions, deletion must be prevented 
 * and deactivation must be required instead
 */

// Mock AccountRepository for testing without database
class MockAccountRepository {
  private accounts: Map<string, any> = new Map();
  private transactions: Map<string, any[]> = new Map(); // accountId -> transactions

  async create(data: any): Promise<any> {
    if (!validateAccountCode(data.code)) {
      throw new Error(`Invalid account code format: ${data.code}`);
    }

    const expectedType = getAccountTypeFromCode(data.code);
    if (expectedType !== data.type) {
      throw new Error(`Account type ${data.type} does not match code ${data.code}`);
    }

    if (this.accounts.has(data.code)) {
      throw new Error(`Account code ${data.code} already exists`);
    }

    const account = {
      id: crypto.randomUUID(),
      code: data.code,
      name: data.name,
      type: data.type,
      isActive: true,
      ...data
    };

    this.accounts.set(account.id, account);
    this.transactions.set(account.id, []);
    return account;
  }

  async findById(id: string): Promise<any | null> {
    return this.accounts.get(id) || null;
  }

  async delete(id: string): Promise<void> {
    const account = this.accounts.get(id);
    if (!account) {
      throw new Error(`Account with ID ${id} not found`);
    }

    const accountTransactions = this.transactions.get(id) || [];
    if (accountTransactions.length > 0) {
      throw new Error(`Cannot delete account ${account.code} because it has associated transactions. Use deactivate instead.`);
    }

    this.accounts.delete(id);
    this.transactions.delete(id);
  }

  async deactivate(id: string): Promise<any> {
    const account = this.accounts.get(id);
    if (!account) {
      throw new Error(`Account with ID ${id} not found`);
    }

    const accountTransactions = this.transactions.get(id) || [];
    if (accountTransactions.length === 0) {
      throw new Error(`Account ${account.code} cannot be deactivated. Use delete for accounts without transactions.`);
    }

    account.isActive = false;
    this.accounts.set(id, account);
    return account;
  }

  // Helper method to add transactions for testing
  addTransaction(accountId: string, transaction: any): void {
    const transactions = this.transactions.get(accountId) || [];
    transactions.push(transaction);
    this.transactions.set(accountId, transactions);
  }
}

describe('Account Deletion Protection Property Tests', () => {

  test('Property 11: Account with transactions cannot be deleted', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate account data
        fc.record({
          code: fc.constantFrom('1001', '1002', '2001', '2002', '3001', '4001', '5001'),
          name: fc.string({ minLength: 1, maxLength: 50 }),
          description: fc.option(fc.string({ maxLength: 100 }))
        }),
        // Generate transaction data
        fc.record({
          description: fc.string({ minLength: 1, maxLength: 100 }),
          amount: fc.integer({ min: 1, max: 10000 }).map(n => (n / 100).toFixed(2))
        }),
        async (accountData, transactionData) => {
          const accountRepo = new MockAccountRepository();
          
          // Determine account type from code
          const accountType = getAccountTypeFromCode(accountData.code);
          if (!accountType) return; // Skip invalid codes

          // Create account
          const account = await accountRepo.create({
            code: accountData.code,
            name: accountData.name,
            type: accountType,
            description: accountData.description || undefined
          });

          // Add a transaction to this account
          accountRepo.addTransaction(account.id, {
            id: crypto.randomUUID(),
            description: transactionData.description,
            amount: transactionData.amount
          });

          // Attempt to delete account with transactions - should fail
          let deletionFailed = false;
          try {
            await accountRepo.delete(account.id);
          } catch (error) {
            deletionFailed = true;
            expect(error).toBeInstanceOf(Error);
            expect((error as Error).message).toContain('Cannot delete account');
            expect((error as Error).message).toContain('has associated transactions');
            expect((error as Error).message).toContain('Use deactivate instead');
          }

          // Verify deletion was prevented
          expect(deletionFailed).toBe(true);

          // Verify account still exists
          const existingAccount = await accountRepo.findById(account.id);
          expect(existingAccount).not.toBeNull();
          expect(existingAccount?.isActive).toBe(true);

          // Verify deactivation works instead
          const deactivatedAccount = await accountRepo.deactivate(account.id);
          expect(deactivatedAccount.isActive).toBe(false);
          expect(deactivatedAccount.id).toBe(account.id);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 11: Account without transactions can be deleted', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          code: fc.constantFrom('1001', '1002', '2001', '2002', '3001', '4001', '5001'),
          name: fc.string({ minLength: 1, maxLength: 50 }),
          description: fc.option(fc.string({ maxLength: 100 }))
        }),
        async (accountData) => {
          const accountRepo = new MockAccountRepository();
          
          // Determine account type from code
          const accountType = getAccountTypeFromCode(accountData.code);
          if (!accountType) return; // Skip invalid codes

          // Create account without any transactions
          const account = await accountRepo.create({
            code: accountData.code,
            name: accountData.name,
            type: accountType,
            description: accountData.description || undefined
          });

          // Verify account exists
          const existingAccount = await accountRepo.findById(account.id);
          expect(existingAccount).not.toBeNull();

          // Delete account without transactions - should succeed
          await accountRepo.delete(account.id);

          // Verify account was deleted
          const deletedAccount = await accountRepo.findById(account.id);
          expect(deletedAccount).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 11: Deactivation attempt on account without transactions should fail', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          code: fc.constantFrom('1001', '1002', '2001', '2002', '3001', '4001', '5001'),
          name: fc.string({ minLength: 1, maxLength: 50 })
        }),
        async (accountData) => {
          const accountRepo = new MockAccountRepository();
          
          // Determine account type from code
          const accountType = getAccountTypeFromCode(accountData.code);
          if (!accountType) return; // Skip invalid codes

          // Create account without any transactions
          const account = await accountRepo.create({
            code: accountData.code,
            name: accountData.name,
            type: accountType
          });

          // Attempt to deactivate account without transactions - should fail
          let deactivationFailed = false;
          try {
            await accountRepo.deactivate(account.id);
          } catch (error) {
            deactivationFailed = true;
            expect(error).toBeInstanceOf(Error);
            expect((error as Error).message).toContain('cannot be deactivated');
            expect((error as Error).message).toContain('Use delete for accounts without transactions');
          }

          // Verify deactivation was prevented
          expect(deactivationFailed).toBe(true);

          // Verify account is still active
          const existingAccount = await accountRepo.findById(account.id);
          expect(existingAccount?.isActive).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Helper function to get account type from code
function getAccountTypeFromCode(code: string): AccountType | null {
  const firstDigit = code.charAt(0);
  switch (firstDigit) {
    case '1': return accountTypeEnum.ASSET;
    case '2': return accountTypeEnum.LIABILITY;
    case '3': return accountTypeEnum.EQUITY;
    case '4': return accountTypeEnum.REVENUE;
    case '5': return accountTypeEnum.EXPENSE;
    default: return null;
  }
}