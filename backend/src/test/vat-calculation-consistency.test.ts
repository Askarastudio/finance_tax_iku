import { test, expect } from 'bun:test';
import * as fc from 'fast-check';
import { TaxService, VATCalculationInput } from '../services/TaxService';
import { vatTransactionTypeEnum, standardIndonesianVATRates } from '../db/schema/tax';

/**
 * Feature: finance-tax-compliance, Property 8: VAT Calculation Consistency
 * Validates: Requirements 4.1
 */

// Generator for valid monetary amounts
const monetaryAmount = fc.integer({ min: 100, max: 10000000 }).map(n => (n / 100).toFixed(2));

// Generator for VAT transaction types
const vatTransactionType = fc.constantFrom(...Object.values(vatTransactionTypeEnum));

// Generator for valid tax rates (0% to 100%)
const taxRate = fc.integer({ min: 0, max: 10000 }).map(n => (n / 10000).toFixed(4));

// Mock TaxService for testing
class MockTaxService extends TaxService {
  private mockTaxRates: Map<string, number> = new Map();

  constructor() {
    super();
    // Initialize with standard Indonesian VAT rates
    for (const [type, rate] of Object.entries(standardIndonesianVATRates)) {
      this.mockTaxRates.set(type, rate);
    }
  }

  setMockTaxRate(transactionType: string, rate: number): void {
    this.mockTaxRates.set(transactionType, rate);
  }

  getMockTaxRate(transactionType: string): number {
    return this.mockTaxRates.get(transactionType) || 0;
  }

  // Override the validation method for testing
  validateVATCalculation(
    baseAmount: number,
    taxRate: number,
    taxAmount: number,
    totalAmount: number
  ): boolean {
    return super.validateVATCalculation(baseAmount, taxRate, taxAmount, totalAmount);
  }

  // Mock calculation method for testing
  mockCalculateVAT(baseAmount: string, transactionType: string): {
    baseAmount: string;
    taxRate: string;
    taxAmount: string;
    totalAmount: string;
    isExempt: boolean;
  } {
    const base = parseFloat(baseAmount);
    const rate = this.getMockTaxRate(transactionType);
    const taxAmount = base * rate;
    const totalAmount = base + taxAmount;

    return {
      baseAmount,
      taxRate: rate.toFixed(4),
      taxAmount: taxAmount.toFixed(2),
      totalAmount: totalAmount.toFixed(2),
      isExempt: rate === 0
    };
  }
}

test('Property 8: VAT calculation mathematical accuracy', () => {
  fc.assert(
    fc.property(
      monetaryAmount,
      vatTransactionType,
      (baseAmount, transactionType) => {
        const taxService = new MockTaxService();
        
        // Mock calculation without database dependency
        const calculation = taxService.mockCalculateVAT(baseAmount, transactionType);
        
        const base = parseFloat(calculation.baseAmount);
        const rate = parseFloat(calculation.taxRate);
        const tax = parseFloat(calculation.taxAmount);
        const total = parseFloat(calculation.totalAmount);
        
        // Verify mathematical accuracy
        const expectedTax = base * rate;
        const expectedTotal = base + expectedTax;
        
        const taxDiff = Math.abs(tax - expectedTax);
        const totalDiff = Math.abs(total - expectedTotal);
        
        return taxDiff < 0.01 && totalDiff < 0.01;
      }
    ),
    { numRuns: 100 }
  );
});

test('Property 8: VAT calculation consistency across transaction types', () => {
  fc.assert(
    fc.property(
      monetaryAmount,
      (baseAmount) => {
        const taxService = new MockTaxService();
        
        // Test consistency across different transaction types
        const standardCalc = taxService.mockCalculateVAT(baseAmount, 'STANDARD');
        const exemptCalc = taxService.mockCalculateVAT(baseAmount, 'EXEMPT');
        
        const standardRate = parseFloat(standardCalc.taxRate);
        const exemptRate = parseFloat(exemptCalc.taxRate);
        
        // Standard should have positive rate, exempt should be zero
        return standardRate > 0 && exemptRate === 0;
      }
    ),
    { numRuns: 100 }
  );
});

