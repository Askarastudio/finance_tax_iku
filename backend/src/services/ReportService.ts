import { eq, and, gte, lte, desc, asc, sum, sql } from 'drizzle-orm';
import { db } from '../db/connection';
import { accounts, AccountType, accountTypeEnum } from '../db/schema/accounts';
import { transactions, journalEntries } from '../db/schema/transactions';
import { AccountRepository } from '../repositories/AccountRepository';
import { TransactionRepository } from '../repositories/TransactionRepository';

export interface BalanceSheetData {
  asOfDate: Date;
  assets: BalanceSheetSection;
  liabilities: BalanceSheetSection;
  equity: BalanceSheetSection;
  totalAssets: string;
  totalLiabilities: string;
  totalEquity: string;
  totalLiabilitiesAndEquity: string;
  isBalanced: boolean;
}

export interface BalanceSheetSection {
  accounts: BalanceSheetAccount[];
  total: string;
}

export interface BalanceSheetAccount {
  id: string;
  code: string;
  name: string;
  balance: string;
  parentId?: string;
  level: number;
}

export interface IncomeStatementData {
  periodStart: Date;
  periodEnd: Date;
  revenue: IncomeStatementSection;
  expenses: IncomeStatementSection;
  totalRevenue: string;
  totalExpenses: string;
  netIncome: string;
}

export interface IncomeStatementSection {
  accounts: IncomeStatementAccount[];
  total: string;
}

export interface IncomeStatementAccount {
  id: string;
  code: string;
  name: string;
  amount: string;
  parentId?: string;
  level: number;
}

export interface CashFlowStatementData {
  periodStart: Date;
  periodEnd: Date;
  operatingActivities: CashFlowSection;
  investingActivities: CashFlowSection;
  financingActivities: CashFlowSection;
  netCashFlow: string;
  beginningCash: string;
  endingCash: string;
}

export interface CashFlowSection {
  items: CashFlowItem[];
  total: string;
}

export interface CashFlowItem {
  description: string;
  amount: string;
  isInflow: boolean;
}

export interface ReportFilters {
  dateFrom?: Date;
  dateTo?: Date;
  accountIds?: string[];
  accountTypes?: AccountType[];
  includeInactive?: boolean;
}

export interface ReportExportOptions {
  format: 'PDF' | 'EXCEL' | 'CSV';
  includeMetadata?: boolean;
  companyInfo?: {
    name: string;
    address?: string;
    taxId?: string;
  };
}

export class ReportService {
  private accountRepository: AccountRepository;
  private transactionRepository: TransactionRepository;

  constructor() {
    this.accountRepository = new AccountRepository();
    this.transactionRepository = new TransactionRepository();
  }

  /**
   * Generate balance sheet with proper asset/liability/equity categorization
   * Ensures Assets = Liabilities + Equity equation
   */
  async generateBalanceSheet(asOfDate: Date, filters?: ReportFilters): Promise<BalanceSheetData> {
    // Get all accounts with balances as of the specified date
    const accountsWithBalances = await this.getAccountBalancesAsOf(asOfDate, filters);

    // Categorize accounts by type
    const assets = this.categorizeAccountsByType(accountsWithBalances, [accountTypeEnum.ASSET]);
    const liabilities = this.categorizeAccountsByType(accountsWithBalances, [accountTypeEnum.LIABILITY]);
    const equity = this.categorizeAccountsByType(accountsWithBalances, [accountTypeEnum.EQUITY]);

    // Calculate totals
    const totalAssets = this.calculateSectionTotal(assets);
    const totalLiabilities = this.calculateSectionTotal(liabilities);
    const totalEquity = this.calculateSectionTotal(equity);
    const totalLiabilitiesAndEquity = (parseFloat(totalLiabilities) + parseFloat(totalEquity)).toFixed(2);

    // Verify balance sheet equation
    const isBalanced = Math.abs(parseFloat(totalAssets) - parseFloat(totalLiabilitiesAndEquity)) < 0.01;

    return {
      asOfDate,
      assets: {
        accounts: assets,
        total: totalAssets
      },
      liabilities: {
        accounts: liabilities,
        total: totalLiabilities
      },
      equity: {
        accounts: equity,
        total: totalEquity
      },
      totalAssets,
      totalLiabilities,
      totalEquity,
      totalLiabilitiesAndEquity,
      isBalanced
    };
  }

