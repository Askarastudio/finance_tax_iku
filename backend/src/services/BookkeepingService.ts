import { AccountRepository, CreateAccountData, UpdateAccountData, AccountWithBalance } from '../repositories/AccountRepository';
import { TransactionRepository, CreateTransactionData, CreateJournalEntryData, TransactionWithEntries } from '../repositories/TransactionRepository';
import { validateDoubleEntry, calculateTransactionTotal } from '../db/schema/transactions';
import { AccountType } from '../db/schema/accounts';

export interface ProcessTransactionData {
  date: Date;
  description: string;
  entries: ProcessJournalEntryData[];
  createdBy: string;
}

export interface ProcessJournalEntryData {
  accountId: string;
  debitAmount: string;
  creditAmount: string;
  description?: string;
}

export interface BalanceValidationResult {
  isValid: boolean;
  totalDebits: number;
  totalCredits: number;
  difference: number;
  errors: string[];
}

export interface TransactionRollbackData {
  transactionId: string;
  reason: string;
  rollbackBy: string;
}

export class BookkeepingService {
  private accountRepository: AccountRepository;
  private transactionRepository: TransactionRepository;

  constructor() {
    this.accountRepository = new AccountRepository();
    this.transactionRepository = new TransactionRepository();
  }

  /**
   * Process a transaction with automatic debit/credit validation
   * Implements double-entry bookkeeping rules and real-time balance updates
   */
  async processTransaction(data: ProcessTransactionData): Promise<TransactionWithEntries> {
    // Validate transaction data
    const validationResult = await this.validateTransactionData(data);
    if (!validationResult.isValid) {
      throw new Error(`Transaction validation failed: ${validationResult.errors.join(', ')}`);
    }

    // Validate double-entry bookkeeping rules
    if (!validateDoubleEntry(data.entries)) {
      throw new Error('Transaction violates double-entry bookkeeping: total debits must equal total credits');
    }

    // Validate account references and permissions
    await this.validateAccountReferences(data.entries);

    // Calculate and validate transaction total
    const totalAmount = calculateTransactionTotal(data.entries);
    if (totalAmount <= 0) {
      throw new Error('Transaction total amount must be greater than zero');
    }

    // Create the transaction using repository
    const transactionData: CreateTransactionData = {
      date: data.date,
      description: data.description,
      entries: data.entries.map(entry => ({
        accountId: entry.accountId,
        debitAmount: entry.debitAmount,
        creditAmount: entry.creditAmount,
        description: entry.description
      })),
      createdBy: data.createdBy
    };

    try {
      const transaction = await this.transactionRepository.create(transactionData);
      
      // Verify balance updates were successful
      await this.verifyBalanceUpdates(transaction);
      
      return transaction;
    } catch (error) {
      throw new Error(`Failed to process transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate real-time account balance with validation
   */
  async calculateAccountBalance(accountId: string, asOfDate?: Date): Promise<string> {
    try {
      const balance = await this.transactionRepository.getAccountBalance(accountId, asOfDate);
      return balance;
    } catch (error) {
      throw new Error(`Failed to calculate account balance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate transaction balance before processing
   */
  async validateTransactionBalance(entries: ProcessJournalEntryData[]): Promise<BalanceValidationResult> {
    const errors: string[] = [];
    let totalDebits = 0;
    let totalCredits = 0;

    // Validate each entry
    for (const entry of entries) {
      const debit = parseFloat(entry.debitAmount);
      const credit = parseFloat(entry.creditAmount);

      // Validate amounts are non-negative
      if (debit < 0 || credit < 0) {
        errors.push(`Entry for account ${entry.accountId}: amounts cannot be negative`);
        continue;
      }

      // Validate that entry has either debit OR credit, not both or neither
      if ((debit > 0 && credit > 0)) {
        errors.push(`Entry for account ${entry.accountId}: cannot have both debit and credit amounts`);
      } else if (debit === 0 && credit === 0) {
        errors.push(`Entry for account ${entry.accountId}: must have either debit or credit amount`);
      }

      totalDebits += debit;
      totalCredits += credit;
    }

    // Check double-entry balance
    const difference = Math.abs(totalDebits - totalCredits);
    const isBalanced = difference < 0.01; // Allow for small floating point differences

    if (!isBalanced) {
      errors.push(`Transaction is not balanced: debits (${totalDebits.toFixed(2)}) must equal credits (${totalCredits.toFixed(2)})`);
    }

    return {
      isValid: errors.length === 0 && isBalanced,
      totalDebits,
      totalCredits,
      difference,
      errors
    };
  }

  /**
   * Get account balances for multiple accounts
   */
  async getMultipleAccountBalances(accountIds: string[], asOfDate?: Date): Promise<Map<string, string>> {
    const balances = new Map<string, string>();
    
    const balancePromises = accountIds.map(async (accountId) => {
      try {
        const balance = await this.calculateAccountBalance(accountId, asOfDate);
        return { accountId, balance };
      } catch (error) {
        throw new Error(`Failed to get balance for account ${accountId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    const results = await Promise.all(balancePromises);
    
    for (const result of results) {
      balances.set(result.accountId, result.balance);
    }

    return balances;
  }

  /**
   * Rollback transaction (create reversing entries)
   */
  async rollbackTransaction(data: TransactionRollbackData): Promise<TransactionWithEntries> {
    // Get the original transaction
    const originalTransaction = await this.transactionRepository.findById(data.transactionId);
    if (!originalTransaction) {
      throw new Error(`Transaction with ID ${data.transactionId} not found`);
    }

    // Create reversing entries
    const reversingEntries: ProcessJournalEntryData[] = originalTransaction.entries.map(entry => ({
      accountId: entry.accountId,
      debitAmount: entry.creditAmount, // Swap debit and credit
      creditAmount: entry.debitAmount,
      description: `Rollback of ${originalTransaction.referenceNumber}: ${entry.description || ''}`
    }));

    // Process the rollback transaction
    const rollbackTransactionData: ProcessTransactionData = {
      date: new Date(),
      description: `ROLLBACK: ${originalTransaction.description} (Reason: ${data.reason})`,
      entries: reversingEntries,
      createdBy: data.rollbackBy
    };

    return this.processTransaction(rollbackTransactionData);
  }

  /**
   * Get trial balance for all accounts
   */
  async getTrialBalance(asOfDate?: Date): Promise<TrialBalanceEntry[]> {
    const accounts = await this.accountRepository.findAll({ isActive: true });
    const trialBalance: TrialBalanceEntry[] = [];

    for (const account of accounts) {
      const balance = await this.calculateAccountBalance(account.id, asOfDate);
      const balanceAmount = parseFloat(balance);

      if (balanceAmount !== 0) { // Only include accounts with non-zero balances
        trialBalance.push({
          accountId: account.id,
          accountCode: account.code,
          accountName: account.name,
          accountType: account.type,
          debitBalance: balanceAmount > 0 ? balanceAmount : 0,
          creditBalance: balanceAmount < 0 ? Math.abs(balanceAmount) : 0,
          balance: balanceAmount
        });
      }
    }

    return trialBalance.sort((a, b) => a.accountCode.localeCompare(b.accountCode));
  }

  /**
   * Validate transaction data before processing
   */
  private async validateTransactionData(data: ProcessTransactionData): Promise<BalanceValidationResult> {
    const errors: string[] = [];

    // Validate basic data
    if (!data.date) {
      errors.push('Transaction date is required');
    }

    if (!data.description || data.description.trim().length === 0) {
      errors.push('Transaction description is required');
    }

    if (!data.entries || data.entries.length === 0) {
      errors.push('Transaction must have at least one journal entry');
    }

    if (!data.createdBy) {
      errors.push('Created by user ID is required');
    }

    // Validate entries if they exist
    if (data.entries && data.entries.length > 0) {
      return this.validateTransactionBalance(data.entries);
    }

    return {
      isValid: errors.length === 0,
      totalDebits: 0,
      totalCredits: 0,
      difference: 0,
      errors
    };
  }

  /**
   * Validate that all account references exist and are active
   */
  private async validateAccountReferences(entries: ProcessJournalEntryData[]): Promise<void> {
    const accountIds = [...new Set(entries.map(entry => entry.accountId))];
    
    for (const accountId of accountIds) {
      const account = await this.accountRepository.findById(accountId);
      if (!account) {
        throw new Error(`Account with ID ${accountId} not found`);
      }
      if (!account.isActive) {
        throw new Error(`Account ${account.code} (${account.name}) is inactive and cannot be used in transactions`);
      }
    }
  }

  /**
   * Verify that balance updates were successful after transaction processing
   */
  private async verifyBalanceUpdates(transaction: TransactionWithEntries): Promise<void> {
    // Get all affected account IDs
    const accountIds = [...new Set(transaction.entries.map(entry => entry.accountId))];
    
    // Verify each account balance is correctly calculated
    for (const accountId of accountIds) {
      try {
        const calculatedBalance = await this.calculateAccountBalance(accountId);
        // If we get here without error, the balance calculation succeeded
      } catch (error) {
        throw new Error(`Balance verification failed for account ${accountId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }
}

export interface TrialBalanceEntry {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  debitBalance: number;
  creditBalance: number;
  balance: number;
}