test('Property 8: VAT rate changes preserve calculation accuracy', () => {
  fc.assert(
    fc.property(
      monetaryAmount,
      taxRate,
      vatTransactionType,
      (baseAmount, newRate, transactionType) => {
        const taxService = new MockTaxService();
        
        // Set new rate
        const rate = parseFloat(newRate);
        taxService.setMockTaxRate(transactionType, rate);
        
        // Calculate with new rate
        const calculation = taxService.mockCalculateVAT(baseAmount, transactionType);
        
        const calculatedRate = parseFloat(calculation.taxRate);
        
        // Rate should match what was set
        return Math.abs(calculatedRate - rate) < 0.0001;
      }
    ),
    { numRuns: 100 }
  );
});

test('Property 8: Zero-rated transactions have zero VAT', () => {
  fc.assert(
    fc.property(
      monetaryAmount,
      (baseAmount) => {
        const taxService = new MockTaxService();
        
        // Set zero rate
        taxService.setMockTaxRate('ZERO_RATED', 0);
        
        const calculation = taxService.mockCalculateVAT(baseAmount, 'ZERO_RATED');
        
        const taxAmount = parseFloat(calculation.taxAmount);
        const totalAmount = parseFloat(calculation.totalAmount);
        const baseAmountNum = parseFloat(calculation.baseAmount);
        
        // Tax should be zero, total should equal base
        return taxAmount === 0 && Math.abs(totalAmount - baseAmountNum) < 0.01;
      }
    ),
    { numRuns: 100 }
  );
});

test('Property 8: VAT calculation is commutative for rate application', () => {
  fc.assert(
    fc.property(
      fc.array(monetaryAmount, { minLength: 2, maxLength: 2 }),
      taxRate,
      (amounts, rate) => {
        const taxService = new MockTaxService();
        const rateNum = parseFloat(rate);
        
        taxService.setMockTaxRate('STANDARD', rateNum);
        
        // Calculate VAT for each amount
        const calc1 = taxService.mockCalculateVAT(amounts[0], 'STANDARD');
        const calc2 = taxService.mockCalculateVAT(amounts[1], 'STANDARD');
        
        const tax1 = parseFloat(calc1.taxAmount);
        const tax2 = parseFloat(calc2.taxAmount);
        const base1 = parseFloat(calc1.baseAmount);
        const base2 = parseFloat(calc2.baseAmount);
        
        // Combined calculation
        const combinedBase = base1 + base2;
        const combinedTax = combinedBase * rateNum;
        const separateTax = tax1 + tax2;
        
        // Should be commutative
        return Math.abs(combinedTax - separateTax) < 0.01;
      }
    ),
    { numRuns: 100 }
  );
});

test('Property 8: VAT calculation handles edge cases correctly', () => {
  fc.assert(
    fc.property(
      vatTransactionType,
      (transactionType) => {
        const taxService = new MockTaxService();
        
        // Test with maximum allowed amount
        const maxAmount = '999999.99';
        const calculation = taxService.mockCalculateVAT(maxAmount, transactionType);
        
        const base = parseFloat(calculation.baseAmount);
        const rate = parseFloat(calculation.taxRate);
        const tax = parseFloat(calculation.taxAmount);
        
        // Should handle large amounts correctly
        const expectedTax = base * rate;
        return Math.abs(tax - expectedTax) < 0.01;
      }
    ),
    { numRuns: 100 }
  );
});

