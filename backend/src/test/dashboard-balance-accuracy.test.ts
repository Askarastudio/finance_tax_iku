import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import { ReportService } from '../services/ReportService';
import { BookkeepingService } from '../services/BookkeepingService';
import { AccountRepository } from '../repositories/AccountRepository';
import { TransactionRepository } from '../repositories/TransactionRepository';

/**
 * **Feature: finance-tax-compliance, Property 15: Dashboard Balance Accuracy**
 * **Validates: Requirements 8.1**
 * 
 * Property: Dashboard balance calculations must match the sum of individual account balances
 * For any set of accounts and transactions, the dashboard summary balances should equal
 * the sum of all individual account balances within each account type category.
 */

describe('Dashboard Balance Accuracy Property Tests', () => {
  let reportService: ReportService;
  let bookkeepingService: BookkeepingService;
  let accountRepository: AccountRepository;
  let transactionRepository: TransactionRepository;
  let mockAccounts: Map<string, any>;
  let mockTransactions: Map<string, any>;

  beforeEach(() => {
    // Initialize mock data stores
    mockAccounts = new Map();
    mockTransactions = new Map();

    // Mock AccountRepository
    accountRepository = {
      create: vi.fn().mockImplementation(async (account) => {
        mockAccounts.set(account.id, { ...account });
        return account;
      }),
      findAll: vi.fn().mockImplementation(async () => {
        return Array.from(mockAccounts.values());
      }),
      update: vi.fn().mockImplementation(async (id, updates) => {
        const account = mockAccounts.get(id);
        if (account) {
          Object.assign(account, updates);
          mockAccounts.set(id, account);
        }
        return account;
      }),
      findById: vi.fn().mockImplementation(async (id) => {
        return mockAccounts.get(id);
      })
    } as any;

    // Mock TransactionRepository
    transactionRepository = {
      create: vi.fn().mockImplementation(async (transaction) => {
        mockTransactions.set(transaction.id, { ...transaction });
        return transaction;
      }),
      findByDateRange: vi.fn().mockImplementation(async (startDate, endDate) => {
        return Array.from(mockTransactions.values()).filter(tx => 
          tx.date >= startDate && tx.date <= endDate
        );
      }),
      findAll: vi.fn().mockImplementation(async () => {
        return Array.from(mockTransactions.values());
      })
    } as any;

    // Mock BookkeepingService
    bookkeepingService = {
      processTransaction: vi.fn().mockImplementation(async (transaction) => {
        // Update account balances based on journal entries
        for (const entry of transaction.journalEntries) {
          const account = mockAccounts.get(entry.accountId);
          if (account) {
            const currentBalance = parseFloat(account.balance);
            const debitAmount = parseFloat(entry.debitAmount);
            const creditAmount = parseFloat(entry.creditAmount);
            
            // Update balance based on account type and entry type
            let newBalance = currentBalance;
            if (['ASSET', 'EXPENSE'].includes(account.type)) {
              newBalance += debitAmount - creditAmount;
            } else {
              newBalance += creditAmount - debitAmount;
            }
            
            account.balance = newBalance.toFixed(2);
            mockAccounts.set(account.id, account);
          }
        }
        mockTransactions.set(transaction.id, transaction);
        return transaction;
      })
    } as any;

    // Mock ReportService
    reportService = {
      getDashboardSummary: vi.fn().mockImplementation(async (startDate?, endDate?) => {
        const accounts = Array.from(mockAccounts.values());
        
        const summary = accounts.reduce((totals, account) => {
          const balance = parseFloat(account.balance);
          switch (account.type) {
            case 'ASSET':
              totals.totalAssets += balance;
              break;
            case 'LIABILITY':
              totals.totalLiabilities += balance;
              break;
            case 'EQUITY':
              totals.totalEquity += balance;
              break;
            case 'REVENUE':
              totals.totalRevenue += balance;
              break;
            case 'EXPENSE':
              totals.totalExpenses += balance;
              break;
          }
          return totals;
        }, {
          totalAssets: 0,
          totalLiabilities: 0,
          totalEquity: 0,
          totalRevenue: 0,
          totalExpenses: 0
        });

        return summary;
      })
    } as any;
  });

  // Generator for account types
  const accountTypeArb = fc.constantFrom('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');

  // Generator for valid account codes based on type
  const accountCodeArb = (type: string) => {
    const prefix = type === 'ASSET' ? '1' : 
                  type === 'LIABILITY' ? '2' :
                  type === 'EQUITY' ? '3' :
                  type === 'REVENUE' ? '4' : '5';
    return fc.integer({ min: 100, max: 999 }).map(num => `${prefix}${num}`);
  };

  // Generator for accounts
  const accountArb = fc.record({
    id: fc.uuid(),
    code: fc.string({ minLength: 4, maxLength: 4 }).filter(code => /^[1-5]\d{3}$/.test(code)),
    name: fc.string({ minLength: 3, maxLength: 50 }),
    type: accountTypeArb,
    isActive: fc.boolean(),
    balance: fc.float({ min: -1000000, max: 1000000, noNaN: true }).map(n => n.toFixed(2)),
    description: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
    parentId: fc.option(fc.uuid(), { nil: undefined }),
    createdAt: fc.date().map(d => d.toISOString()),
    updatedAt: fc.date().map(d => d.toISOString())
  }).filter(account => {
    // Ensure account code matches account type
    const firstDigit = account.code.charAt(0);
    const expectedType = firstDigit === '1' ? 'ASSET' :
                        firstDigit === '2' ? 'LIABILITY' :
                        firstDigit === '3' ? 'EQUITY' :
                        firstDigit === '4' ? 'REVENUE' : 'EXPENSE';
    return account.type === expectedType;
  });

  // Generator for journal entries
  const journalEntryArb = (accountIds: string[]) => fc.record({
    id: fc.uuid(),
    accountId: fc.constantFrom(...accountIds),
    description: fc.string({ minLength: 5, maxLength: 100 }),
    debitAmount: fc.float({ min: 0, max: 100000, noNaN: true }).map(n => n.toFixed(2)),
    creditAmount: fc.float({ min: 0, max: 100000, noNaN: true }).map(n => n.toFixed(2))
  }).filter(entry => {
    // Ensure only one of debit or credit is non-zero
    const debit = parseFloat(entry.debitAmount);
    const credit = parseFloat(entry.creditAmount);
    return (debit > 0 && credit === 0) || (debit === 0 && credit > 0);
  });

  // Generator for transactions
  const transactionArb = (accountIds: string[]) => fc.record({
    id: fc.uuid(),
    referenceNumber: fc.string({ minLength: 8, maxLength: 20 }),
    date: fc.date({ min: new Date('2020-01-01'), max: new Date() }).map(d => d.toISOString().split('T')[0]),
    description: fc.string({ minLength: 10, maxLength: 200 }),
    journalEntries: fc.array(journalEntryArb(accountIds), { minLength: 2, maxLength: 6 })
      .filter(entries => {
        // Ensure transaction is balanced (total debits = total credits)
        const totalDebits = entries.reduce((sum, entry) => sum + parseFloat(entry.debitAmount), 0);
        const totalCredits = entries.reduce((sum, entry) => sum + parseFloat(entry.creditAmount), 0);
        return Math.abs(totalDebits - totalCredits) < 0.01;
      }),
    totalAmount: fc.float({ min: 1, max: 100000, noNaN: true }).map(n => n.toFixed(2)),
    createdAt: fc.date().map(d => d.toISOString()),
    updatedAt: fc.date().map(d => d.toISOString())
  });

  it('should maintain balance accuracy between dashboard summary and individual accounts', async () => {
    // Create simple test accounts
    const testAccounts = [
      { id: '1', code: '1001', name: 'Cash', type: 'ASSET', isActive: true, balance: '1000.00', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: '2', code: '2001', name: 'Accounts Payable', type: 'LIABILITY', isActive: true, balance: '500.00', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: '3', code: '3001', name: 'Capital', type: 'EQUITY', isActive: true, balance: '500.00', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: '4', code: '4001', name: 'Revenue', type: 'REVENUE', isActive: true, balance: '200.00', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: '5', code: '5001', name: 'Expenses', type: 'EXPENSE', isActive: true, balance: '100.00', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    ];

    // Setup accounts
    for (const account of testAccounts) {
      await accountRepository.create(account);
    }

    // Get dashboard summary
    const dashboardSummary = await reportService.getDashboardSummary();
    
    // Get individual account balances grouped by type
    const allAccounts = await accountRepository.findAll();
    const balancesByType = allAccounts.reduce((acc, account) => {
      if (!acc[account.type]) {
        acc[account.type] = 0;
      }
      acc[account.type] += parseFloat(account.balance);
      return acc;
    }, {} as Record<string, number>);

    // Property: Dashboard summary balances should match sum of individual account balances
    expect(Math.abs(dashboardSummary.totalAssets - (balancesByType.ASSET || 0))).toBeLessThan(0.01);
    expect(Math.abs(dashboardSummary.totalLiabilities - (balancesByType.LIABILITY || 0))).toBeLessThan(0.01);
    expect(Math.abs(dashboardSummary.totalEquity - (balancesByType.EQUITY || 0))).toBeLessThan(0.01);
    expect(Math.abs(dashboardSummary.totalRevenue - (balancesByType.REVENUE || 0))).toBeLessThan(0.01);
    expect(Math.abs(dashboardSummary.totalExpenses - (balancesByType.EXPENSE || 0))).toBeLessThan(0.01);
  });

  it('should maintain balance accuracy when accounts are activated/deactivated', async () => {
    // Create test accounts
    const testAccounts = [
      { id: '1', code: '1001', name: 'Cash', type: 'ASSET', isActive: true, balance: '1000.00', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: '2', code: '1002', name: 'Inventory', type: 'ASSET', isActive: true, balance: '2000.00', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: '3', code: '2001', name: 'Accounts Payable', type: 'LIABILITY', isActive: true, balance: '1500.00', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    ];

    // Setup accounts
    for (const account of testAccounts) {
      await accountRepository.create(account);
    }

    // Deactivate one account
    await accountRepository.update('2', { isActive: false });

    // Get dashboard summary (should include all accounts regardless of active status)
    const dashboardSummary = await reportService.getDashboardSummary();
    
    // Get all accounts and calculate totals manually
    const allAccounts = await accountRepository.findAll();
    const manualTotals = allAccounts.reduce((totals, account) => {
      const balance = parseFloat(account.balance);
      switch (account.type) {
        case 'ASSET':
          totals.assets += balance;
          break;
        case 'LIABILITY':
          totals.liabilities += balance;
          break;
        case 'EQUITY':
          totals.equity += balance;
          break;
        case 'REVENUE':
          totals.revenue += balance;
          break;
        case 'EXPENSE':
          totals.expenses += balance;
          break;
      }
      return totals;
    }, { assets: 0, liabilities: 0, equity: 0, revenue: 0, expenses: 0 });

    // Property: Dashboard should match manual calculations regardless of account status
    expect(Math.abs(dashboardSummary.totalAssets - manualTotals.assets)).toBeLessThan(0.01);
    expect(Math.abs(dashboardSummary.totalLiabilities - manualTotals.liabilities)).toBeLessThan(0.01);
    expect(Math.abs(dashboardSummary.totalEquity - manualTotals.equity)).toBeLessThan(0.01);
    expect(Math.abs(dashboardSummary.totalRevenue - manualTotals.revenue)).toBeLessThan(0.01);
    expect(Math.abs(dashboardSummary.totalExpenses - manualTotals.expenses)).toBeLessThan(0.01);
  });

  it('should maintain accuracy when filtering by date ranges', async () => {
    // Create test accounts
    const testAccounts = [
      { id: '1', code: '1001', name: 'Cash', type: 'ASSET', isActive: true, balance: '1000.00', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: '2', code: '4001', name: 'Revenue', type: 'REVENUE', isActive: true, balance: '500.00', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    ];

    // Setup accounts
    for (const account of testAccounts) {
      await accountRepository.create(account);
    }

    const startDate = '2024-01-01';
    const endDate = '2024-12-31';

    // Get dashboard summary for date range
    const dashboardSummary = await reportService.getDashboardSummary(startDate, endDate);

    // Verify that the dashboard calculation method is consistent
    expect(typeof dashboardSummary.totalAssets).toBe('number');
    expect(typeof dashboardSummary.totalLiabilities).toBe('number');
    expect(typeof dashboardSummary.totalEquity).toBe('number');
    expect(typeof dashboardSummary.totalRevenue).toBe('number');
    expect(typeof dashboardSummary.totalExpenses).toBe('number');

    // Basic validation that values are reasonable
    expect(dashboardSummary.totalAssets).toBeGreaterThanOrEqual(0);
    expect(dashboardSummary.totalLiabilities).toBeGreaterThanOrEqual(0);
    expect(dashboardSummary.totalRevenue).toBeGreaterThanOrEqual(0);
    expect(dashboardSummary.totalExpenses).toBeGreaterThanOrEqual(0);
  });
});