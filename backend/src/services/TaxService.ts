import { eq, and, desc, lte, gte, isNull, or } from 'drizzle-orm';
import { db } from '../db/connection';
import { 
  taxConfigurations, 
  taxCalculations, 
  taxReports,
  IndonesianTaxType, 
  VATTransactionType,
  indonesianTaxTypeEnum,
  vatTransactionTypeEnum,
  standardIndonesianVATRates,
  validateIndonesianTaxType,
  validateVATTransactionType
} from '../db/schema/tax';

export interface VATCalculationInput {
  baseAmount: string;
  transactionType: VATTransactionType;
  transactionDate: Date;
  transactionId?: string;
  calculatedBy: string;
  notes?: string;
}

export interface VATCalculationResult {
  id: string;
  baseAmount: string;
  taxRate: string;
  taxAmount: string;
  totalAmount: string;
  transactionType: VATTransactionType;
  taxConfigurationId: string;
  calculationDate: Date;
  isExempt: boolean;
}

export interface TaxConfiguration {
  id: string;
  taxType: IndonesianTaxType;
  transactionType?: VATTransactionType;
  rate: string;
  effectiveDate: Date;
  expiryDate?: Date;
  isActive: boolean;
  description?: string;
  legalReference?: string;
}

export interface TaxRateUpdate {
  taxType: IndonesianTaxType;
  transactionType?: VATTransactionType;
  newRate: string;
  effectiveDate: Date;
  description?: string;
  legalReference?: string;
  updatedBy: string;
}

export interface TaxReportData {
  reportType: string;
  periodMonth: string;
  periodYear: string;
  totalTaxableAmount: string;
  totalTaxAmount: string;
  reportData?: any;
  generatedBy: string;
}

export class TaxService {
  /**
   * Calculate VAT for Indonesian transactions with compliance validation
   */
  async calculateVAT(input: VATCalculationInput): Promise<VATCalculationResult> {
    // Validate transaction type
    if (!validateVATTransactionType(input.transactionType)) {
      throw new Error(`Invalid VAT transaction type: ${input.transactionType}`);
    }

    // Validate base amount
    const baseAmount = parseFloat(input.baseAmount);
    if (baseAmount < 0) {
      throw new Error('Base amount cannot be negative');
    }

    // Get applicable tax configuration
    const taxConfig = await this.getApplicableTaxRate(
      indonesianTaxTypeEnum.VAT,
      input.transactionType,
      input.transactionDate
    );

    if (!taxConfig) {
      throw new Error(`No VAT configuration found for transaction type ${input.transactionType} on ${input.transactionDate.toISOString()}`);
    }

    // Calculate tax amounts
    const taxRate = parseFloat(taxConfig.rate);
    const taxAmount = baseAmount * taxRate;
    const totalAmount = baseAmount + taxAmount;

    // Check if transaction is exempt
    const isExempt = taxRate === 0 || input.transactionType === vatTransactionTypeEnum.EXEMPT;

    // Store calculation for audit trail
    const [calculation] = await db.insert(taxCalculations).values({
      transactionId: input.transactionId || null,
      taxConfigurationId: taxConfig.id,
      baseAmount: input.baseAmount,
      taxRate: taxConfig.rate,
      taxAmount: taxAmount.toFixed(2),
      totalAmount: totalAmount.toFixed(2),
      calculatedBy: input.calculatedBy,
      notes: input.notes || null
    }).returning();

    return {
      id: calculation.id,
      baseAmount: input.baseAmount,
      taxRate: taxConfig.rate,
      taxAmount: taxAmount.toFixed(2),
      totalAmount: totalAmount.toFixed(2),
      transactionType: input.transactionType,
      taxConfigurationId: taxConfig.id,
      calculationDate: calculation.calculationDate,
      isExempt
    };
  }