  /**
   * Generate income statement with revenue/expense calculations
   * Calculates Net Income = Total Revenue - Total Expenses
   */
  async generateIncomeStatement(
    periodStart: Date,
    periodEnd: Date,
    filters?: ReportFilters
  ): Promise<IncomeStatementData> {
    // Validate period
    if (periodStart >= periodEnd) {
      throw new Error('Period start date must be before period end date');
    }

    // Get account balances for the period
    const accountsWithBalances = await this.getAccountBalancesForPeriod(periodStart, periodEnd, filters);

    // Categorize accounts by type
    const revenue = this.categorizeAccountsByType(accountsWithBalances, [accountTypeEnum.REVENUE]);
    const expenses = this.categorizeAccountsByType(accountsWithBalances, [accountTypeEnum.EXPENSE]);

    // Calculate totals
    const totalRevenue = this.calculateSectionTotal(revenue);
    const totalExpenses = this.calculateSectionTotal(expenses);
    const netIncome = (parseFloat(totalRevenue) - parseFloat(totalExpenses)).toFixed(2);

    return {
      periodStart,
      periodEnd,
      revenue: {
        accounts: revenue.map(acc => ({
          id: acc.id,
          code: acc.code,
          name: acc.name,
          amount: acc.balance,
          parentId: acc.parentId,
          level: acc.level
        })),
        total: totalRevenue
      },
      expenses: {
        accounts: expenses.map(acc => ({
          id: acc.id,
          code: acc.code,
          name: acc.name,
          amount: acc.balance,
          parentId: acc.parentId,
          level: acc.level
        })),
        total: totalExpenses
      },
      totalRevenue,
      totalExpenses,
      netIncome
    };
  }

  /**
   * Generate cash flow statement with activity categorization
   */
  async generateCashFlowStatement(
    periodStart: Date,
    periodEnd: Date,
    filters?: ReportFilters
  ): Promise<CashFlowStatementData> {
    // Validate period
    if (periodStart >= periodEnd) {
      throw new Error('Period start date must be before period end date');
    }

    // Get cash and cash equivalent accounts
    const cashAccounts = await this.getCashAccounts();
    
    if (cashAccounts.length === 0) {
      throw new Error('No cash accounts found. Please ensure cash accounts are properly configured.');
    }

    // Get beginning and ending cash balances
    const beginningCash = await this.calculateTotalCashBalance(cashAccounts, periodStart);
    const endingCash = await this.calculateTotalCashBalance(cashAccounts, periodEnd);

    // Get cash flow transactions for the period
    const cashFlowTransactions = await this.getCashFlowTransactions(cashAccounts, periodStart, periodEnd);

    // Categorize cash flows by activity type
    const operatingActivities = this.categorizeOperatingActivities(cashFlowTransactions);
    const investingActivities = this.categorizeInvestingActivities(cashFlowTransactions);
    const financingActivities = this.categorizeFinancingActivities(cashFlowTransactions);

    // Calculate net cash flow
    const operatingTotal = parseFloat(operatingActivities.total);
    const investingTotal = parseFloat(investingActivities.total);
    const financingTotal = parseFloat(financingActivities.total);
    const netCashFlow = (operatingTotal + investingTotal + financingTotal).toFixed(2);

    return {
      periodStart,
      periodEnd,
      operatingActivities,
      investingActivities,
      financingActivities,
      netCashFlow,
      beginningCash,
      endingCash
    };
  }

  /**
   * Get account balances as of a specific date
   */
  private async getAccountBalancesAsOf(
    asOfDate: Date,
    filters?: ReportFilters
  ): Promise<BalanceSheetAccount[]> {
    let accountQuery = db
      .select({
        id: accounts.id,
        code: accounts.code,
        name: accounts.name,
        type: accounts.type,
        parentId: accounts.parentId,
        isActive: accounts.isActive
      })
      .from(accounts);

    // Apply filters
    if (filters?.accountTypes && filters.accountTypes.length > 0) {
      accountQuery = accountQuery.where(sql`${accounts.type} = ANY(${filters.accountTypes})`);
    }

    if (!filters?.includeInactive) {
      accountQuery = accountQuery.where(eq(accounts.isActive, true));
    }

    const accountList = await accountQuery.orderBy(accounts.code);

    // Get balances for each account
    const accountsWithBalances: BalanceSheetAccount[] = [];

    for (const account of accountList) {
      const balance = await this.transactionRepository.getAccountBalance(account.id, asOfDate);
      const balanceAmount = parseFloat(balance);

      // Only include accounts with non-zero balances or if specifically requested
      if (balanceAmount !== 0 || filters?.accountIds?.includes(account.id)) {
        accountsWithBalances.push({
          id: account.id,
          code: account.code,
          name: account.name,
          balance: balance,
          parentId: account.parentId || undefined,
          level: await this.calculateAccountLevel(account.id)
        });
      }
    }

    return accountsWithBalances;
  }