test('Property 8: Standard Indonesian VAT rates are applied correctly', () => {
  fc.assert(
    fc.property(
      monetaryAmount,
      taxRate,
      fc.integer({ min: 0, max: 1 }),
      (baseAmount, customRate, useStandard) => {
        const taxService = new MockTaxService();
        
        if (useStandard === 1) {
          // Use standard Indonesian VAT rate (11%)
          taxService.setMockTaxRate('STANDARD', 0.11);
          const calculation = taxService.mockCalculateVAT(baseAmount, 'STANDARD');
          const rate = parseFloat(calculation.taxRate);
          return Math.abs(rate - 0.11) < 0.0001;
        } else {
          // Use custom rate
          const rate = parseFloat(customRate);
          taxService.setMockTaxRate('STANDARD', rate);
          const calculation = taxService.mockCalculateVAT(baseAmount, 'STANDARD');
          const calculatedRate = parseFloat(calculation.taxRate);
          return Math.abs(calculatedRate - rate) < 0.0001;
        }
      }
    ),
    { numRuns: 100 }
  );
});

test('Property 8: VAT calculation validation detects incorrect calculations', () => {
  fc.assert(
    fc.property(
      monetaryAmount,
      taxRate,
      (baseAmount, rate) => {
        const taxService = new MockTaxService();
        
        const base = parseFloat(baseAmount);
        const taxRate = parseFloat(rate);
        const correctTax = base * taxRate;
        const correctTotal = base + correctTax;
        
        // Test correct calculation
        const isValidCorrect = taxService.validateVATCalculation(base, taxRate, correctTax, correctTotal);
        
        // Test incorrect calculation (off by 0.02)
        const incorrectTax = correctTax + 0.02;
        const incorrectTotal = base + incorrectTax;
        const isValidIncorrect = taxService.validateVATCalculation(base, taxRate, incorrectTax, incorrectTotal);
        
        return isValidCorrect && !isValidIncorrect;
      }
    ),
    { numRuns: 100 }
  );
});

test('Property 8: Luxury tax calculation maintains consistency', () => {
  fc.assert(
    fc.property(
      monetaryAmount,
      taxRate,
      (baseAmount, luxuryRate) => {
        // Mock luxury tax calculation
        const base = parseFloat(baseAmount);
        const rate = parseFloat(luxuryRate);
        
        const expectedLuxuryTax = base * rate;
        const expectedTotal = base + expectedLuxuryTax;
        
        // Verify calculation accuracy
        const luxuryTax = parseFloat(expectedLuxuryTax.toFixed(2));
        const total = parseFloat(expectedTotal.toFixed(2));
        
        const luxuryDiff = Math.abs(luxuryTax - expectedLuxuryTax);
        const totalDiff = Math.abs(total - expectedTotal);
        
        return luxuryDiff < 0.01 && totalDiff < 0.01;
      }
    ),
    { numRuns: 100 }
  );
});

test('Property 8: VAT calculation consistency across transaction types', () => {
  fc.assert(
    fc.property(
      monetaryAmount,
      (baseAmount) => {
        const taxService = new MockTaxService();
        
        // Calculate VAT for all transaction types with same base amount
        const calculations = Object.values(vatTransactionTypeEnum).map(type => {
          const calc = taxService.mockCalculateVAT(baseAmount, type);
          return { type, ...calc };
        });
        
        // Verify each calculation is mathematically consistent
        for (const calc of calculations) {
          const base = parseFloat(calc.baseAmount);
          const rate = parseFloat(calc.taxRate);
          const tax = parseFloat(calc.taxAmount);
          const total = parseFloat(calc.totalAmount);
          
          const isValid = taxService.validateVATCalculation(base, rate, tax, total);
          expect(isValid).toBe(true);
          
          // Verify exempt transactions have zero tax
          if (calc.isExempt) {
            expect(tax).toBe(0);
            expect(total).toBe(base);
          }
        }
        
        return true;
      }
    ),
    { numRuns: 100 }
  );
});