  /**
   * Get applicable tax rate for specific date and transaction type
   */
  async getApplicableTaxRate(
    taxType: IndonesianTaxType,
    transactionType?: VATTransactionType,
    effectiveDate?: Date
  ): Promise<TaxConfiguration | null> {
    const queryDate = effectiveDate || new Date();

    let query = db
      .select()
      .from(taxConfigurations)
      .where(
        and(
          eq(taxConfigurations.taxType, taxType),
          eq(taxConfigurations.isActive, true),
          lte(taxConfigurations.effectiveDate, queryDate),
          or(
            isNull(taxConfigurations.expiryDate),
            gte(taxConfigurations.expiryDate, queryDate)
          )
        )
      );

    // Add transaction type filter if specified
    if (transactionType) {
      query = query.where(
        and(
          eq(taxConfigurations.taxType, taxType),
          eq(taxConfigurations.transactionType, transactionType),
          eq(taxConfigurations.isActive, true),
          lte(taxConfigurations.effectiveDate, queryDate),
          or(
            isNull(taxConfigurations.expiryDate),
            gte(taxConfigurations.expiryDate, queryDate)
          )
        )
      );
    }

    const configs = await query.orderBy(desc(taxConfigurations.effectiveDate)).limit(1);

    if (configs.length === 0) {
      return null;
    }

    const config = configs[0];
    return {
      id: config.id,
      taxType: config.taxType,
      transactionType: config.transactionType || undefined,
      rate: config.rate,
      effectiveDate: config.effectiveDate,
      expiryDate: config.expiryDate || undefined,
      isActive: config.isActive,
      description: config.description || undefined,
      legalReference: config.legalReference || undefined
    };
  }

  /**
   * Update tax rates with historical preservation
   */
  async updateTaxRate(update: TaxRateUpdate): Promise<TaxConfiguration> {
    // Validate inputs
    if (!validateIndonesianTaxType(update.taxType)) {
      throw new Error(`Invalid tax type: ${update.taxType}`);
    }

    if (update.transactionType && !validateVATTransactionType(update.transactionType)) {
      throw new Error(`Invalid transaction type: ${update.transactionType}`);
    }

    const newRate = parseFloat(update.newRate);
    if (newRate < 0 || newRate > 1) {
      throw new Error('Tax rate must be between 0 and 1 (0% to 100%)');
    }

    // Check if there's an existing active configuration
    const existingConfig = await this.getApplicableTaxRate(
      update.taxType,
      update.transactionType,
      new Date()
    );

    // If there's an existing config and the new effective date is in the future,
    // set expiry date on the existing config
    if (existingConfig && update.effectiveDate > new Date()) {
      const expiryDate = new Date(update.effectiveDate.getTime() - 1); // Day before new rate takes effect
      
      await db.update(taxConfigurations)
        .set({
          expiryDate,
          updatedAt: new Date()
        })
        .where(eq(taxConfigurations.id, existingConfig.id));
    }

    // Create new tax configuration
    const [newConfig] = await db.insert(taxConfigurations).values({
      taxType: update.taxType,
      transactionType: update.transactionType || null,
      rate: update.newRate,
      effectiveDate: update.effectiveDate,
      description: update.description || null,
      legalReference: update.legalReference || null,
      createdBy: update.updatedBy,
      updatedAt: new Date()
    }).returning();

    return {
      id: newConfig.id,
      taxType: newConfig.taxType,
      transactionType: newConfig.transactionType || undefined,
      rate: newConfig.rate,
      effectiveDate: newConfig.effectiveDate,
      expiryDate: newConfig.expiryDate || undefined,
      isActive: newConfig.isActive,
      description: newConfig.description || undefined,
      legalReference: newConfig.legalReference || undefined
    };
  }

  /**
   * Initialize standard Indonesian VAT rates
   */
  async initializeStandardVATRates(createdBy: string): Promise<TaxConfiguration[]> {
    const configurations: TaxConfiguration[] = [];
    const effectiveDate = new Date('2024-01-01'); // Standard rates effective from 2024

    for (const [transactionType, rate] of Object.entries(standardIndonesianVATRates)) {
      try {
        const config = await this.updateTaxRate({
          taxType: indonesianTaxTypeEnum.VAT,
          transactionType: transactionType as VATTransactionType,
          newRate: rate.toString(),
          effectiveDate,
          description: `Standard Indonesian VAT rate for ${transactionType} transactions`,
          legalReference: 'UU No. 42 Tahun 2009 tentang PPN dan PPnBM',
          updatedBy: createdBy
        });

        configurations.push(config);
      } catch (error) {
        console.error(`Failed to initialize VAT rate for ${transactionType}:`, error);
      }
    }

    return configurations;
  }