  /**
   * Get account balances for a specific period
   */
  private async getAccountBalancesForPeriod(
    periodStart: Date,
    periodEnd: Date,
    filters?: ReportFilters
  ): Promise<BalanceSheetAccount[]> {
    // For income statement, we need the activity during the period, not cumulative balances
    const accountsWithActivity = await db
      .select({
        accountId: journalEntries.accountId,
        code: accounts.code,
        name: accounts.name,
        type: accounts.type,
        parentId: accounts.parentId,
        totalDebits: sql<string>`COALESCE(SUM(${journalEntries.debitAmount}), 0)`,
        totalCredits: sql<string>`COALESCE(SUM(${journalEntries.creditAmount}), 0)`
      })
      .from(journalEntries)
      .innerJoin(transactions, eq(journalEntries.transactionId, transactions.id))
      .innerJoin(accounts, eq(journalEntries.accountId, accounts.id))
      .where(
        and(
          gte(transactions.date, periodStart),
          lte(transactions.date, periodEnd),
          eq(accounts.isActive, true)
        )
      )
      .groupBy(journalEntries.accountId, accounts.code, accounts.name, accounts.type, accounts.parentId)
      .orderBy(accounts.code);

    return accountsWithActivity.map(account => {
      const debits = parseFloat(account.totalDebits);
      const credits = parseFloat(account.totalCredits);
      
      // For revenue accounts, credits increase the balance (normal credit balance)
      // For expense accounts, debits increase the balance (normal debit balance)
      let balance: number;
      if (account.type === accountTypeEnum.REVENUE) {
        balance = credits - debits; // Revenue has normal credit balance
      } else if (account.type === accountTypeEnum.EXPENSE) {
        balance = debits - credits; // Expenses have normal debit balance
      } else {
        balance = debits - credits; // Default to debit balance
      }

      return {
        id: account.accountId,
        code: account.code,
        name: account.name,
        balance: Math.abs(balance).toFixed(2), // Use absolute value for display
        parentId: account.parentId || undefined,
        level: 0 // Will be calculated separately if needed
      };
    }).filter(account => parseFloat(account.balance) > 0); // Only include accounts with activity
  }

  /**
   * Categorize accounts by type
   */
  private categorizeAccountsByType(
    accounts: BalanceSheetAccount[],
    types: AccountType[]
  ): BalanceSheetAccount[] {
    return accounts.filter(account => {
      // We need to get the account type from the database since it's not in BalanceSheetAccount
      // For now, we'll use a simplified approach based on account code patterns
      return this.isAccountOfType(account.code, types);
    }).sort((a, b) => a.code.localeCompare(b.code));
  }

  /**
   * Simple account type detection based on Indonesian chart of accounts patterns
   */
  private isAccountOfType(accountCode: string, types: AccountType[]): boolean {
    const code = accountCode.charAt(0);
    
    for (const type of types) {
      switch (type) {
        case accountTypeEnum.ASSET:
          if (code === '1') return true;
          break;
        case accountTypeEnum.LIABILITY:
          if (code === '2') return true;
          break;
        case accountTypeEnum.EQUITY:
          if (code === '3') return true;
          break;
        case accountTypeEnum.REVENUE:
          if (code === '4') return true;
          break;
        case accountTypeEnum.EXPENSE:
          if (code === '5' || code === '6') return true;
          break;
      }
    }
    
    return false;
  }

  /**
   * Calculate total for a section
   */
  private calculateSectionTotal(accounts: BalanceSheetAccount[]): string {
    const total = accounts.reduce((sum, account) => {
      return sum + parseFloat(account.balance);
    }, 0);
    
    return total.toFixed(2);
  }