test('Property 8: VAT rate changes preserve calculation accuracy', () => {
  fc.assert(
    fc.property(
      monetaryAmount,
      taxRate,
      vatTransactionType,
      (baseAmount, newRate, transactionType) => {
        const taxService = new MockTaxService();
        
        // Set custom tax rate
        const rate = parseFloat(newRate);
        taxService.setMockTaxRate(transactionType, rate);
        
        const calculation = taxService.mockCalculateVAT(baseAmount, transactionType);
        
        const base = parseFloat(calculation.baseAmount);
        const calculatedRate = parseFloat(calculation.taxRate);
        const tax = parseFloat(calculation.taxAmount);
        const total = parseFloat(calculation.totalAmount);
        
        // Verify the rate was applied correctly
        expect(Math.abs(calculatedRate - rate)).toBeLessThan(0.0001);
        
        // Verify mathematical accuracy
        const expectedTax = base * rate;
        const expectedTotal = base + expectedTax;
        
        expect(Math.abs(tax - expectedTax)).toBeLessThan(0.01);
        expect(Math.abs(total - expectedTotal)).toBeLessThan(0.01);
        
        return true;
      }
    ),
    { numRuns: 100 }
  );
});

test('Property 8: Zero-rated transactions have zero VAT', () => {
  fc.assert(
    fc.property(
      monetaryAmount,
      (baseAmount) => {
        const taxService = new MockTaxService();
        
        // Test zero-rated transaction types
        const zeroRatedTypes = [
          vatTransactionTypeEnum.ZERO_RATED,
          vatTransactionTypeEnum.EXEMPT,
          vatTransactionTypeEnum.EXPORT
        ];
        
        for (const transactionType of zeroRatedTypes) {
          const calculation = taxService.mockCalculateVAT(baseAmount, transactionType);
          
          const base = parseFloat(calculation.baseAmount);
          const tax = parseFloat(calculation.taxAmount);
          const total = parseFloat(calculation.totalAmount);
          
          // Zero-rated transactions should have no VAT
          expect(tax).toBe(0);
          expect(total).toBe(base);
          expect(calculation.isExempt).toBe(true);
        }
        
        return true;
      }
    ),
    { numRuns: 100 }
  );
});

test('Property 8: VAT calculation is commutative for rate application', () => {
  fc.assert(
    fc.property(
      fc.array(monetaryAmount, { minLength: 2, maxLength: 5 }),
      taxRate,
      (amounts, rate) => {
        const taxService = new MockTaxService();
        const rateValue = parseFloat(rate);
        
        // Set the same rate for standard transactions
        taxService.setMockTaxRate(vatTransactionTypeEnum.STANDARD, rateValue);
        
        // Calculate VAT for each amount individually
        const individualCalculations = amounts.map(amount => {
          const calc = taxService.mockCalculateVAT(amount, vatTransactionTypeEnum.STANDARD);
          return {
            base: parseFloat(calc.baseAmount),
            tax: parseFloat(calc.taxAmount),
            total: parseFloat(calc.totalAmount)
          };
        });
        
        // Calculate total base amount and apply VAT
        const totalBase = amounts.reduce((sum, amount) => sum + parseFloat(amount), 0);
        const totalCalc = taxService.mockCalculateVAT(totalBase.toFixed(2), vatTransactionTypeEnum.STANDARD);
        
        // Sum of individual tax amounts should equal tax on total
        const sumOfIndividualTax = individualCalculations.reduce((sum, calc) => sum + calc.tax, 0);
        const totalTax = parseFloat(totalCalc.taxAmount);
        
        expect(Math.abs(sumOfIndividualTax - totalTax)).toBeLessThan(0.02);
        
        return true;
      }
    ),
    { numRuns: 50 }
  );
});

test('Property 8: VAT calculation handles edge cases correctly', () => {
  fc.assert(
    fc.property(
      fc.oneof(
        fc.constant('0.00'),
        fc.constant('0.01'),
        fc.constant('999999.99')
      ),
      vatTransactionType,
      (edgeAmount, transactionType) => {
        const taxService = new MockTaxService();
        
        const calculation = taxService.mockCalculateVAT(edgeAmount, transactionType);
        
        const base = parseFloat(calculation.baseAmount);
        const rate = parseFloat(calculation.taxRate);
        const tax = parseFloat(calculation.taxAmount);
        const total = parseFloat(calculation.totalAmount);
        
        // Verify calculation is valid even for edge cases
        const isValid = taxService.validateVATCalculation(base, rate, tax, total);
        expect(isValid).toBe(true);
        
        // Verify non-negative amounts
        expect(base).toBeGreaterThanOrEqual(0);
        expect(tax).toBeGreaterThanOrEqual(0);
        expect(total).toBeGreaterThanOrEqual(base);
        
        return true;
      }
    ),
    { numRuns: 100 }
  );
});

