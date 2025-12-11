import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { db } from '../db/connection';
import { 
  taxCalculations, 
  taxReports, 
  taxConfigurations,
  IndonesianTaxType,
  VATTransactionType,
  indonesianTaxTypeEnum,
  vatTransactionTypeEnum
} from '../db/schema/tax';
import { transactions, journalEntries } from '../db/schema/transactions';
import { accounts } from '../db/schema/accounts';

export interface TaxReportPeriod {
  month: number;
  year: number;
}

export interface VATReportData {
  period: TaxReportPeriod;
  totalSales: string;
  totalPurchases: string;
  outputVAT: string;
  inputVAT: string;
  netVAT: string;
  transactions: VATTransactionSummary[];
}

export interface VATTransactionSummary {
  transactionId: string;
  date: Date;
  description: string;
  baseAmount: string;
  vatAmount: string;
  transactionType: VATTransactionType;
  accountCode: string;
  accountName: string;
}

export interface SPTMasaPPNData {
  reportId: string;
  companyName: string;
  companyNPWP: string;
  period: TaxReportPeriod;
  totalTaxableOutput: string;
  totalOutputVAT: string;
  totalTaxableInput: string;
  totalInputVAT: string;
  netVATPayable: string;
  previousPeriodCredit: string;
  currentPeriodPayment: string;
  reportData: any;
  submissionStatus: string;
}

export interface TaxFilingExport {
  filename: string;
  format: 'CSV' | 'XML' | 'JSON';
  content: string;
  metadata: {
    reportType: string;
    period: TaxReportPeriod;
    generatedAt: Date;
    totalRecords: number;
  };
}

export class IndonesianTaxReportService {
  /**
   * Generate VAT report for Indonesian compliance (SPT Masa PPN)
   */
  async generateVATReport(
    period: TaxReportPeriod,
    generatedBy: string
  ): Promise<VATReportData> {
    // Validate period
    this.validateReportPeriod(period);

    // Get date range for the period
    const { startDate, endDate } = this.getPeriodDateRange(period);

    // Get all VAT calculations for the period
    const vatCalculations = await this.getVATCalculationsForPeriod(startDate, endDate);

    // Categorize transactions
    const outputTransactions = vatCalculations.filter(calc => 
      this.isOutputVATTransaction(calc.transactionType)
    );
    
    const inputTransactions = vatCalculations.filter(calc => 
      this.isInputVATTransaction(calc.transactionType)
    );

    // Calculate totals
    const totalSales = this.sumTransactionAmounts(outputTransactions, 'base');
    const totalPurchases = this.sumTransactionAmounts(inputTransactions, 'base');
    const outputVAT = this.sumTransactionAmounts(outputTransactions, 'vat');
    const inputVAT = this.sumTransactionAmounts(inputTransactions, 'vat');
    const netVAT = (parseFloat(outputVAT) - parseFloat(inputVAT)).toFixed(2);

    // Prepare transaction summaries
    const transactions = vatCalculations.map(calc => ({
      transactionId: calc.transactionId,
      date: calc.calculationDate,
      description: calc.description || 'VAT Transaction',
      baseAmount: calc.baseAmount,
      vatAmount: calc.taxAmount,
      transactionType: calc.transactionType,
      accountCode: calc.accountCode || '',
      accountName: calc.accountName || ''
    }));

    return {
      period,
      totalSales,
      totalPurchases,
      outputVAT,
      inputVAT,
      netVAT,
      transactions
    };
  }

