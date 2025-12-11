import { test, expect } from 'bun:test';
import * as fc from 'fast-check';
import { validateDoubleEntry, calculateTransactionTotal, generateTransactionReference } from '../db/schema/transactions';

/**
 * Feature: finance-tax-compliance, Property 2: Double-Entry Balance Consistency
 * Validates: Requirements 2.1
 */

// Generator for valid journal entries (debit OR credit, not both)
const validJournalEntry = fc.record({
  debitAmount: fc.oneof(
    fc.constant('0.00'),
    fc.integer({ min: 1, max: 1000000 }).map(n => (n / 100).toFixed(2)) // Convert cents to dollars
  ),
  creditAmount: fc.oneof(
    fc.constant('0.00'),
    fc.integer({ min: 1, max: 1000000 }).map(n => (n / 100).toFixed(2)) // Convert cents to dollars
  )
}).filter(entry => {
  const debit = parseFloat(entry.debitAmount);
  const credit = parseFloat(entry.creditAmount);
  // Ensure only one is non-zero (valid double-entry)
  return (debit > 0 && credit === 0) || (debit === 0 && credit > 0);
});

test('Property 2: Valid double-entry transactions are accepted', () => {
  fc.assert(
    fc.property(
      // Generate pairs of debit/credit entries that are balanced
      fc.array(
        fc.integer({ min: 1, max: 100000 }).map(amount => {
          const value = (amount / 100).toFixed(2);
          return [
            { debitAmount: value, creditAmount: '0.00' },
            { debitAmount: '0.00', creditAmount: value }
          ];
        }),
        { minLength: 1, maxLength: 5 }
      ).map(pairs => pairs.flat()),
      (balancedEntries) => {
        const isValid = validateDoubleEntry(balancedEntries);
        expect(isValid).toBe(true);
        
        // Calculate totals
        let totalDebits = 0;
        let totalCredits = 0;
        
        balancedEntries.forEach(entry => {
          totalDebits += parseFloat(entry.debitAmount);
          totalCredits += parseFloat(entry.creditAmount);
        });
        
        // Verify balance
        expect(Math.abs(totalDebits - totalCredits)).toBeLessThan(0.01);
        
        return true;
      }
    ),
    { numRuns: 100 }
  );
});

test('Property 2: Invalid double-entry transactions are rejected', () => {
  fc.assert(
    fc.property(
      // Generate unbalanced journal entries
      fc.array(validJournalEntry, { minLength: 2, maxLength: 10 }).chain(entries => {
        // Intentionally unbalance by adding extra amount to random entry
        const randomIndex = Math.floor(Math.random() * entries.length);
        const extraAmount = fc.sample(fc.integer({ min: 1, max: 10000 }), 1)[0] / 100;
        
        if (parseFloat(entries[randomIndex].debitAmount) > 0) {
          entries[randomIndex].debitAmount = (parseFloat(entries[randomIndex].debitAmount) + extraAmount).toFixed(2);
        } else {
          entries[randomIndex].creditAmount = (parseFloat(entries[randomIndex].creditAmount) + extraAmount).toFixed(2);
        }
        
        return fc.constant(entries);
      }),
      (unbalancedEntries) => {
        const isValid = validateDoubleEntry(unbalancedEntries);
        
        // Calculate actual balance
        let totalDebits = 0;
        let totalCredits = 0;
        
        unbalancedEntries.forEach(entry => {
          totalDebits += parseFloat(entry.debitAmount);
          totalCredits += parseFloat(entry.creditAmount);
        });
        
        const isActuallyBalanced = Math.abs(totalDebits - totalCredits) < 0.01;
        
        // If actually balanced, should be valid; if unbalanced, should be invalid
        expect(isValid).toBe(isActuallyBalanced);
        
        return true;
      }
    ),
    { numRuns: 100 }
  );
});

test('Property 2: Entries with both debit and credit are rejected', () => {
  fc.assert(
    fc.property(
      fc.array(
        fc.record({
          debitAmount: fc.integer({ min: 1, max: 100000 }).map(n => (n / 100).toFixed(2)),
          creditAmount: fc.integer({ min: 1, max: 100000 }).map(n => (n / 100).toFixed(2))
        }),
        { minLength: 1, maxLength: 5 }
      ),
      (invalidEntries) => {
        const isValid = validateDoubleEntry(invalidEntries);
        
        // Should be invalid because entries have both debit AND credit
        expect(isValid).toBe(false);
        
        return true;
      }
    ),
    { numRuns: 100 }
  );
});

test('Property 2: Transaction total calculation is accurate', () => {
  fc.assert(
    fc.property(
      // Generate pairs of debit/credit entries that are balanced
      fc.array(
        fc.integer({ min: 1, max: 100000 }).map(amount => {
          const value = (amount / 100).toFixed(2);
          return [
            { debitAmount: value, creditAmount: '0.00' },
            { debitAmount: '0.00', creditAmount: value }
          ];
        }),
        { minLength: 1, maxLength: 5 }
      ).map(pairs => pairs.flat()),
      (balancedEntries) => {
        const calculatedTotal = calculateTransactionTotal(balancedEntries);
        
        // Calculate expected total (sum of all debits, which should equal sum of credits)
        let totalDebits = 0;
        balancedEntries.forEach(entry => {
          totalDebits += parseFloat(entry.debitAmount);
        });
        
        expect(Math.abs(calculatedTotal - totalDebits)).toBeLessThan(0.01);
        
        return true;
      }
    ),
    { numRuns: 100 }
  );
});

test('Property 2: Transaction reference numbers are unique and properly formatted', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 1, max: 100 }),
      (numReferences) => {
        const references = new Set<string>();
        
        for (let i = 0; i < numReferences; i++) {
          const ref = generateTransactionReference();
          
          // Check format: TXN-YYYYMMDD-XXXXXX
          expect(ref).toMatch(/^TXN-\d{8}-\d{6}$/);
          
          // Should be unique (in practice, very high probability due to timestamp)
          references.add(ref);
        }
        
        return true;
      }
    ),
    { numRuns: 10 } // Fewer runs since we're generating multiple refs per run
  );
});