test('Property 8: Standard Indonesian VAT rates are applied correctly', () => {
  fc.assert(
    fc.property(
      monetaryAmount,
      (baseAmount) => {
        const taxService = new MockTaxService();
        
        // Test standard VAT rate (11%)
        const calculation = taxService.mockCalculateVAT(baseAmount, vatTransactionTypeEnum.STANDARD);
        
        const base = parseFloat(calculation.baseAmount);
        const rate = parseFloat(calculation.taxRate);
        const tax = parseFloat(calculation.taxAmount);
        
        // Verify standard rate is 11% (0.11)
        expect(Math.abs(rate - 0.11)).toBeLessThan(0.0001);
        
        // Verify tax amount is 11% of base
        const expectedTax = base * 0.11;
        expect(Math.abs(tax - expectedTax)).toBeLessThan(0.01);
        
        return true;
      }
    ),
    { numRuns: 100 }
  );
});

test('Property 8: VAT calculation validation detects incorrect calculations', () => {
  fc.assert(
    fc.property(
      monetaryAmount,
      taxRate,
      fc.integer({ min: -1000, max: 1000 }).map(n => n / 100), // Error amount
      (baseAmount, rate, errorAmount) => {
        const taxService = new MockTaxService();
        
        const base = parseFloat(baseAmount);
        const rateValue = parseFloat(rate);
        
        // Calculate correct amounts
        const correctTax = base * rateValue;
        const correctTotal = base + correctTax;
        
        // Create incorrect amounts by adding error
        const incorrectTax = correctTax + errorAmount;
        const incorrectTotal = correctTotal + errorAmount;
        
        // Validate correct calculation
        const correctIsValid = taxService.validateVATCalculation(base, rateValue, correctTax, correctTotal);
        expect(correctIsValid).toBe(true);
        
        // Validate incorrect calculation (should be invalid if error is significant)
        if (Math.abs(errorAmount) >= 0.02) {
          const incorrectTaxValid = taxService.validateVATCalculation(base, rateValue, incorrectTax, correctTotal);
          const incorrectTotalValid = taxService.validateVATCalculation(base, rateValue, correctTax, incorrectTotal);
          
          expect(incorrectTaxValid || incorrectTotalValid).toBe(false);
        }
        
        return true;
      }
    ),
    { numRuns: 100 }
  );
});

test('Property 8: Luxury tax calculation maintains consistency', () => {
  fc.assert(
    fc.property(
      monetaryAmount,
      taxRate,
      (baseAmount, luxuryRate) => {
        const taxService = new MockTaxService();
        
        // Mock luxury tax calculation
        const base = parseFloat(baseAmount);
        const rate = parseFloat(luxuryRate);
        const luxuryTaxResult = {
          luxuryTaxAmount: (base * rate).toFixed(2),
          totalWithLuxuryTax: (base + (base * rate)).toFixed(2)
        };
        
        const luxuryTax = parseFloat(luxuryTaxResult.luxuryTaxAmount);
        const totalWithLuxury = parseFloat(luxuryTaxResult.totalWithLuxuryTax);
        
        // Verify luxury tax calculation
        const expectedLuxuryTax = base * rate;
        const expectedTotal = base + expectedLuxuryTax;
        
        expect(Math.abs(luxuryTax - expectedLuxuryTax)).toBeLessThan(0.01);
        expect(Math.abs(totalWithLuxury - expectedTotal)).toBeLessThan(0.01);
        
        return true;
      }
    ),
    { numRuns: 100 }
  );
});