  /**
   * Generate SPT Masa PPN (Monthly VAT Return) for Indonesian tax authority
   */
  async generateSPTMasaPPN(
    period: TaxReportPeriod,
    companyInfo: { name: string; npwp: string },
    generatedBy: string
  ): Promise<SPTMasaPPNData> {
    // Generate VAT report data
    const vatReport = await this.generateVATReport(period, generatedBy);

    // Calculate additional fields for SPT Masa PPN
    const totalTaxableOutput = vatReport.totalSales;
    const totalOutputVAT = vatReport.outputVAT;
    const totalTaxableInput = vatReport.totalPurchases;
    const totalInputVAT = vatReport.inputVAT;
    const netVATPayable = vatReport.netVAT;

    // Get previous period credit (simplified - would normally come from previous reports)
    const previousPeriodCredit = '0.00';
    const currentPeriodPayment = parseFloat(netVATPayable) > 0 ? netVATPayable : '0.00';

    // Prepare report data in Indonesian tax authority format
    const reportData = {
      header: {
        reportType: 'SPT_MASA_PPN',
        period: `${period.month.toString().padStart(2, '0')}/${period.year}`,
        companyName: companyInfo.name,
        npwp: companyInfo.npwp,
        submissionDate: new Date().toISOString()
      },
      summary: {
        totalTaxableOutput,
        totalOutputVAT,
        totalTaxableInput,
        totalInputVAT,
        netVATPayable,
        previousPeriodCredit,
        currentPeriodPayment
      },
      transactions: vatReport.transactions.map(tx => ({
        transactionId: tx.transactionId,
        date: tx.date.toISOString().split('T')[0],
        description: tx.description,
        baseAmount: tx.baseAmount,
        vatAmount: tx.vatAmount,
        transactionType: tx.transactionType,
        accountCode: tx.accountCode
      }))
    };

    // Store report in database
    const [report] = await db.insert(taxReports).values({
      reportType: 'SPT_MASA_PPN',
      periodMonth: period.month.toString().padStart(2, '0'),
      periodYear: period.year.toString(),
      totalTaxableAmount: totalTaxableOutput,
      totalTaxAmount: totalOutputVAT,
      reportData: JSON.stringify(reportData),
      submissionStatus: 'DRAFT',
      generatedBy,
      updatedAt: new Date()
    }).returning();

    return {
      reportId: report.id,
      companyName: companyInfo.name,
      companyNPWP: companyInfo.npwp,
      period,
      totalTaxableOutput,
      totalOutputVAT,
      totalTaxableInput,
      totalInputVAT,
      netVATPayable,
      previousPeriodCredit,
      currentPeriodPayment,
      reportData,
      submissionStatus: report.submissionStatus
    };
  }

  /**
   * Export tax filing in format compatible with Indonesian tax systems
   */
  async exportTaxFiling(
    reportId: string,
    format: 'CSV' | 'XML' | 'JSON'
  ): Promise<TaxFilingExport> {
    // Get report data
    const [report] = await db
      .select()
      .from(taxReports)
      .where(eq(taxReports.id, reportId));

    if (!report) {
      throw new Error(`Tax report with ID ${reportId} not found`);
    }

    const reportData = JSON.parse(report.reportData || '{}');
    const period = { month: parseInt(report.periodMonth), year: parseInt(report.periodYear) };

    let content: string;
    let filename: string;

    switch (format) {
      case 'CSV':
        content = this.generateCSVExport(reportData);
        filename = `SPT_MASA_PPN_${report.periodYear}${report.periodMonth}.csv`;
        break;
      
      case 'XML':
        content = this.generateXMLExport(reportData);
        filename = `SPT_MASA_PPN_${report.periodYear}${report.periodMonth}.xml`;
        break;
      
      case 'JSON':
        content = JSON.stringify(reportData, null, 2);
        filename = `SPT_MASA_PPN_${report.periodYear}${report.periodMonth}.json`;
        break;
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }

    return {
      filename,
      format,
      content,
      metadata: {
        reportType: report.reportType,
        period,
        generatedAt: new Date(),
        totalRecords: reportData.transactions?.length || 0
      }
    };
  }

  /**
   * Update report submission status
   */
  async updateSubmissionStatus(
    reportId: string,
    status: 'DRAFT' | 'SUBMITTED' | 'ACCEPTED' | 'REJECTED',
    updatedBy: string
  ): Promise<void> {
    await db.update(taxReports)
      .set({
        submissionStatus: status,
        submissionDate: status === 'SUBMITTED' ? new Date() : undefined,
        updatedAt: new Date()
      })
      .where(eq(taxReports.id, reportId));
  }

