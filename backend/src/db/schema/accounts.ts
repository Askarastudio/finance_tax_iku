import { pgTable, uuid, varchar, text, boolean, decimal, timestamp, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Indonesian accounting categories enum
export const accountTypeEnum = {
  ASSET: 'ASSET',
  LIABILITY: 'LIABILITY', 
  EQUITY: 'EQUITY',
  REVENUE: 'REVENUE',
  EXPENSE: 'EXPENSE'
} as const;

export type AccountType = typeof accountTypeEnum[keyof typeof accountTypeEnum];

// Account table definition
export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 20 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 20 }).notNull().$type<AccountType>(),
  parentId: uuid('parent_id').references(() => accounts.id),
  isActive: boolean('is_active').notNull().default(true),
  balance: decimal('balance', { precision: 15, scale: 2 }).notNull().default('0.00'),
  description: text('description'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
}, (table) => ({
  // Indexes for optimal query performance
  codeIdx: index('accounts_code_idx').on(table.code),
  typeIdx: index('accounts_type_idx').on(table.type),
  parentIdx: index('accounts_parent_idx').on(table.parentId),
  activeIdx: index('accounts_active_idx').on(table.isActive)
}));

// Account relations for hierarchical structure
export const accountsRelations = relations(accounts, ({ one, many }) => ({
  parent: one(accounts, {
    fields: [accounts.parentId],
    references: [accounts.id],
    relationName: 'parent_child'
  }),
  children: many(accounts, {
    relationName: 'parent_child'
  }),
  journalEntries: many('journalEntries')
}));

// Account validation functions
export function validateAccountCode(code: string): boolean {
  // Indonesian accounting standard format: 
  // Assets: 1xxx, Liabilities: 2xxx, Equity: 3xxx, Revenue: 4xxx, Expenses: 5xxx
  const codePattern = /^[1-5]\d{3}$/;
  return codePattern.test(code);
}

export function getAccountTypeFromCode(code: string): AccountType | null {
  if (!validateAccountCode(code)) return null;
  
  const firstDigit = code.charAt(0);
  switch (firstDigit) {
    case '1': return accountTypeEnum.ASSET;
    case '2': return accountTypeEnum.LIABILITY;
    case '3': return accountTypeEnum.EQUITY;
    case '4': return accountTypeEnum.REVENUE;
    case '5': return accountTypeEnum.EXPENSE;
    default: return null;
  }
}

export function validateAccountHierarchy(parentCode: string, childCode: string): boolean {
  // Child account code should start with parent code prefix
  // e.g., parent: 1100, child: 1101, 1102, etc.
  if (parentCode.length >= childCode.length) return false;
  return childCode.startsWith(parentCode);
}