import { pgTable, uuid, varchar, text, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Indonesian tax-specific user roles
export const userRoleEnum = {
  ADMIN: 'ADMIN',
  ACCOUNTANT: 'ACCOUNTANT',
  BOOKKEEPER: 'BOOKKEEPER',
  VIEWER: 'VIEWER'
} as const;

export type UserRole = typeof userRoleEnum[keyof typeof userRoleEnum];

// User table definition
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: varchar('role', { length: 20 }).notNull().$type<UserRole>(),
  isActive: boolean('is_active').notNull().default(true),
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
}, (table) => ({
  // Indexes for optimal query performance
  emailIdx: index('users_email_idx').on(table.email),
  roleIdx: index('users_role_idx').on(table.role),
  activeIdx: index('users_active_idx').on(table.isActive),
  lastLoginIdx: index('users_last_login_idx').on(table.lastLoginAt)
}));

// User relations will be defined when needed

// Role-based permissions mapping
export const rolePermissions = {
  [userRoleEnum.ADMIN]: [
    'users:create',
    'users:read',
    'users:update',
    'users:delete',
    'accounts:create',
    'accounts:read',
    'accounts:update',
    'accounts:delete',
    'transactions:create',
    'transactions:read',
    'transactions:update',
    'transactions:delete',
    'reports:read',
    'reports:export',
    'tax:read',
    'tax:update',
    'tax:export',
    'audit:read',
    'backup:create',
    'backup:restore'
  ],
  [userRoleEnum.ACCOUNTANT]: [
    'accounts:create',
    'accounts:read',
    'accounts:update',
    'transactions:create',
    'transactions:read',
    'transactions:update',
    'reports:read',
    'reports:export',
    'tax:read',
    'tax:update',
    'tax:export',
    'audit:read'
  ],
  [userRoleEnum.BOOKKEEPER]: [
    'accounts:read',
    'transactions:create',
    'transactions:read',
    'transactions:update',
    'reports:read'
  ],
  [userRoleEnum.VIEWER]: [
    'accounts:read',
    'transactions:read',
    'reports:read'
  ]
} as const;

// Permission validation functions
export function hasPermission(userRole: UserRole, permission: string): boolean {
  const permissions = rolePermissions[userRole];
  return permissions.includes(permission as any);
}

export function canAccessResource(userRole: UserRole, resource: string, action: string): boolean {
  const permission = `${resource}:${action}`;
  return hasPermission(userRole, permission);
}

export function validateUserRole(role: string): role is UserRole {
  return Object.values(userRoleEnum).includes(role as UserRole);
}