  /**
   * Get tax calculation audit trail for compliance verification
   */
  async getTaxCalculationAuditTrail(
    period: TaxReportPeriod
  ): Promise<Array<{
    calculationId: string;
    transactionId: string;
    calculationDate: Date;
    baseAmount: string;
    taxRate: string;
    taxAmount: string;
    calculatedBy: string;
    configurationUsed: string;
  }>> {
    const { startDate, endDate } = this.getPeriodDateRange(period);

    const auditTrail = await db
      .select({
        calculationId: taxCalculations.id,
        transactionId: taxCalculations.transactionId,
        calculationDate: taxCalculations.calculationDate,
        baseAmount: taxCalculations.baseAmount,
        taxRate: taxCalculations.taxRate,
        taxAmount: taxCalculations.taxAmount,
        calculatedBy: taxCalculations.calculatedBy,
        configurationId: taxCalculations.taxConfigurationId,
        configDescription: taxConfigurations.description
      })
      .from(taxCalculations)
      .innerJoin(taxConfigurations, eq(taxCalculations.taxConfigurationId, taxConfigurations.id))
      .where(
        and(
          gte(taxCalculations.calculationDate, startDate),
          lte(taxCalculations.calculationDate, endDate)
        )
      )
      .orderBy(desc(taxCalculations.calculationDate));

    return auditTrail.map(item => ({
      calculationId: item.calculationId,
      transactionId: item.transactionId || '',
      calculationDate: item.calculationDate,
      baseAmount: item.baseAmount,
      taxRate: item.taxRate,
      taxAmount: item.taxAmount,
      calculatedBy: item.calculatedBy,
      configurationUsed: item.configDescription || item.configurationId
    }));
  }

  /**
   * Validate report period
   */
  private validateReportPeriod(period: TaxReportPeriod): void {
    if (period.month < 1 || period.month > 12) {
      throw new Error('Invalid month: must be between 1 and 12');
    }

    if (period.year < 2000 || period.year > new Date().getFullYear() + 1) {
      throw new Error('Invalid year');
    }
  }

  /**
   * Get date range for report period
   */
  private getPeriodDateRange(period: TaxReportPeriod): { startDate: Date; endDate: Date } {
    const startDate = new Date(period.year, period.month - 1, 1);
    const endDate = new Date(period.year, period.month, 0, 23, 59, 59, 999);
    
    return { startDate, endDate };
  }

  /**
   * Get VAT calculations for period with transaction details
   */
  private async getVATCalculationsForPeriod(startDate: Date, endDate: Date): Promise<Array<{
    transactionId: string;
    calculationDate: Date;
    baseAmount: string;
    taxAmount: string;
    transactionType: VATTransactionType;
    description?: string;
    accountCode?: string;
    accountName?: string;
  }>> {
    const calculations = await db
      .select({
        transactionId: taxCalculations.transactionId,
        calculationDate: taxCalculations.calculationDate,
        baseAmount: taxCalculations.baseAmount,
        taxAmount: taxCalculations.taxAmount,
        transactionType: taxConfigurations.transactionType,
        transactionDescription: transactions.description,
        accountCode: accounts.code,
        accountName: accounts.name
      })
      .from(taxCalculations)
      .innerJoin(taxConfigurations, eq(taxCalculations.taxConfigurationId, taxConfigurations.id))
      .leftJoin(transactions, eq(taxCalculations.transactionId, transactions.id))
      .leftJoin(journalEntries, eq(transactions.id, journalEntries.transactionId))
      .leftJoin(accounts, eq(journalEntries.accountId, accounts.id))
      .where(
        and(
          eq(taxConfigurations.taxType, indonesianTaxTypeEnum.VAT),
          gte(taxCalculations.calculationDate, startDate),
          lte(taxCalculations.calculationDate, endDate)
        )
      )
      .orderBy(desc(taxCalculations.calculationDate));

    return calculations.map(calc => ({
      transactionId: calc.transactionId || '',
      calculationDate: calc.calculationDate,
      baseAmount: calc.baseAmount,
      taxAmount: calc.taxAmount,
      transactionType: calc.transactionType as VATTransactionType,
      description: calc.transactionDescription || undefined,
      accountCode: calc.accountCode || undefined,
      accountName: calc.accountName || undefined
    }));
  }