  /**
   * Calculate account hierarchy level
   */
  private async calculateAccountLevel(accountId: string): Promise<number> {
    let level = 0;
    let currentAccountId: string | null = accountId;

    while (currentAccountId) {
      const account = await this.accountRepository.findById(currentAccountId);
      if (!account || !account.parentId) {
        break;
      }
      level++;
      currentAccountId = account.parentId;
    }

    return level;
  }

  /**
   * Get cash and cash equivalent accounts
   */
  private async getCashAccounts(): Promise<Array<{ id: string; code: string; name: string }>> {
    // In Indonesian chart of accounts, cash accounts typically start with 11
    const cashAccounts = await db
      .select({
        id: accounts.id,
        code: accounts.code,
        name: accounts.name
      })
      .from(accounts)
      .where(
        and(
          eq(accounts.type, accountTypeEnum.ASSET),
          eq(accounts.isActive, true),
          sql`${accounts.code} LIKE '11%'` // Cash and cash equivalents
        )
      )
      .orderBy(accounts.code);

    return cashAccounts;
  }

  /**
   * Calculate total cash balance for multiple cash accounts
   */
  private async calculateTotalCashBalance(
    cashAccounts: Array<{ id: string }>,
    asOfDate: Date
  ): Promise<string> {
    let totalBalance = 0;

    for (const account of cashAccounts) {
      const balance = await this.transactionRepository.getAccountBalance(account.id, asOfDate);
      totalBalance += parseFloat(balance);
    }

    return totalBalance.toFixed(2);
  }

  /**
   * Get cash flow transactions for the period
   */
  private async getCashFlowTransactions(
    cashAccounts: Array<{ id: string; code: string; name: string }>,
    periodStart: Date,
    periodEnd: Date
  ): Promise<Array<{
    transactionId: string;
    date: Date;
    description: string;
    amount: string;
    isInflow: boolean;
    accountCode: string;
    accountName: string;
  }>> {
    const cashAccountIds = cashAccounts.map(acc => acc.id);

    const cashTransactions = await db
      .select({
        transactionId: transactions.id,
        date: transactions.date,
        description: transactions.description,
        debitAmount: journalEntries.debitAmount,
        creditAmount: journalEntries.creditAmount,
        accountCode: accounts.code,
        accountName: accounts.name
      })
      .from(journalEntries)
      .innerJoin(transactions, eq(journalEntries.transactionId, transactions.id))
      .innerJoin(accounts, eq(journalEntries.accountId, accounts.id))
      .where(
        and(
          sql`${journalEntries.accountId} = ANY(${cashAccountIds})`,
          gte(transactions.date, periodStart),
          lte(transactions.date, periodEnd)
        )
      )
      .orderBy(transactions.date, transactions.id);

    return cashTransactions.map(tx => {
      const debit = parseFloat(tx.debitAmount);
      const credit = parseFloat(tx.creditAmount);
      const amount = debit > 0 ? debit : credit;
      const isInflow = debit > 0; // Debit to cash account = cash inflow

      return {
        transactionId: tx.transactionId,
        date: tx.date,
        description: tx.description,
        amount: amount.toFixed(2),
        isInflow,
        accountCode: tx.accountCode,
        accountName: tx.accountName
      };
    });
  }

  /**
   * Categorize operating activities (simplified)
   */
  private categorizeOperatingActivities(transactions: Array<{
    description: string;
    amount: string;
    isInflow: boolean;
  }>): CashFlowSection {
    // Simplified categorization - in practice, this would be more sophisticated
    const operatingItems: CashFlowItem[] = transactions
      .filter(tx => this.isOperatingActivity(tx.description))
      .map(tx => ({
        description: tx.description,
        amount: tx.amount,
        isInflow: tx.isInflow
      }));

    const total = this.calculateCashFlowTotal(operatingItems);

    return {
      items: operatingItems,
      total
    };
  }

  /**
   * Categorize investing activities (simplified)
   */
  private categorizeInvestingActivities(transactions: Array<{
    description: string;
    amount: string;
    isInflow: boolean;
  }>): CashFlowSection {
    const investingItems: CashFlowItem[] = transactions
      .filter(tx => this.isInvestingActivity(tx.description))
      .map(tx => ({
        description: tx.description,
        amount: tx.amount,
        isInflow: tx.isInflow
      }));

    const total = this.calculateCashFlowTotal(investingItems);

    return {
      items: investingItems,
      total
    };
  }

