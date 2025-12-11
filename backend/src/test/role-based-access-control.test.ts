import { test, expect } from 'bun:test';
import * as fc from 'fast-check';
import { 
  userRoleEnum, 
  type UserRole, 
  hasPermission, 
  canAccessResource, 
  validateUserRole,
  rolePermissions 
} from '../db/schema/users';

/**
 * Feature: finance-tax-compliance, Property 9: Role-Based Access Control
 * Validates: Requirements 5.1
 */

// Generator for valid user roles
const validUserRole = fc.constantFrom(...Object.values(userRoleEnum));

// Generator for valid resources and actions
const validResource = fc.constantFrom('users', 'accounts', 'transactions', 'reports', 'tax', 'audit', 'backup');
const validAction = fc.constantFrom('create', 'read', 'update', 'delete', 'export', 'restore');

test('Property 9: Admin role has access to all defined permissions', () => {
  fc.assert(
    fc.property(
      fc.constantFrom(...rolePermissions[userRoleEnum.ADMIN]),
      (permission) => {
        const hasAccess = hasPermission(userRoleEnum.ADMIN, permission);
        
        // Admin should have access to all their defined permissions
        expect(hasAccess).toBe(true);
        
        return true;
      }
    ),
    { numRuns: 100 }
  );
});

test('Property 9: Role hierarchy is properly enforced', () => {
  fc.assert(
    fc.property(
      validUserRole,
      validResource,
      validAction,
      (role, resource, action) => {
        const hasAccess = canAccessResource(role, resource, action);
        const permission = `${resource}:${action}`;
        
        // Check if the role actually has this permission
        const expectedAccess = rolePermissions[role].includes(permission as any);
        
        expect(hasAccess).toBe(expectedAccess);
        
        return true;
      }
    ),
    { numRuns: 100 }
  );
});

test('Property 9: Viewer role has most restrictive access', () => {
  fc.assert(
    fc.property(
      validResource,
      fc.constantFrom('create', 'update', 'delete', 'export', 'restore'), // Non-read actions
      (resource, action) => {
        const hasAccess = canAccessResource(userRoleEnum.VIEWER, resource, action);
        
        // Viewer should only have read access, no write/modify permissions
        expect(hasAccess).toBe(false);
        
        return true;
      }
    ),
    { numRuns: 100 }
  );
});

test('Property 9: Bookkeeper has limited write access', () => {
  fc.assert(
    fc.property(
      fc.constantFrom('users', 'tax', 'audit', 'backup'), // Resources bookkeeper shouldn\'t modify
      fc.constantFrom('create', 'update', 'delete', 'export', 'restore'),
      (resource, action) => {
        const hasAccess = canAccessResource(userRoleEnum.BOOKKEEPER, resource, action);
        
        // Bookkeeper should not have access to these administrative functions
        expect(hasAccess).toBe(false);
        
        return true;
      }
    ),
    { numRuns: 100 }
  );
});

test('Property 9: Permission validation is consistent', () => {
  fc.assert(
    fc.property(
      validUserRole,
      fc.string({ minLength: 1, maxLength: 50 }),
      (role, permission) => {
        const hasDirectPermission = hasPermission(role, permission);
        
        // Parse permission to check via canAccessResource
        const parts = permission.split(':');
        if (parts.length === 2) {
          const [resource, action] = parts;
          const hasResourceAccess = canAccessResource(role, resource, action);
          
          // Both methods should give the same result
          expect(hasDirectPermission).toBe(hasResourceAccess);
        }
        
        return true;
      }
    ),
    { numRuns: 100 }
  );
});

test('Property 9: Role validation correctly identifies valid roles', () => {
  fc.assert(
    fc.property(
      fc.oneof(
        validUserRole,
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => !Object.values(userRoleEnum).includes(s as UserRole))
      ),
      (roleString) => {
        const isValid = validateUserRole(roleString);
        const shouldBeValid = Object.values(userRoleEnum).includes(roleString as UserRole);
        
        expect(isValid).toBe(shouldBeValid);
        
        return true;
      }
    ),
    { numRuns: 100 }
  );
});

test('Property 9: Higher privilege roles include lower privilege permissions', () => {
  // Test that ACCOUNTANT has all BOOKKEEPER permissions
  const bookkeeperPermissions = rolePermissions[userRoleEnum.BOOKKEEPER];
  const accountantPermissions = rolePermissions[userRoleEnum.ACCOUNTANT];
  
  for (const permission of bookkeeperPermissions) {
    expect(accountantPermissions.includes(permission)).toBe(true);
  }
  
  // Test that ADMIN has all ACCOUNTANT permissions
  const adminPermissions = rolePermissions[userRoleEnum.ADMIN];
  
  for (const permission of accountantPermissions) {
    expect(adminPermissions.includes(permission)).toBe(true);
  }
});

test('Property 9: All roles have at least read access to basic resources', () => {
  fc.assert(
    fc.property(
      validUserRole,
      fc.constantFrom('accounts', 'transactions', 'reports'),
      (role, resource) => {
        const hasReadAccess = canAccessResource(role, resource, 'read');
        
        // All roles should have read access to basic financial data
        expect(hasReadAccess).toBe(true);
        
        return true;
      }
    ),
    { numRuns: 100 }
  );
});