  /**
   * Calculate VAT for multiple transactions (batch processing)
   */
  async calculateBatchVAT(inputs: VATCalculationInput[]): Promise<VATCalculationResult[]> {
    const results: VATCalculationResult[] = [];

    for (const input of inputs) {
      try {
        const result = await this.calculateVAT(input);
        results.push(result);
      } catch (error) {
        throw new Error(`Batch VAT calculation failed for transaction ${input.transactionId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return results;
  }

  /**
   * Get VAT calculation history for a transaction
   */
  async getVATCalculationHistory(transactionId: string): Promise<VATCalculationResult[]> {
    const calculations = await db
      .select({
        id: taxCalculations.id,
        baseAmount: taxCalculations.baseAmount,
        taxRate: taxCalculations.taxRate,
        taxAmount: taxCalculations.taxAmount,
        totalAmount: taxCalculations.totalAmount,
        calculationDate: taxCalculations.calculationDate,
        taxConfigurationId: taxCalculations.taxConfigurationId,
        transactionType: taxConfigurations.transactionType
      })
      .from(taxCalculations)
      .innerJoin(taxConfigurations, eq(taxCalculations.taxConfigurationId, taxConfigurations.id))
      .where(eq(taxCalculations.transactionId, transactionId))
      .orderBy(desc(taxCalculations.calculationDate));

    return calculations.map(calc => ({
      id: calc.id,
      baseAmount: calc.baseAmount,
      taxRate: calc.taxRate,
      taxAmount: calc.taxAmount,
      totalAmount: calc.totalAmount,
      transactionType: calc.transactionType as VATTransactionType,
      taxConfigurationId: calc.taxConfigurationId,
      calculationDate: calc.calculationDate,
      isExempt: parseFloat(calc.taxRate) === 0
    }));
  }

  /**
   * Validate VAT calculation consistency
   */
  validateVATCalculation(
    baseAmount: number,
    taxRate: number,
    taxAmount: number,
    totalAmount: number
  ): boolean {
    const expectedTaxAmount = baseAmount * taxRate;
    const expectedTotalAmount = baseAmount + expectedTaxAmount;

    // Allow for small floating point differences
    const taxAmountDiff = Math.abs(taxAmount - expectedTaxAmount);
    const totalAmountDiff = Math.abs(totalAmount - expectedTotalAmount);

    return taxAmountDiff < 0.01 && totalAmountDiff < 0.01;
  }

  /**
   * Get all active tax configurations
   */
  async getActiveTaxConfigurations(): Promise<TaxConfiguration[]> {
    const configs = await db
      .select()
      .from(taxConfigurations)
      .where(eq(taxConfigurations.isActive, true))
      .orderBy(taxConfigurations.taxType, taxConfigurations.transactionType, desc(taxConfigurations.effectiveDate));

    return configs.map(config => ({
      id: config.id,
      taxType: config.taxType,
      transactionType: config.transactionType || undefined,
      rate: config.rate,
      effectiveDate: config.effectiveDate,
      expiryDate: config.expiryDate || undefined,
      isActive: config.isActive,
      description: config.description || undefined,
      legalReference: config.legalReference || undefined
    }));
  }

  /**
   * Generate tax report for Indonesian compliance
   */
  async generateTaxReport(reportData: TaxReportData): Promise<string> {
    // Validate period
    const month = parseInt(reportData.periodMonth);
    const year = parseInt(reportData.periodYear);

    if (month < 1 || month > 12) {
      throw new Error('Invalid month: must be between 1 and 12');
    }

    if (year < 2000 || year > new Date().getFullYear() + 1) {
      throw new Error('Invalid year');
    }

    // Create tax report record
    const [report] = await db.insert(taxReports).values({
      reportType: reportData.reportType,
      periodMonth: reportData.periodMonth.padStart(2, '0'),
      periodYear: reportData.periodYear,
      totalTaxableAmount: reportData.totalTaxableAmount,
      totalTaxAmount: reportData.totalTaxAmount,
      reportData: reportData.reportData ? JSON.stringify(reportData.reportData) : null,
      generatedBy: reportData.generatedBy,
      updatedAt: new Date()
    }).returning();

    return report.id;
  }

  /**
   * Get tax exemption status for transaction type
   */
  isTransactionExempt(transactionType: VATTransactionType): boolean {
    return transactionType === vatTransactionTypeEnum.EXEMPT || 
           transactionType === vatTransactionTypeEnum.ZERO_RATED ||
           transactionType === vatTransactionTypeEnum.EXPORT;
  }

  /**
   * Calculate luxury tax (PPnBM) for applicable goods
   */
  async calculateLuxuryTax(
    baseAmount: string,
    luxuryTaxRate: string,
    calculatedBy: string
  ): Promise<{ luxuryTaxAmount: string; totalWithLuxuryTax: string }> {
    const base = parseFloat(baseAmount);
    const rate = parseFloat(luxuryTaxRate);

    if (base < 0 || rate < 0) {
      throw new Error('Base amount and luxury tax rate must be non-negative');
    }

    const luxuryTaxAmount = base * rate;
    const totalWithLuxuryTax = base + luxuryTaxAmount;

    return {
      luxuryTaxAmount: luxuryTaxAmount.toFixed(2),
      totalWithLuxuryTax: totalWithLuxuryTax.toFixed(2)
    };
  }
}