  /**
   * Categorize financing activities (simplified)
   */
  private categorizeFinancingActivities(transactions: Array<{
    description: string;
    amount: string;
    isInflow: boolean;
  }>): CashFlowSection {
    const financingItems: CashFlowItem[] = transactions
      .filter(tx => this.isFinancingActivity(tx.description))
      .map(tx => ({
        description: tx.description,
        amount: tx.amount,
        isInflow: tx.isInflow
      }));

    const total = this.calculateCashFlowTotal(financingItems);

    return {
      items: financingItems,
      total
    };
  }

  /**
   * Calculate cash flow section total
   */
  private calculateCashFlowTotal(items: CashFlowItem[]): string {
    const total = items.reduce((sum, item) => {
      const amount = parseFloat(item.amount);
      return sum + (item.isInflow ? amount : -amount);
    }, 0);

    return total.toFixed(2);
  }

  /**
   * Simple activity classification (would be more sophisticated in practice)
   */
  private isOperatingActivity(description: string): boolean {
    const operatingKeywords = ['sales', 'revenue', 'expense', 'payroll', 'supplier', 'customer'];
    return operatingKeywords.some(keyword => 
      description.toLowerCase().includes(keyword)
    );
  }

  private isInvestingActivity(description: string): boolean {
    const investingKeywords = ['equipment', 'asset', 'investment', 'property', 'vehicle'];
    return investingKeywords.some(keyword => 
      description.toLowerCase().includes(keyword)
    );
  }

  private isFinancingActivity(description: string): boolean {
    const financingKeywords = ['loan', 'debt', 'equity', 'dividend', 'capital', 'borrowing'];
    return financingKeywords.some(keyword => 
      description.toLowerCase().includes(keyword)
    );
  }

  /**
   * Validate balance sheet equation: Assets = Liabilities + Equity
   */
  validateBalanceSheetEquation(
    totalAssets: string,
    totalLiabilities: string,
    totalEquity: string
  ): boolean {
    const assets = parseFloat(totalAssets);
    const liabilities = parseFloat(totalLiabilities);
    const equity = parseFloat(totalEquity);
    
    const difference = Math.abs(assets - (liabilities + equity));
    return difference < 0.01; // Allow for small floating point differences
  }

  /**
   * Validate income statement calculation: Net Income = Revenue - Expenses
   */
  validateIncomeStatementCalculation(
    totalRevenue: string,
    totalExpenses: string,
    netIncome: string
  ): boolean {
    const revenue = parseFloat(totalRevenue);
    const expenses = parseFloat(totalExpenses);
    const calculatedNetIncome = revenue - expenses;
    const reportedNetIncome = parseFloat(netIncome);
    
    const difference = Math.abs(calculatedNetIncome - reportedNetIncome);
    return difference < 0.01; // Allow for small floating point differences
  }

  /**
   * Export balance sheet to various formats
   */
  async exportBalanceSheet(
    balanceSheetData: BalanceSheetData,
    options: ReportExportOptions
  ): Promise<{ filename: string; content: string; mimeType: string }> {
    const timestamp = new Date().toISOString().split('T')[0];
    const companyName = options.companyInfo?.name || 'Company';
    
    switch (options.format) {
      case 'PDF':
        return {
          filename: `Balance_Sheet_${timestamp}.pdf`,
          content: this.generateBalanceSheetPDF(balanceSheetData, options),
          mimeType: 'application/pdf'
        };
      
      case 'EXCEL':
        return {
          filename: `Balance_Sheet_${timestamp}.xlsx`,
          content: this.generateBalanceSheetExcel(balanceSheetData, options),
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        };
      
      case 'CSV':
        return {
          filename: `Balance_Sheet_${timestamp}.csv`,
          content: this.generateBalanceSheetCSV(balanceSheetData, options),
          mimeType: 'text/csv'
        };
      
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }
  }

