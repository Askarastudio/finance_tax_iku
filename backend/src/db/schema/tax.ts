import { pgTable, uuid, varchar, decimal, timestamp, boolean, text, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { transactions } from './transactions';

// Indonesian tax types
export const indonesianTaxTypeEnum = {
  VAT: 'VAT',                    // PPN (Pajak Pertambahan Nilai)
  INCOME_TAX: 'PPH',            // PPh (Pajak Penghasilan)
  WITHHOLDING_TAX: 'PPH_POTPUT', // PPh Potong/Pungut
  LUXURY_TAX: 'PPnBM',          // PPnBM (Pajak Penjualan atas Barang Mewah)
  STAMP_DUTY: 'BENDA_MATERAI'   // Bea Materai
} as const;

export type IndonesianTaxType = typeof indonesianTaxTypeEnum[keyof typeof indonesianTaxTypeEnum];

// VAT transaction types for Indonesian compliance
export const vatTransactionTypeEnum = {
  STANDARD: 'STANDARD',           // Standard VAT rate (11%)
  ZERO_RATED: 'ZERO_RATED',      // 0% VAT (exports, certain services)
  EXEMPT: 'EXEMPT',              // VAT exempt (healthcare, education)
  LUXURY: 'LUXURY',              // Luxury goods with additional tax
  IMPORT: 'IMPORT',              // Import VAT
  EXPORT: 'EXPORT'               // Export (usually zero-rated)
} as const;

export type VATTransactionType = typeof vatTransactionTypeEnum[keyof typeof vatTransactionTypeEnum];

// Tax configuration table
export const taxConfigurations = pgTable('tax_configurations', {
  id: uuid('id').primaryKey().defaultRandom(),
  taxType: varchar('tax_type', { length: 20 }).notNull().$type<IndonesianTaxType>(),
  transactionType: varchar('transaction_type', { length: 20 }).$type<VATTransactionType>(),
  rate: decimal('rate', { precision: 5, scale: 4 }).notNull(), // e.g., 0.1100 for 11%
  effectiveDate: timestamp('effective_date').notNull(),
  expiryDate: timestamp('expiry_date'),
  isActive: boolean('is_active').notNull().default(true),
  description: text('description'),
  legalReference: text('legal_reference'), // Indonesian tax law reference
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
}, (table) => ({
  // Indexes for optimal query performance
  taxTypeIdx: index('tax_config_tax_type_idx').on(table.taxType),
  transactionTypeIdx: index('tax_config_transaction_type_idx').on(table.transactionType),
  effectiveDateIdx: index('tax_config_effective_date_idx').on(table.effectiveDate),
  activeIdx: index('tax_config_active_idx').on(table.isActive)
}));

// Tax calculations table (for audit and reporting)
export const taxCalculations = pgTable('tax_calculations', {
  id: uuid('id').primaryKey().defaultRandom(),
  transactionId: uuid('transaction_id').notNull().references(() => transactions.id),
  taxConfigurationId: uuid('tax_configuration_id').notNull().references(() => taxConfigurations.id),
  baseAmount: decimal('base_amount', { precision: 15, scale: 2 }).notNull(),
  taxRate: decimal('tax_rate', { precision: 5, scale: 4 }).notNull(),
  taxAmount: decimal('tax_amount', { precision: 15, scale: 2 }).notNull(),
  totalAmount: decimal('total_amount', { precision: 15, scale: 2 }).notNull(),
  calculationDate: timestamp('calculation_date').notNull().defaultNow(),
  calculatedBy: uuid('calculated_by').notNull().references(() => users.id),
  notes: text('notes')
}, (table) => ({
  // Indexes for optimal query performance
  transactionIdx: index('tax_calc_transaction_idx').on(table.transactionId),
  configIdx: index('tax_calc_config_idx').on(table.taxConfigurationId),
  dateIdx: index('tax_calc_date_idx').on(table.calculationDate),
  calculatedByIdx: index('tax_calc_calculated_by_idx').on(table.calculatedBy)
}));

// Tax reports table (for Indonesian tax authority submissions)
export const taxReports = pgTable('tax_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  reportType: varchar('report_type', { length: 50 }).notNull(), // e.g., 'SPT_MASA_PPN'
  periodMonth: varchar('period_month', { length: 2 }).notNull(), // MM
  periodYear: varchar('period_year', { length: 4 }).notNull(), // YYYY
  totalTaxableAmount: decimal('total_taxable_amount', { precision: 15, scale: 2 }).notNull(),
  totalTaxAmount: decimal('total_tax_amount', { precision: 15, scale: 2 }).notNull(),
  reportData: text('report_data'), // JSON data for tax authority format
  submissionStatus: varchar('submission_status', { length: 20 }).notNull().default('DRAFT'),
  submissionDate: timestamp('submission_date'),
  generatedBy: uuid('generated_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
}, (table) => ({
  // Indexes for optimal query performance
  reportTypeIdx: index('tax_reports_type_idx').on(table.reportType),
  periodIdx: index('tax_reports_period_idx').on(table.periodMonth, table.periodYear),
  statusIdx: index('tax_reports_status_idx').on(table.submissionStatus),
  generatedByIdx: index('tax_reports_generated_by_idx').on(table.generatedBy)
}));

// Relations
export const taxConfigurationsRelations = relations(taxConfigurations, ({ one, many }) => ({
  createdByUser: one(users, {
    fields: [taxConfigurations.createdBy],
    references: [users.id]
  }),
  calculations: many(taxCalculations)
}));

export const taxCalculationsRelations = relations(taxCalculations, ({ one }) => ({
  transaction: one(transactions, {
    fields: [taxCalculations.transactionId],
    references: [transactions.id]
  }),
  taxConfiguration: one(taxConfigurations, {
    fields: [taxCalculations.taxConfigurationId],
    references: [taxConfigurations.id]
  }),
  calculatedByUser: one(users, {
    fields: [taxCalculations.calculatedBy],
    references: [users.id]
  })
}));

export const taxReportsRelations = relations(taxReports, ({ one }) => ({
  generatedByUser: one(users, {
    fields: [taxReports.generatedBy],
    references: [users.id]
  })
}));

// Helper functions for Indonesian tax compliance
export function validateIndonesianTaxType(taxType: string): taxType is IndonesianTaxType {
  return Object.values(indonesianTaxTypeEnum).includes(taxType as IndonesianTaxType);
}

export function validateVATTransactionType(transactionType: string): transactionType is VATTransactionType {
  return Object.values(vatTransactionTypeEnum).includes(transactionType as VATTransactionType);
}

// Standard Indonesian VAT rates (as of 2024)
export const standardIndonesianVATRates = {
  [vatTransactionTypeEnum.STANDARD]: 0.11,      // 11% standard VAT
  [vatTransactionTypeEnum.ZERO_RATED]: 0.00,    // 0% for exports
  [vatTransactionTypeEnum.EXEMPT]: 0.00,        // 0% for exempt goods/services
  [vatTransactionTypeEnum.LUXURY]: 0.11,        // 11% + luxury tax (calculated separately)
  [vatTransactionTypeEnum.IMPORT]: 0.11,        // 11% import VAT
  [vatTransactionTypeEnum.EXPORT]: 0.00         // 0% for exports
} as const;