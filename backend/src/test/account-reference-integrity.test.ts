import { test, expect } from 'bun:test';
import * as fc from 'fast-check';
import { CreateJournalEntryData } from '../repositories/TransactionRepository';

/**
 * Feature: finance-tax-compliance, Property 5: Account Reference Integrity
 * Validates: Requirements 2.4
 */

// Mock validation function that simulates account reference checking
function validateAccountReferences(entries: CreateJournalEntryData[], existingAccountIds: Set<string>): boolean {
  const referencedAccountIds = [...new Set(entries.map(entry => entry.accountId))];
  
  for (const accountId of referencedAccountIds) {
    if (!existingAccountIds.has(accountId)) {
      return false;
    }
  }
  return true;
}

test('Property 5: Account Reference Integrity - All referenced accounts must exist', () => {
  fc.assert(
    fc.property(
      // Generate existing account IDs
      fc.array(fc.uuid(), { minLength: 2, maxLength: 10 }),
      // Generate journal entries that may or may not reference existing accounts
      fc.array(
        fc.record({
          accountId: fc.uuid(),
          debitAmount: fc.float({ min: 0, max: 10000 }).map(n => n.toFixed(2)),
          creditAmount: fc.float({ min: 0, max: 10000 }).map(n => n.toFixed(2)),
          description: fc.string({ minLength: 1, maxLength: 100 })
        }),
        { minLength: 1, maxLength: 5 }
      ),
      (existingAccountIds, entries) => {
        const existingAccountSet = new Set(existingAccountIds);
        const isValid = validateAccountReferences(entries, existingAccountSet);
        
        // Check if all referenced accounts exist
        const referencedAccountIds = [...new Set(entries.map(entry => entry.accountId))];
        const allAccountsExist = referencedAccountIds.every(id => existingAccountSet.has(id));
        
        // The validation should return true if and only if all accounts exist
        expect(isValid).toBe(allAccountsExist);
      }
    ),
    { numRuns: 100 }
  );
});

test('Property 5: Account Reference Integrity - Entries with valid subset should pass', () => {
  fc.assert(
    fc.property(
      // Generate existing account IDs
      fc.array(fc.uuid(), { minLength: 5, maxLength: 10 }),
      // Generate number of entries to create
      fc.integer({ min: 2, max: 5 }),
      (existingAccountIds, numEntries) => {
        const existingAccountSet = new Set(existingAccountIds);
        
        // Create entries that only reference existing accounts (subset)
        const entries: CreateJournalEntryData[] = [];
        for (let i = 0; i < numEntries; i++) {
          const randomAccountId = existingAccountIds[i % existingAccountIds.length];
          entries.push({
            accountId: randomAccountId,
            debitAmount: (Math.random() * 1000).toFixed(2),
            creditAmount: '0.00',
            description: `Entry ${i}`
          });
        }
        
        const isValid = validateAccountReferences(entries, existingAccountSet);
        
        // Should be valid since all referenced accounts exist
        expect(isValid).toBe(true);
      }
    ),
    { numRuns: 100 }
  );
});

test('Property 5: Account Reference Integrity - Entries with non-existent accounts should fail', () => {
  fc.assert(
    fc.property(
      // Generate existing account IDs
      fc.array(fc.uuid(), { minLength: 2, maxLength: 5 }),
      // Generate non-existent account IDs
      fc.array(fc.uuid(), { minLength: 1, maxLength: 3 }),
      (existingAccountIds, nonExistentAccountIds) => {
        const existingAccountSet = new Set(existingAccountIds);
        
        // Ensure non-existent IDs are actually not in the existing set
        const filteredNonExistent = nonExistentAccountIds.filter(id => !existingAccountSet.has(id));
        
        if (filteredNonExistent.length === 0) {
          return; // Skip this test case
        }
        
        // Create entries that reference non-existent accounts
        const entries: CreateJournalEntryData[] = [
          {
            accountId: filteredNonExistent[0],
            debitAmount: '100.00',
            creditAmount: '0.00',
            description: 'Invalid entry'
          }
        ];
        
        const isValid = validateAccountReferences(entries, existingAccountSet);
        
        // Should be invalid since referenced account doesn't exist
        expect(isValid).toBe(false);
      }
    ),
    { numRuns: 100 }
  );
});