  /**
   * Check if transaction type is output VAT (sales)
   */
  private isOutputVATTransaction(transactionType: VATTransactionType): boolean {
    return [
      vatTransactionTypeEnum.STANDARD,
      vatTransactionTypeEnum.LUXURY,
      vatTransactionTypeEnum.EXPORT
    ].includes(transactionType);
  }

  /**
   * Check if transaction type is input VAT (purchases)
   */
  private isInputVATTransaction(transactionType: VATTransactionType): boolean {
    return [
      vatTransactionTypeEnum.IMPORT,
      vatTransactionTypeEnum.STANDARD // When purchasing
    ].includes(transactionType);
  }

  /**
   * Sum transaction amounts by type
   */
  private sumTransactionAmounts(
    transactions: Array<{ baseAmount: string; taxAmount: string }>,
    type: 'base' | 'vat'
  ): string {
    const total = transactions.reduce((sum, tx) => {
      const amount = type === 'base' ? parseFloat(tx.baseAmount) : parseFloat(tx.taxAmount);
      return sum + amount;
    }, 0);

    return total.toFixed(2);
  }

  /**
   * Generate CSV export for Indonesian tax authority
   */
  private generateCSVExport(reportData: any): string {
    const header = 'Transaction ID,Date,Description,Base Amount,VAT Amount,Transaction Type,Account Code\n';
    
    const rows = reportData.transactions.map((tx: any) => 
      `${tx.transactionId},${tx.date},${tx.description},${tx.baseAmount},${tx.vatAmount},${tx.transactionType},${tx.accountCode}`
    ).join('\n');

    return header + rows;
  }

  /**
   * Generate XML export for Indonesian tax authority
   */
  private generateXMLExport(reportData: any): string {
    const header = reportData.header;
    const summary = reportData.summary;
    
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<SPTMasaPPN>\n';
    xml += '  <Header>\n';
    xml += `    <ReportType>${header.reportType}</ReportType>\n`;
    xml += `    <Period>${header.period}</Period>\n`;
    xml += `    <CompanyName>${header.companyName}</CompanyName>\n`;
    xml += `    <NPWP>${header.npwp}</NPWP>\n`;
    xml += `    <SubmissionDate>${header.submissionDate}</SubmissionDate>\n`;
    xml += '  </Header>\n';
    xml += '  <Summary>\n';
    xml += `    <TotalTaxableOutput>${summary.totalTaxableOutput}</TotalTaxableOutput>\n`;
    xml += `    <TotalOutputVAT>${summary.totalOutputVAT}</TotalOutputVAT>\n`;
    xml += `    <TotalTaxableInput>${summary.totalTaxableInput}</TotalTaxableInput>\n`;
    xml += `    <TotalInputVAT>${summary.totalInputVAT}</TotalInputVAT>\n`;
    xml += `    <NetVATPayable>${summary.netVATPayable}</NetVATPayable>\n`;
    xml += '  </Summary>\n';
    xml += '  <Transactions>\n';
    
    reportData.transactions.forEach((tx: any) => {
      xml += '    <Transaction>\n';
      xml += `      <ID>${tx.transactionId}</ID>\n`;
      xml += `      <Date>${tx.date}</Date>\n`;
      xml += `      <Description>${tx.description}</Description>\n`;
      xml += `      <BaseAmount>${tx.baseAmount}</BaseAmount>\n`;
      xml += `      <VATAmount>${tx.vatAmount}</VATAmount>\n`;
      xml += `      <Type>${tx.transactionType}</Type>\n`;
      xml += `      <AccountCode>${tx.accountCode}</AccountCode>\n`;
      xml += '    </Transaction>\n';
    });
    
    xml += '  </Transactions>\n';
    xml += '</SPTMasaPPN>';
    
    return xml;
  }
}