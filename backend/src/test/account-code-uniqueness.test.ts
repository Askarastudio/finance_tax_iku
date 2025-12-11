import { test, expect } from 'bun:test';
import * as fc from 'fast-check';
import { validateAccountCode, getAccountTypeFromCode, validateAccountHierarchy, accountTypeEnum } from '../db/schema/accounts';

/**
 * Feature: finance-tax-compliance, Property 1: Account Code Uniqueness and Format Validation
 * Validates: Requirements 1.1
 */

test('Property 1: Account code format validation follows Indonesian standards', () => {
  fc.assert(
    fc.property(
      // Generate valid Indonesian account codes (1xxx-5xxx format)
      fc.integer({ min: 1000, max: 5999 }).map(num => num.toString()),
      (code) => {
        const isValid = validateAccountCode(code);
        const accountType = getAccountTypeFromCode(code);
        
        // Valid codes should pass validation and have correct type mapping
        if (isValid) {
          expect(accountType).not.toBeNull();
          
          const firstDigit = code.charAt(0);
          switch (firstDigit) {
            case '1':
              expect(accountType).toBe(accountTypeEnum.ASSET);
              break;
            case '2':
              expect(accountType).toBe(accountTypeEnum.LIABILITY);
              break;
            case '3':
              expect(accountType).toBe(accountTypeEnum.EQUITY);
              break;
            case '4':
              expect(accountType).toBe(accountTypeEnum.REVENUE);
              break;
            case '5':
              expect(accountType).toBe(accountTypeEnum.EXPENSE);
              break;
          }
        }
        
        return true;
      }
    ),
    { numRuns: 100 }
  );
});

test('Property 1: Invalid account codes are rejected', () => {
  fc.assert(
    fc.property(
      // Generate invalid codes (outside 1000-5999 range or wrong format)
      fc.oneof(
        fc.integer({ min: 0, max: 999 }).map(num => num.toString()),
        fc.integer({ min: 6000, max: 9999 }).map(num => num.toString()),
        fc.string({ minLength: 1, maxLength: 10 }).filter(s => !/^[1-5]\d{3}$/.test(s))
      ),
      (invalidCode) => {
        const isValid = validateAccountCode(invalidCode);
        const accountType = getAccountTypeFromCode(invalidCode);
        
        // Invalid codes should fail validation and return null type
        expect(isValid).toBe(false);
        expect(accountType).toBeNull();
        
        return true;
      }
    ),
    { numRuns: 100 }
  );
});

test('Property 1: Account hierarchy validation enforces proper parent-child relationships', () => {
  fc.assert(
    fc.property(
      // Generate valid parent codes
      fc.integer({ min: 1000, max: 5999 }).map(num => num.toString()),
      fc.integer({ min: 0, max: 99 }), // suffix for child
      (parentCode, childSuffix) => {
        // Create valid child code by extending parent
        const childCode = parentCode + childSuffix.toString().padStart(2, '0');
        
        if (validateAccountCode(parentCode) && validateAccountCode(childCode)) {
          const isValidHierarchy = validateAccountHierarchy(parentCode, childCode);
          
          // Valid hierarchy should be accepted
          expect(isValidHierarchy).toBe(true);
          
          // Same account type should be maintained
          const parentType = getAccountTypeFromCode(parentCode);
          const childType = getAccountTypeFromCode(childCode);
          expect(parentType).toBe(childType);
        }
        
        return true;
      }
    ),
    { numRuns: 100 }
  );
});

test('Property 1: Invalid hierarchy relationships are rejected', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 1000, max: 5999 }).map(num => num.toString()),
      fc.integer({ min: 1000, max: 5999 }).map(num => num.toString()),
      (code1, code2) => {
        // Ensure codes are different and don't have proper hierarchy
        if (code1 !== code2 && !code2.startsWith(code1) && !code1.startsWith(code2)) {
          const isValidHierarchy1 = validateAccountHierarchy(code1, code2);
          const isValidHierarchy2 = validateAccountHierarchy(code2, code1);
          
          // Neither should be valid hierarchy
          expect(isValidHierarchy1).toBe(false);
          expect(isValidHierarchy2).toBe(false);
        }
        
        return true;
      }
    ),
    { numRuns: 100 }
  );
});