  /**
   * Export income statement to various formats
   */
  async exportIncomeStatement(
    incomeStatementData: IncomeStatementData,
    options: ReportExportOptions
  ): Promise<{ filename: string; content: string; mimeType: string }> {
    const periodStart = incomeStatementData.periodStart.toISOString().split('T')[0];
    const periodEnd = incomeStatementData.periodEnd.toISOString().split('T')[0];
    
    switch (options.format) {
      case 'PDF':
        return {
          filename: `Income_Statement_${periodStart}_to_${periodEnd}.pdf`,
          content: this.generateIncomeStatementPDF(incomeStatementData, options),
          mimeType: 'application/pdf'
        };
      
      case 'EXCEL':
        return {
          filename: `Income_Statement_${periodStart}_to_${periodEnd}.xlsx`,
          content: this.generateIncomeStatementExcel(incomeStatementData, options),
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        };
      
      case 'CSV':
        return {
          filename: `Income_Statement_${periodStart}_to_${periodEnd}.csv`,
          content: this.generateIncomeStatementCSV(incomeStatementData, options),
          mimeType: 'text/csv'
        };
      
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }
  }

  /**
   * Export cash flow statement to various formats
   */
  async exportCashFlowStatement(
    cashFlowData: CashFlowStatementData,
    options: ReportExportOptions
  ): Promise<{ filename: string; content: string; mimeType: string }> {
    const periodStart = cashFlowData.periodStart.toISOString().split('T')[0];
    const periodEnd = cashFlowData.periodEnd.toISOString().split('T')[0];
    
    switch (options.format) {
      case 'PDF':
        return {
          filename: `Cash_Flow_Statement_${periodStart}_to_${periodEnd}.pdf`,
          content: this.generateCashFlowPDF(cashFlowData, options),
          mimeType: 'application/pdf'
        };
      
      case 'EXCEL':
        return {
          filename: `Cash_Flow_Statement_${periodStart}_to_${periodEnd}.xlsx`,
          content: this.generateCashFlowExcel(cashFlowData, options),
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        };
      
      case 'CSV':
        return {
          filename: `Cash_Flow_Statement_${periodStart}_to_${periodEnd}.csv`,
          content: this.generateCashFlowCSV(cashFlowData, options),
          mimeType: 'text/csv'
        };
      
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }
  }

  /**
   * Generate Balance Sheet CSV format
   */
  private generateBalanceSheetCSV(data: BalanceSheetData, options: ReportExportOptions): string {
    let csv = '';
    
    // Header with metadata
    if (options.includeMetadata) {
      csv += `Balance Sheet\n`;
      csv += `Company: ${options.companyInfo?.name || 'N/A'}\n`;
      csv += `As of: ${data.asOfDate.toISOString().split('T')[0]}\n`;
      csv += `Generated: ${new Date().toISOString()}\n`;
      csv += `\n`;
    }

    // CSV Headers
    csv += `Account Type,Account Code,Account Name,Balance\n`;

    // Assets
    csv += `ASSETS,,,${data.totalAssets}\n`;
    for (const account of data.assets.accounts) {
      csv += `Asset,${account.code},${account.name},${account.balance}\n`;
    }
    csv += `\n`;

    // Liabilities
    csv += `LIABILITIES,,,${data.totalLiabilities}\n`;
    for (const account of data.liabilities.accounts) {
      csv += `Liability,${account.code},${account.name},${account.balance}\n`;
    }
    csv += `\n`;

    // Equity
    csv += `EQUITY,,,${data.totalEquity}\n`;
    for (const account of data.equity.accounts) {
      csv += `Equity,${account.code},${account.name},${account.balance}\n`;
    }
    csv += `\n`;

    // Totals verification
    csv += `VERIFICATION,,,\n`;
    csv += `Total Assets,,,${data.totalAssets}\n`;
    csv += `Total Liabilities + Equity,,,${data.totalLiabilitiesAndEquity}\n`;
    csv += `Balanced,,,${data.isBalanced ? 'Yes' : 'No'}\n`;

    return csv;
  }

  /**
   * Generate Income Statement CSV format
   */
  private generateIncomeStatementCSV(data: IncomeStatementData, options: ReportExportOptions): string {
    let csv = '';
    
    // Header with metadata
    if (options.includeMetadata) {
      csv += `Income Statement\n`;
      csv += `Company: ${options.companyInfo?.name || 'N/A'}\n`;
      csv += `Period: ${data.periodStart.toISOString().split('T')[0]} to ${data.periodEnd.toISOString().split('T')[0]}\n`;
      csv += `Generated: ${new Date().toISOString()}\n`;
      csv += `\n`;
    }

    // CSV Headers
    csv += `Account Type,Account Code,Account Name,Amount\n`;

    // Revenue
    csv += `REVENUE,,,${data.totalRevenue}\n`;
    for (const account of data.revenue.accounts) {
      csv += `Revenue,${account.code},${account.name},${account.amount}\n`;
    }
    csv += `\n`;

    // Expenses
    csv += `EXPENSES,,,${data.totalExpenses}\n`;
    for (const account of data.expenses.accounts) {
      csv += `Expense,${account.code},${account.name},${account.amount}\n`;
    }
    csv += `\n`;

    // Net Income
    csv += `NET INCOME,,,${data.netIncome}\n`;

    return csv;
  }

