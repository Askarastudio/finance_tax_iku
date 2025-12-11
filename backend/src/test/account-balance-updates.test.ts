import { describe, test, expect } from 'bun:test';
import fc from 'fast-check';
import { AccountType, accountTypeEnum } from '../db/schema/accounts';
import { validateDoubleEntry, calculateTransactionTotal } from '../db/schema/transactions';

/**
 * **Feature: finance-tax-compliance, Property 3: Account Balance Real-time Updates**
 * **Validates: Requirements 2.2**
 * 
 * Property: For any transaction that is recorded, all affected account balances 
 * must be updated by the correct amounts immediately
 */

interface MockAccount {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  balance: number;
}

interface MockJournalEntry {
  accountId: string;
  debitAmount: string;
  creditAmount: string;
  description?: string;
}

interface MockTransaction {
  id: string;
  referenceNumber: string;
  date: Date;
  description: string;
  totalAmount: string;
  entries: MockJournalEntry[];
}

// Mock TransactionRepository for testing without database
class MockTransactionRepository {
  private accounts: Map<string, MockAccount> = new Map();
  private transactions: Map<string, MockTransaction> = new Map();

  addAccount(account: MockAccount): void {
    this.accounts.set(account.id, { ...account });
  }

  getAccount(id: string): MockAccount | null {
    return this.accounts.get(id) || null;
  }

  async create(data: {
    date: Date;
    description: string;
    entries: MockJournalEntry[];
    createdBy: string;
  }): Promise<MockTransaction> {
    // Validate double-entry bookkeeping
    if (!validateDoubleEntry(data.entries)) {
      throw new Error('Transaction violates double-entry bookkeeping');
    }

    // Validate account references
    for (const entry of data.entries) {
      if (!this.accounts.has(entry.accountId)) {
        throw new Error(`Account ${entry.accountId} not found`);
      }
    }

    // Calculate total amount
    const totalAmount = calculateTransactionTotal(data.entries);

    // Create transaction
    const transaction: MockTransaction = {
      id: crypto.randomUUID(),
      referenceNumber: `TXN-${Date.now()}`,
      date: data.date,
      description: data.description,
      totalAmount: totalAmount.toFixed(2),
      entries: data.entries
    };

    // Update account balances immediately
    this.updateAccountBalances(data.entries);

    this.transactions.set(transaction.id, transaction);
    return transaction;
  }

  private updateAccountBalances(entries: MockJournalEntry[]): void {
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
      const account = this.accounts.get(accountId);
      if (!account) continue;

      const currentBalance = account.balance;
      let newBalance: number;

      // Calculate new balance based on account type
      if (account.type === 'ASSET' || account.type === 'EXPENSE') {
        newBalance = currentBalance + debits - credits;
      } else {
        newBalance = currentBalance + credits - debits;
      }

      account.balance = newBalance;
      this.accounts.set(accountId, account);
    }
  }

  getAccountBalance(accountId: string): number {
    const account = this.accounts.get(accountId);
    return account ? account.balance : 0;
  }
}

