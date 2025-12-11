import { describe, it, expect } from 'bun:test';
import fc from 'fast-check';
import { ReportService } from '../services/ReportService';

/**
 * Feature: finance-tax-compliance, Property 6: Financial Statement Balance Equation
 * 
 * For any balance sheet at a given date, the total assets must equal 
 * the sum of total liabilities and total equity
 */

describe('Balance Sheet Equation Property Tests', () => {
  const reportService = new ReportService();

  it('should maintain balance sheet equation: Assets = Liabilities + Equity', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate valid financial amounts (positive numbers with 2 decimal places)
        fc.record({
          assets: fc.array(
            fc.record({
              amount: fc.integer({ min: 0, max: 100000000 }).map(n => (n / 100).toFixed(2))
            }),
            { minLength: 1, maxLength: 10 }
          ),
          liabilities: fc.array(
            fc.record({
              amount: fc.integer({ min: 0, max: 100000000 }).map(n => (n / 100).toFixed(2))
            }),
            { minLength: 0, maxLength: 10 }
          ),
          equity: fc.array(
            fc.record({
              amount: fc.integer({ min: 0, max: 100000000 }).map(n => (n / 100).toFixed(2))
            }),
            { minLength: 0, maxLength: 10 }
          )
        }),
        async (data) => {
          // Calculate totals
          const totalAssets = data.assets
            .reduce((sum, item) => sum + parseFloat(item.amount), 0)
            .toFixed(2);

          const totalLiabilities = data.liabilities
            .reduce((sum, item) => sum + parseFloat(item.amount), 0)
            .toFixed(2);

          const totalEquity = data.equity
            .reduce((sum, item) => sum + parseFloat(item.amount), 0)
            .toFixed(2);

          // Test the balance sheet equation validation
          const isValid = reportService.validateBalanceSheetEquation(
            totalAssets,
            totalLiabilities,
            totalEquity
          );

          // Calculate expected result
          const assetsAmount = parseFloat(totalAssets);
          const liabilitiesAndEquityAmount = parseFloat(totalLiabilities) + parseFloat(totalEquity);
          const difference = Math.abs(assetsAmount - liabilitiesAndEquityAmount);
          const expectedValid = difference < 0.01;

          // Property: The validation should correctly identify when Assets = Liabilities + Equity
          expect(isValid).toBe(expectedValid);

          // Additional property: If the equation is balanced, the difference should be minimal
          if (isValid) {
            expect(difference).toBeLessThan(0.01);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should correctly validate balanced balance sheets', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate amounts where we ensure the equation is balanced
        fc.record({
          liabilities: fc.integer({ min: 0, max: 50000000 }).map(n => (n / 100).toFixed(2)),
          equity: fc.integer({ min: 0, max: 50000000 }).map(n => (n / 100).toFixed(2))
        }),
        async (data) => {
          const totalLiabilities = data.liabilities;
          const totalEquity = data.equity;
          
          // Calculate assets to ensure balance: Assets = Liabilities + Equity
          const totalAssets = (parseFloat(totalLiabilities) + parseFloat(totalEquity)).toFixed(2);

          // Test validation
          const isValid = reportService.validateBalanceSheetEquation(
            totalAssets,
            totalLiabilities,
            totalEquity
          );

          // Property: When Assets exactly equals Liabilities + Equity, validation should return true
          expect(isValid).toBe(true);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should correctly identify unbalanced balance sheets', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          assets: fc.integer({ min: 100000, max: 100000000 }).map(n => (n / 100).toFixed(2)),
          liabilities: fc.integer({ min: 0, max: 50000000 }).map(n => (n / 100).toFixed(2)),
          equity: fc.integer({ min: 0, max: 50000000 }).map(n => (n / 100).toFixed(2)),
          // Add a significant imbalance
          imbalance: fc.integer({ min: 100, max: 1000000 }).map(n => (n / 100).toFixed(2))
        }),
        async (data) => {
          const totalAssets = data.assets;
          const totalLiabilities = data.liabilities;
          
          // Create intentional imbalance by adding imbalance to equity
          const totalEquity = (parseFloat(data.equity) + parseFloat(data.imbalance)).toFixed(2);

          // Ensure there's actually a significant imbalance
          const assetsAmount = parseFloat(totalAssets);
          const liabilitiesAndEquityAmount = parseFloat(totalLiabilities) + parseFloat(totalEquity);
          const difference = Math.abs(assetsAmount - liabilitiesAndEquityAmount);
          
          // Only test cases where there's a significant imbalance
          fc.pre(difference >= 0.02); // More than our tolerance threshold

          // Test validation
          const isValid = reportService.validateBalanceSheetEquation(
            totalAssets,
            totalLiabilities,
            totalEquity
          );

          // Property: When there's a significant imbalance, validation should return false
          expect(isValid).toBe(false);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle edge cases with zero amounts', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          // Case 1: All zeros
          fc.constant({ assets: '0.00', liabilities: '0.00', equity: '0.00' }),
          // Case 2: Only assets
          fc.record({
            assets: fc.integer({ min: 1, max: 100000 }).map(n => (n / 100).toFixed(2)),
            liabilities: fc.constant('0.00'),
            equity: fc.constant('0.00')
          }),
          // Case 3: Only liabilities
          fc.record({
            assets: fc.constant('0.00'),
            liabilities: fc.integer({ min: 1, max: 100000 }).map(n => (n / 100).toFixed(2)),
            equity: fc.constant('0.00')
          })
        ),
        async (data) => {
          const isValid = reportService.validateBalanceSheetEquation(
            data.assets,
            data.liabilities,
            data.equity
          );

          // Calculate expected result
          const assetsAmount = parseFloat(data.assets);
          const liabilitiesAndEquityAmount = parseFloat(data.liabilities) + parseFloat(data.equity);
          const difference = Math.abs(assetsAmount - liabilitiesAndEquityAmount);
          const expectedValid = difference < 0.01;

          // Property: Validation should work correctly even with zero amounts
          expect(isValid).toBe(expectedValid);

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should handle floating point precision correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          baseAmount: fc.integer({ min: 100, max: 1000000 }).map(n => n / 100),
          // Small variations that might cause floating point issues
          variation1: fc.integer({ min: -5, max: 5 }).map(n => n / 1000),
          variation2: fc.integer({ min: -5, max: 5 }).map(n => n / 1000)
        }),
        async (data) => {
          // Create amounts that might have floating point precision issues
          const assets = data.baseAmount.toFixed(2);
          const liabilities = (data.baseAmount / 2 + data.variation1).toFixed(2);
          const equity = (data.baseAmount / 2 + data.variation2).toFixed(2);

          const isValid = reportService.validateBalanceSheetEquation(
            assets,
            liabilities,
            equity
          );

          // Calculate the actual difference
          const assetsAmount = parseFloat(assets);
          const liabilitiesAndEquityAmount = parseFloat(liabilities) + parseFloat(equity);
          const difference = Math.abs(assetsAmount - liabilitiesAndEquityAmount);

          // Property: The validation should handle floating point precision correctly
          // If the difference is within tolerance, it should be valid
          if (difference < 0.01) {
            expect(isValid).toBe(true);
          } else {
            expect(isValid).toBe(false);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});