import { describe, it, expect } from 'bun:test';
import fc from 'fast-check';
import { ReportService } from '../services/ReportService';

/**
 * Feature: finance-tax-compliance, Property 7: Income Statement Calculation Accuracy
 * 
 * For any income statement for a specified period, net income must equal 
 * total revenues minus total expenses
 */

describe('Income Statement Calculation Accuracy Property Tests', () => {
  const reportService = new ReportService();

  it('should correctly calculate net income as revenue minus expenses', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          revenues: fc.array(
            fc.record({
              amount: fc.integer({ min: 0, max: 100000000 }).map(n => (n / 100).toFixed(2))
            }),
            { minLength: 0, maxLength: 10 }
          ),
          expenses: fc.array(
            fc.record({
              amount: fc.integer({ min: 0, max: 100000000 }).map(n => (n / 100).toFixed(2))
            }),
            { minLength: 0, maxLength: 10 }
          )
        }),
        async (data) => {
          // Calculate totals
          const totalRevenue = data.revenues
            .reduce((sum, item) => sum + parseFloat(item.amount), 0)
            .toFixed(2);

          const totalExpenses = data.expenses
            .reduce((sum, item) => sum + parseFloat(item.amount), 0)
            .toFixed(2);

          // Calculate expected net income
          const expectedNetIncome = (parseFloat(totalRevenue) - parseFloat(totalExpenses)).toFixed(2);

          // Test the income statement calculation validation
          const isValid = reportService.validateIncomeStatementCalculation(
            totalRevenue,
            totalExpenses,
            expectedNetIncome
          );

          // Property: The validation should return true when Net Income = Revenue - Expenses
          expect(isValid).toBe(true);

          // Additional property: Manual calculation should match the expected result
          const manualCalculation = parseFloat(totalRevenue) - parseFloat(totalExpenses);
          const difference = Math.abs(manualCalculation - parseFloat(expectedNetIncome));
          expect(difference).toBeLessThan(0.01);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should detect incorrect net income calculations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          revenue: fc.integer({ min: 100000, max: 100000000 }).map(n => (n / 100).toFixed(2)),
          expenses: fc.integer({ min: 0, max: 50000000 }).map(n => (n / 100).toFixed(2)),
          // Add an error to the net income calculation
          calculationError: fc.integer({ min: 100, max: 1000000 }).map(n => (n / 100).toFixed(2))
        }),
        async (data) => {
          const totalRevenue = data.revenue;
          const totalExpenses = data.expenses;
          
          // Create incorrect net income by adding an error
          const correctNetIncome = parseFloat(totalRevenue) - parseFloat(totalExpenses);
          const incorrectNetIncome = (correctNetIncome + parseFloat(data.calculationError)).toFixed(2);

          // Ensure there's actually a significant error
          const error = Math.abs(correctNetIncome - parseFloat(incorrectNetIncome));
          fc.pre(error >= 0.02); // More than our tolerance threshold

          // Test validation with incorrect net income
          const isValid = reportService.validateIncomeStatementCalculation(
            totalRevenue,
            totalExpenses,
            incorrectNetIncome
          );

          // Property: When net income is incorrect, validation should return false
          expect(isValid).toBe(false);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle zero revenue and expenses correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          // Case 1: Both zero
          fc.constant({ revenue: '0.00', expenses: '0.00', netIncome: '0.00' }),
          // Case 2: Only revenue
          fc.record({
            revenue: fc.integer({ min: 1, max: 100000 }).map(n => (n / 100).toFixed(2)),
            expenses: fc.constant('0.00')
          }).map(data => ({
            ...data,
            netIncome: data.revenue
          })),
          // Case 3: Only expenses (negative net income)
          fc.record({
            revenue: fc.constant('0.00'),
            expenses: fc.integer({ min: 1, max: 100000 }).map(n => (n / 100).toFixed(2))
          }).map(data => ({
            ...data,
            netIncome: (-parseFloat(data.expenses)).toFixed(2)
          }))
        ),
        async (data) => {
          const isValid = reportService.validateIncomeStatementCalculation(
            data.revenue,
            data.expenses,
            data.netIncome
          );

          // Property: Validation should work correctly with zero amounts
          expect(isValid).toBe(true);

          // Verify the calculation manually
          const expectedNetIncome = parseFloat(data.revenue) - parseFloat(data.expenses);
          const actualNetIncome = parseFloat(data.netIncome);
          const difference = Math.abs(expectedNetIncome - actualNetIncome);
          expect(difference).toBeLessThan(0.01);

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should handle negative net income (losses) correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          revenue: fc.integer({ min: 0, max: 5000000 }).map(n => (n / 100).toFixed(2)),
          expenses: fc.integer({ min: 5000100, max: 10000000 }).map(n => (n / 100).toFixed(2)) // Expenses > Revenue
        }),
        async (data) => {
          const totalRevenue = data.revenue;
          const totalExpenses = data.expenses;
          
          // Calculate net income (should be negative)
          const netIncome = (parseFloat(totalRevenue) - parseFloat(totalExpenses)).toFixed(2);
          
          // Ensure we have a loss scenario
          fc.pre(parseFloat(netIncome) < 0);

          // Test validation
          const isValid = reportService.validateIncomeStatementCalculation(
            totalRevenue,
            totalExpenses,
            netIncome
          );

          // Property: Validation should correctly handle negative net income (losses)
          expect(isValid).toBe(true);

          // Verify the net income is indeed negative
          expect(parseFloat(netIncome)).toBeLessThan(0);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle floating point precision in income calculations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          baseRevenue: fc.integer({ min: 100000, max: 100000000 }).map(n => n / 100),
          baseExpenses: fc.integer({ min: 50000, max: 50000000 }).map(n => n / 100),
          // Small variations that might cause floating point issues
          revenueVariation: fc.integer({ min: -5, max: 5 }).map(n => n / 1000),
          expenseVariation: fc.integer({ min: -5, max: 5 }).map(n => n / 1000)
        }),
        async (data) => {
          // Create amounts that might have floating point precision issues
          const revenue = (data.baseRevenue + data.revenueVariation).toFixed(2);
          const expenses = (data.baseExpenses + data.expenseVariation).toFixed(2);
          const netIncome = (parseFloat(revenue) - parseFloat(expenses)).toFixed(2);

          const isValid = reportService.validateIncomeStatementCalculation(
            revenue,
            expenses,
            netIncome
          );

          // Property: The validation should handle floating point precision correctly
          expect(isValid).toBe(true);

          // Verify manual calculation
          const manualNetIncome = parseFloat(revenue) - parseFloat(expenses);
          const difference = Math.abs(manualNetIncome - parseFloat(netIncome));
          expect(difference).toBeLessThan(0.01);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should validate income statement components independently', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          revenueAccounts: fc.array(
            fc.record({
              name: fc.string({ minLength: 1, maxLength: 50 }),
              amount: fc.integer({ min: 0, max: 10000000 }).map(n => (n / 100).toFixed(2))
            }),
            { minLength: 1, maxLength: 5 }
          ),
          expenseAccounts: fc.array(
            fc.record({
              name: fc.string({ minLength: 1, maxLength: 50 }),
              amount: fc.integer({ min: 0, max: 10000000 }).map(n => (n / 100).toFixed(2))
            }),
            { minLength: 1, maxLength: 5 }
          )
        }),
        async (data) => {
          // Calculate totals from individual accounts
          const totalRevenue = data.revenueAccounts
            .reduce((sum, account) => sum + parseFloat(account.amount), 0)
            .toFixed(2);

          const totalExpenses = data.expenseAccounts
            .reduce((sum, account) => sum + parseFloat(account.amount), 0)
            .toFixed(2);

          const netIncome = (parseFloat(totalRevenue) - parseFloat(totalExpenses)).toFixed(2);

          // Test validation
          const isValid = reportService.validateIncomeStatementCalculation(
            totalRevenue,
            totalExpenses,
            netIncome
          );

          // Property: When calculated from individual account totals, the equation should hold
          expect(isValid).toBe(true);

          // Additional property: Individual account amounts should sum correctly
          const manualRevenueSum = data.revenueAccounts
            .reduce((sum, account) => sum + parseFloat(account.amount), 0);
          const manualExpenseSum = data.expenseAccounts
            .reduce((sum, account) => sum + parseFloat(account.amount), 0);

          expect(Math.abs(manualRevenueSum - parseFloat(totalRevenue))).toBeLessThan(0.01);
          expect(Math.abs(manualExpenseSum - parseFloat(totalExpenses))).toBeLessThan(0.01);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});