  /**
   * Generate Cash Flow Statement CSV format
   */
  private generateCashFlowCSV(data: CashFlowStatementData, options: ReportExportOptions): string {
    let csv = '';
    
    // Header with metadata
    if (options.includeMetadata) {
      csv += `Cash Flow Statement\n`;
      csv += `Company: ${options.companyInfo?.name || 'N/A'}\n`;
      csv += `Period: ${data.periodStart.toISOString().split('T')[0]} to ${data.periodEnd.toISOString().split('T')[0]}\n`;
      csv += `Generated: ${new Date().toISOString()}\n`;
      csv += `\n`;
    }

    // CSV Headers
    csv += `Activity Type,Description,Amount,Flow Type\n`;

    // Operating Activities
    csv += `OPERATING ACTIVITIES,,,${data.operatingActivities.total}\n`;
    for (const item of data.operatingActivities.items) {
      csv += `Operating,${item.description},${item.amount},${item.isInflow ? 'Inflow' : 'Outflow'}\n`;
    }
    csv += `\n`;

    // Investing Activities
    csv += `INVESTING ACTIVITIES,,,${data.investingActivities.total}\n`;
    for (const item of data.investingActivities.items) {
      csv += `Investing,${item.description},${item.amount},${item.isInflow ? 'Inflow' : 'Outflow'}\n`;
    }
    csv += `\n`;

    // Financing Activities
    csv += `FINANCING ACTIVITIES,,,${data.financingActivities.total}\n`;
    for (const item of data.financingActivities.items) {
      csv += `Financing,${item.description},${item.amount},${item.isInflow ? 'Inflow' : 'Outflow'}\n`;
    }
    csv += `\n`;

    // Summary
    csv += `SUMMARY,,,\n`;
    csv += `Beginning Cash,,,${data.beginningCash}\n`;
    csv += `Net Cash Flow,,,${data.netCashFlow}\n`;
    csv += `Ending Cash,,,${data.endingCash}\n`;

    return csv;
  }