describe('Account Balance Real-time Updates Property Tests', () => {
  test('Property 3: Account balances are updated correctly for asset accounts', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate asset account
        fc.record({
          initialBalance: fc.integer({ min: 0, max: 100000 }).map(n => n / 100),
          transactionAmount: fc.integer({ min: 1, max: 10000 }).map(n => n / 100)
        }),
        fc.boolean(), // true for debit, false for credit
        async (accountData, isDebit) => {
          const repo = new MockTransactionRepository();

          // Create asset account
          const account: MockAccount = {
            id: crypto.randomUUID(),
            code: '1001',
            name: 'Cash Account',
            type: accountTypeEnum.ASSET,
            balance: accountData.initialBalance
          };

          repo.addAccount(account);

          const initialBalance = repo.getAccountBalance(account.id);
          expect(initialBalance).toBe(accountData.initialBalance);

          // Create a balanced transaction
          const entries: MockJournalEntry[] = isDebit ? [
            {
              accountId: account.id,
              debitAmount: accountData.transactionAmount.toFixed(2),
              creditAmount: '0.00'
            },
            {
              accountId: 'dummy-credit-account',
              debitAmount: '0.00',
              creditAmount: accountData.transactionAmount.toFixed(2)
            }
          ] : [
            {
              accountId: account.id,
              debitAmount: '0.00',
              creditAmount: accountData.transactionAmount.toFixed(2)
            },
            {
              accountId: 'dummy-debit-account',
              debitAmount: accountData.transactionAmount.toFixed(2),
              creditAmount: '0.00'
            }
          ];

          // Add dummy accounts for balancing
          repo.addAccount({
            id: 'dummy-credit-account',
            code: '2001',
            name: 'Dummy Credit',
            type: accountTypeEnum.LIABILITY,
            balance: 0
          });

          repo.addAccount({
            id: 'dummy-debit-account',
            code: '5001',
            name: 'Dummy Debit',
            type: accountTypeEnum.EXPENSE,
            balance: 0
          });

          // Record transaction
          await repo.create({
            date: new Date(),
            description: 'Test transaction',
            entries,
            createdBy: 'test-user'
          });

          // Verify balance update
          const newBalance = repo.getAccountBalance(account.id);
          const expectedBalance = isDebit 
            ? accountData.initialBalance + accountData.transactionAmount
            : accountData.initialBalance - accountData.transactionAmount;

          expect(Math.abs(newBalance - expectedBalance)).toBeLessThan(0.01);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 3: Account balances are updated correctly for liability accounts', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          initialBalance: fc.integer({ min: 0, max: 100000 }).map(n => n / 100),
          transactionAmount: fc.integer({ min: 1, max: 10000 }).map(n => n / 100)
        }),
        fc.boolean(), // true for debit, false for credit
        async (accountData, isDebit) => {
          const repo = new MockTransactionRepository();

          // Create liability account
          const account: MockAccount = {
            id: crypto.randomUUID(),
            code: '2001',
            name: 'Accounts Payable',
            type: accountTypeEnum.LIABILITY,
            balance: accountData.initialBalance
          };

          repo.addAccount(account);

          // Create balancing accounts
          repo.addAccount({
            id: 'dummy-asset-account',
            code: '1001',
            name: 'Dummy Asset',
            type: accountTypeEnum.ASSET,
            balance: 0
          });

          repo.addAccount({
            id: 'dummy-expense-account',
            code: '5001',
            name: 'Dummy Expense',
            type: accountTypeEnum.EXPENSE,
            balance: 0
          });

          const initialBalance = repo.getAccountBalance(account.id);

          // Create a balanced transaction
          const entries: MockJournalEntry[] = isDebit ? [
            {
              accountId: account.id,
              debitAmount: accountData.transactionAmount.toFixed(2),
              creditAmount: '0.00'
            },
            {
              accountId: 'dummy-asset-account',
              debitAmount: '0.00',
              creditAmount: accountData.transactionAmount.toFixed(2)
            }
          ] : [
            {
              accountId: account.id,
              debitAmount: '0.00',
              creditAmount: accountData.transactionAmount.toFixed(2)
            },
            {
              accountId: 'dummy-expense-account',
              debitAmount: accountData.transactionAmount.toFixed(2),
              creditAmount: '0.00'
            }
          ];

          // Record transaction
          await repo.create({
            date: new Date(),
            description: 'Test transaction',
            entries,
            createdBy: 'test-user'
          });

          // Verify balance update (for liability: credit increases, debit decreases)
          const newBalance = repo.getAccountBalance(account.id);
          const expectedBalance = isDebit 
            ? accountData.initialBalance - accountData.transactionAmount
            : accountData.initialBalance + accountData.transactionAmount;

          expect(Math.abs(newBalance - expectedBalance)).toBeLessThan(0.01);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 3: Multiple account updates in single transaction are atomic', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            accountType: fc.constantFrom(...Object.values(accountTypeEnum)),
            initialBalance: fc.integer({ min: 0, max: 100000 }).map(n => n / 100),
            transactionAmount: fc.integer({ min: 1, max: 1000 }).map(n => n / 100)
          }),
          { minLength: 2, maxLength: 4 }
        ),
        async (accountsData) => {
          const repo = new MockTransactionRepository();

          // Create accounts
          const accounts: MockAccount[] = accountsData.map((data, index) => ({
            id: `account-${index}`,
            code: `${index + 1}001`,
            name: `Test Account ${index}`,
            type: data.accountType,
            balance: data.initialBalance
          }));

          accounts.forEach(account => repo.addAccount(account));

          // Record initial balances
          const initialBalances = accounts.map(account => repo.getAccountBalance(account.id));

          // Create balanced journal entries
          let totalDebits = 0;
          let totalCredits = 0;
          const entries: MockJournalEntry[] = [];

          // First half of accounts get debits, second half get credits
          const midpoint = Math.floor(accounts.length / 2);

          for (let i = 0; i < midpoint; i++) {
            const amount = accountsData[i].transactionAmount;
            entries.push({
              accountId: accounts[i].id,
              debitAmount: amount.toFixed(2),
              creditAmount: '0.00'
            });
            totalDebits += amount;
          }

          for (let i = midpoint; i < accounts.length; i++) {
            const amount = accountsData[i].transactionAmount;
            entries.push({
              accountId: accounts[i].id,
              debitAmount: '0.00',
              creditAmount: amount.toFixed(2)
            });
            totalCredits += amount;
          }

          // Balance the transaction if needed
          if (Math.abs(totalDebits - totalCredits) > 0.01) {
            const difference = totalDebits - totalCredits;
            if (difference > 0) {
              // Add credit to balance
              entries[entries.length - 1].creditAmount = (parseFloat(entries[entries.length - 1].creditAmount) + difference).toFixed(2);
            } else {
              // Add debit to balance
              entries[0].debitAmount = (parseFloat(entries[0].debitAmount) - difference).toFixed(2);
            }
          }

          // Verify transaction is balanced
          expect(validateDoubleEntry(entries)).toBe(true);

          // Record transaction
          await repo.create({
            date: new Date(),
            description: 'Multi-account test transaction',
            entries,
            createdBy: 'test-user'
          });

          // Verify all balances were updated correctly
          for (let i = 0; i < accounts.length; i++) {
            const account = accounts[i];
            const entry = entries[i];
            const initialBalance = initialBalances[i];
            const newBalance = repo.getAccountBalance(account.id);

            const debitAmount = parseFloat(entry.debitAmount);
            const creditAmount = parseFloat(entry.creditAmount);

            let expectedBalance: number;
            if (account.type === 'ASSET' || account.type === 'EXPENSE') {
              expectedBalance = initialBalance + debitAmount - creditAmount;
            } else {
              expectedBalance = initialBalance + creditAmount - debitAmount;
            }

            expect(Math.abs(newBalance - expectedBalance)).toBeLessThan(0.01);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Property 3: Invalid transactions do not update any balances', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          initialBalance: fc.integer({ min: 0, max: 100000 }).map(n => n / 100),
          debitAmount: fc.integer({ min: 1, max: 1000 }).map(n => n / 100),
          creditAmount: fc.integer({ min: 1, max: 1000 }).map(n => n / 100)
        }),
        async (data) => {
          // Ensure debit and credit amounts are different (unbalanced)
          if (Math.abs(data.debitAmount - data.creditAmount) < 0.01) {
            data.creditAmount = data.debitAmount + 1;
          }

          const repo = new MockTransactionRepository();

          const account: MockAccount = {
            id: crypto.randomUUID(),
            code: '1001',
            name: 'Test Account',
            type: accountTypeEnum.ASSET,
            balance: data.initialBalance
          };

          repo.addAccount(account);

          const initialBalance = repo.getAccountBalance(account.id);

          // Create unbalanced transaction (should fail)
          const entries: MockJournalEntry[] = [
            {
              accountId: account.id,
              debitAmount: data.debitAmount.toFixed(2),
              creditAmount: '0.00'
            },
            {
              accountId: 'dummy-account',
              debitAmount: '0.00',
              creditAmount: data.creditAmount.toFixed(2) // Different amount - unbalanced
            }
          ];

          repo.addAccount({
            id: 'dummy-account',
            code: '2001',
            name: 'Dummy Account',
            type: accountTypeEnum.LIABILITY,
            balance: 0
          });

          // Attempt to record invalid transaction
          let transactionFailed = false;
          try {
            await repo.create({
              date: new Date(),
              description: 'Invalid transaction',
              entries,
              createdBy: 'test-user'
            });
          } catch (error) {
            transactionFailed = true;
            expect(error).toBeInstanceOf(Error);
            expect((error as Error).message).toContain('double-entry bookkeeping');
          }

          // Verify transaction failed
          expect(transactionFailed).toBe(true);

          // Verify balance was not changed
          const finalBalance = repo.getAccountBalance(account.id);
          expect(finalBalance).toBe(initialBalance);
        }
      ),
      { numRuns: 100 }
    );
  });
});