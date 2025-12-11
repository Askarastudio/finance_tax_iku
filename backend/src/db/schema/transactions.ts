import { pgTable, uuid, varchar, text, decimal, timestamp, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { accounts } from './accounts';

// Transaction table definition
export const transactions = pgTable('transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  referenceNumber: varchar('reference_number', { length: 50 }).notNull().unique(),
  date: timestamp('date').notNull(),
  description: text('description').notNull(),
  totalAmount: decimal('total_amount', { precision: 15, scale: 2 }).notNull(),
  createdBy: uuid('created_by').notNull(), // Will reference users table
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
}, (table) => ({
  // Indexes for optimal query performance
  refNumberIdx: index('transactions_ref_number_idx').on(table.referenceNumber),
  dateIdx: index('transactions_date_idx').on(table.date),
  createdByIdx: index('transactions_created_by_idx').on(table.createdBy),
  createdAtIdx: index('transactions_created_at_idx').on(table.createdAt)
}));

// Journal Entry table definition
export const journalEntries = pgTable('journal_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  transactionId: uuid('transaction_id').notNull().references(() => transactions.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id').notNull().references(() => accounts.id),
  debitAmount: decimal('debit_amount', { precision: 15, scale: 2 }).notNull().default('0.00'),
  creditAmount: decimal('credit_amount', { precision: 15, scale: 2 }).notNull().default('0.00'),
  description: text('description'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
}, (table) => ({
  // Indexes for optimal query performance
  transactionIdx: index('journal_entries_transaction_idx').on(table.transactionId),
  accountIdx: index('journal_entries_account_idx').on(table.accountId),
  debitIdx: index('journal_entries_debit_idx').on(table.debitAmount),
  creditIdx: index('journal_entries_credit_idx').on(table.creditAmount)
}));

// Transaction relations
export const transactionsRelations = relations(transactions, ({ many }) => ({
  journalEntries: many(journalEntries)
}));

// Journal Entry relations
export const journalEntriesRelations = relations(journalEntries, ({ one }) => ({
  transaction: one(transactions, {
    fields: [journalEntries.transactionId],
    references: [transactions.id]
  }),
  account: one(accounts, {
    fields: [journalEntries.accountId],
    references: [accounts.id]
  })
}));

// Transaction reference number generation
export function generateTransactionReference(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const timestamp = now.getTime().toString().slice(-6); // Last 6 digits of timestamp
  
  return `TXN-${year}${month}${day}-${timestamp}`;
}

// Double-entry validation functions
export function validateDoubleEntry(entries: Array<{ debitAmount: string; creditAmount: string }>): boolean {
  let totalDebits = 0;
  let totalCredits = 0;
  
  for (const entry of entries) {
    const debit = parseFloat(entry.debitAmount);
    const credit = parseFloat(entry.creditAmount);
    
    // Each entry should have either debit OR credit, not both
    if ((debit > 0 && credit > 0) || (debit === 0 && credit === 0)) {
      return false;
    }
    
    totalDebits += debit;
    totalCredits += credit;
  }
  
  // Total debits must equal total credits
  return Math.abs(totalDebits - totalCredits) < 0.01; // Allow for small floating point differences
}

export function calculateTransactionTotal(entries: Array<{ debitAmount: string; creditAmount: string }>): number {
  let total = 0;
  
  for (const entry of entries) {
    const debit = parseFloat(entry.debitAmount);
    const credit = parseFloat(entry.creditAmount);
    total += Math.max(debit, credit);
  }
  
  return total / 2; // Divide by 2 since we counted both debits and credits
}