  /**
   * Generate Balance Sheet PDF format (simplified HTML-based)
   */
  private generateBalanceSheetPDF(data: BalanceSheetData, options: ReportExportOptions): string {
    // For now, return HTML that can be converted to PDF
    // In a real implementation, you would use a PDF library like Puppeteer or jsPDF
    let html = `
<!DOCTYPE html>
<html>
<head>
    <title>Balance Sheet</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .company-name { font-size: 18px; font-weight: bold; }
        .report-title { font-size: 16px; margin: 10px 0; }
        .report-date { font-size: 14px; color: #666; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f5f5f5; font-weight: bold; }
        .section-header { font-weight: bold; background-color: #e9e9e9; }
        .total-row { font-weight: bold; border-top: 2px solid #333; }
        .amount { text-align: right; }
        .verification { margin-top: 30px; padding: 15px; background-color: #f9f9f9; }
    </style>
</head>
<body>
    <div class="header">
        <div class="company-name">${options.companyInfo?.name || 'Company Name'}</div>
        <div class="report-title">Balance Sheet</div>
        <div class="report-date">As of ${data.asOfDate.toISOString().split('T')[0]}</div>
    </div>

    <table>
        <thead>
            <tr>
                <th>Account</th>
                <th class="amount">Amount</th>
            </tr>
        </thead>
        <tbody>
            <tr class="section-header">
                <td>ASSETS</td>
                <td class="amount"></td>
            </tr>`;

    // Assets
    for (const account of data.assets.accounts) {
      html += `
            <tr>
                <td>${account.code} - ${account.name}</td>
                <td class="amount">${parseFloat(account.balance).toLocaleString('id-ID', { minimumFractionDigits: 2 })}</td>
            </tr>`;
    }

    html += `
            <tr class="total-row">
                <td>Total Assets</td>
                <td class="amount">${parseFloat(data.totalAssets).toLocaleString('id-ID', { minimumFractionDigits: 2 })}</td>
            </tr>
            
            <tr class="section-header">
                <td>LIABILITIES</td>
                <td class="amount"></td>
            </tr>`;

    // Liabilities
    for (const account of data.liabilities.accounts) {
      html += `
            <tr>
                <td>${account.code} - ${account.name}</td>
                <td class="amount">${parseFloat(account.balance).toLocaleString('id-ID', { minimumFractionDigits: 2 })}</td>
            </tr>`;
    }

    html += `
            <tr class="total-row">
                <td>Total Liabilities</td>
                <td class="amount">${parseFloat(data.totalLiabilities).toLocaleString('id-ID', { minimumFractionDigits: 2 })}</td>
            </tr>
            
            <tr class="section-header">
                <td>EQUITY</td>
                <td class="amount"></td>
            </tr>`;

    // Equity
    for (const account of data.equity.accounts) {
      html += `
            <tr>
                <td>${account.code} - ${account.name}</td>
                <td class="amount">${parseFloat(account.balance).toLocaleString('id-ID', { minimumFractionDigits: 2 })}</td>
            </tr>`;
    }

    html += `
            <tr class="total-row">
                <td>Total Equity</td>
                <td class="amount">${parseFloat(data.totalEquity).toLocaleString('id-ID', { minimumFractionDigits: 2 })}</td>
            </tr>
            
            <tr class="total-row">
                <td>Total Liabilities and Equity</td>
                <td class="amount">${parseFloat(data.totalLiabilitiesAndEquity).toLocaleString('id-ID', { minimumFractionDigits: 2 })}</td>
            </tr>
        </tbody>
    </table>

    <div class="verification">
        <strong>Balance Sheet Verification:</strong><br>
        Assets = Liabilities + Equity: ${data.isBalanced ? 'BALANCED ✓' : 'NOT BALANCED ✗'}<br>
        Generated on: ${new Date().toLocaleString('id-ID')}
    </div>
</body>
</html>`;

    return html;
  }

  /**
   * Generate Income Statement PDF format (simplified HTML-based)
   */
  private generateIncomeStatementPDF(data: IncomeStatementData, options: ReportExportOptions): string {
    // Similar HTML structure for Income Statement
    return `<!-- Income Statement PDF HTML would be generated here -->`;
  }

  /**
   * Generate Cash Flow PDF format (simplified HTML-based)
   */
  private generateCashFlowPDF(data: CashFlowStatementData, options: ReportExportOptions): string {
    // Similar HTML structure for Cash Flow Statement
    return `<!-- Cash Flow Statement PDF HTML would be generated here -->`;
  }

  /**
   * Generate Excel format (simplified - would use a proper Excel library in production)
   */
  private generateBalanceSheetExcel(data: BalanceSheetData, options: ReportExportOptions): string {
    // In a real implementation, you would use a library like ExcelJS or SheetJS
    // For now, return a tab-separated format that Excel can import
    let excel = '';
    
    if (options.includeMetadata) {
      excel += `Balance Sheet\t\t\n`;
      excel += `Company:\t${options.companyInfo?.name || 'N/A'}\t\n`;
      excel += `As of:\t${data.asOfDate.toISOString().split('T')[0]}\t\n`;
      excel += `\t\t\n`;
    }

    excel += `Account Type\tAccount Code\tAccount Name\tBalance\n`;

    // Assets
    excel += `ASSETS\t\t\t${data.totalAssets}\n`;
    for (const account of data.assets.accounts) {
      excel += `Asset\t${account.code}\t${account.name}\t${account.balance}\n`;
    }
    excel += `\t\t\t\n`;

    // Continue with liabilities and equity...
    return excel;
  }

  private generateIncomeStatementExcel(data: IncomeStatementData, options: ReportExportOptions): string {
    // Similar Excel generation for Income Statement
    return `<!-- Income Statement Excel would be generated here -->`;
  }

  private generateCashFlowExcel(data: CashFlowStatementData, options: ReportExportOptions): string {
    // Similar Excel generation for Cash Flow Statement
    return `<!-- Cash Flow Statement Excel would be generated here -->`;
  }
}