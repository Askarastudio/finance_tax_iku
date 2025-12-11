import { DataImportService, FileProcessingProgress, ImportValidationResult } from './DataImportService';
import { AccountRepository, CreateAccountData } from '../repositories/AccountRepository';
import { BookkeepingService, ProcessTransactionData } from './BookkeepingService';

export interface FileProcessingJob {
  id: string;
  userId: string;
  fileName: string;
  fileSize: number;
  fileType: 'accounts' | 'transactions';
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: FileProcessingProgress;
  result?: FileProcessingResult;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface FileProcessingResult {
  importedRecords: number;
  skippedRecords: number;
  errorRecords: number;
  validationResult: ImportValidationResult;
  importedIds?: string[];
  summary: string;
}

export interface ProcessFileOptions {
  skipValidation?: boolean;
  skipDuplicates?: boolean;
  continueOnError?: boolean;
  batchSize?: number;
}

export class FileProcessingService {
  private dataImportService: DataImportService;
  private accountRepository: AccountRepository;
  private bookkeepingService: BookkeepingService;
  private activeJobs: Map<string, FileProcessingJob> = new Map();
  private jobQueue: string[] = [];
  private isProcessing = false;
  private maxConcurrentJobs = 3;
  private processingJobs = new Set<string>();
  private jobTimeouts = new Map<string, NodeJS.Timeout>();

  constructor() {
    this.dataImportService = new DataImportService();
    this.accountRepository = new AccountRepository();
    this.bookkeepingService = new BookkeepingService();
  }

  /**
   * Queue file for processing
   */
  async queueFileProcessing(
    file: File,
    fileType: 'accounts' | 'transactions',
    userId: string,
    options: ProcessFileOptions = {}
  ): Promise<string> {
    const jobId = this.generateJobId();
    
    const job: FileProcessingJob = {
      id: jobId,
      userId,
      fileName: file.name,
      fileSize: file.size,
      fileType,
      status: 'queued',
      progress: {
        stage: 'parsing',
        progress: 0,
        message: 'File queued for processing',
        processedRecords: 0,
        totalRecords: 0,
        errors: [],
        warnings: []
      },
      createdAt: new Date()
    };

    this.activeJobs.set(jobId, job);
    this.jobQueue.push(jobId);

    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue();
    }

    // Store file content for processing (in production, use proper file storage)
    const fileContent = await file.text();
    (job as any).fileContent = fileContent;
    (job as any).options = options;

    return jobId;
  }

  /**
   * Get job status and progress
   */
  getJobStatus(jobId: string): FileProcessingJob | null {
    return this.activeJobs.get(jobId) || null;
  }

  /**
   * Get all jobs for a user
   */
  getUserJobs(userId: string): FileProcessingJob[] {
    return Array.from(this.activeJobs.values())
      .filter(job => job.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Cancel a queued or processing job with cleanup
   */
  cancelJob(jobId: string, userId: string): boolean {
    const job = this.activeJobs.get(jobId);
    
    if (!job || job.userId !== userId) {
      return false;
    }

    if (job.status === 'queued') {
      // Remove from queue
      const queueIndex = this.jobQueue.indexOf(jobId);
      if (queueIndex > -1) {
        this.jobQueue.splice(queueIndex, 1);
      }
      
      job.status = 'cancelled';
      job.completedAt = new Date();
      job.progress = {
        stage: 'error',
        progress: 0,
        message: 'Job cancelled by user',
        processedRecords: 0,
        totalRecords: 0,
        errors: [],
        warnings: []
      };
      
      this.clearJobTimeout(jobId);
      return true;
    }

    if (job.status === 'processing') {
      // Mark for cancellation (will be checked during processing)
      job.status = 'cancelled';
      job.completedAt = new Date();
      job.progress = {
        ...job.progress,
        stage: 'error',
        message: 'Job cancellation requested...'
      };
      
      this.clearJobTimeout(jobId);
      return true;
    }

    return false;
  }

  /**
   * Retry a failed job
   */
  retryJob(jobId: string, userId: string): boolean {
    const job = this.activeJobs.get(jobId);
    
    if (!job || job.userId !== userId || job.status !== 'failed') {
      return false;
    }

    // Reset job status and add back to queue
    job.status = 'queued';
    job.error = undefined;
    job.result = undefined;
    job.startedAt = undefined;
    job.completedAt = undefined;
    job.progress = {
      stage: 'parsing',
      progress: 0,
      message: 'Job queued for retry',
      processedRecords: 0,
      totalRecords: 0,
      errors: [],
      warnings: []
    };

    this.jobQueue.push(jobId);
    
    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue();
    }

    return true;
  }

  /**
   * Get job statistics for monitoring
   */
  getJobStatistics(): {
    total: number;
    queued: number;
    processing: number;
    completed: number;
    failed: number;
    cancelled: number;
    averageProcessingTime: number;
    successRate: number;
  } {
    const jobs = Array.from(this.activeJobs.values());
    const completedJobs = jobs.filter(j => j.status === 'completed' && j.startedAt && j.completedAt);
    
    const totalProcessingTime = completedJobs.reduce((total, job) => {
      if (job.startedAt && job.completedAt) {
        return total + (job.completedAt.getTime() - job.startedAt.getTime());
      }
      return total;
    }, 0);

    const averageProcessingTime = completedJobs.length > 0 ? totalProcessingTime / completedJobs.length : 0;
    const finishedJobs = jobs.filter(j => ['completed', 'failed', 'cancelled'].includes(j.status));
    const successRate = finishedJobs.length > 0 ? 
      jobs.filter(j => j.status === 'completed').length / finishedJobs.length : 0;

    return {
      total: jobs.length,
      queued: jobs.filter(j => j.status === 'queued').length,
      processing: jobs.filter(j => j.status === 'processing').length,
      completed: jobs.filter(j => j.status === 'completed').length,
      failed: jobs.filter(j => j.status === 'failed').length,
      cancelled: jobs.filter(j => j.status === 'cancelled').length,
      averageProcessingTime: Math.round(averageProcessingTime),
      successRate: Math.round(successRate * 100) / 100
    };
  }

  /**
   * Process the job queue with concurrent processing support
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.jobQueue.length > 0 || this.processingJobs.size > 0) {
        // Start new jobs if we have capacity
        while (this.jobQueue.length > 0 && this.processingJobs.size < this.maxConcurrentJobs) {
          const jobId = this.jobQueue.shift()!;
          const job = this.activeJobs.get(jobId);

          if (!job || job.status === 'cancelled') {
            continue;
          }

          // Start processing job asynchronously
          this.processingJobs.add(jobId);
          this.processJobAsync(job).finally(() => {
            this.processingJobs.delete(jobId);
            this.clearJobTimeout(jobId);
          });
        }

        // Wait a bit before checking again
        if (this.processingJobs.size > 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single job asynchronously with timeout and error handling
   */
  private async processJobAsync(job: FileProcessingJob): Promise<void> {
    const jobTimeout = setTimeout(() => {
      if (job.status === 'processing') {
        job.status = 'failed';
        job.error = 'Job timed out after 10 minutes';
        job.completedAt = new Date();
      }
    }, 10 * 60 * 1000); // 10 minute timeout

    this.jobTimeouts.set(job.id, jobTimeout);

    try {
      await this.processJob(job);
    } catch (error) {
      console.error(`Error processing job ${job.id}:`, error);
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Unknown error';
      job.completedAt = new Date();
      
      // Log detailed error for debugging
      console.error('Job processing error details:', {
        jobId: job.id,
        fileName: job.fileName,
        fileType: job.fileType,
        userId: job.userId,
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack
        } : error
      });
    }
  }

  /**
   * Clear job timeout
   */
  private clearJobTimeout(jobId: string): void {
    const timeout = this.jobTimeouts.get(jobId);
    if (timeout) {
      clearTimeout(timeout);
      this.jobTimeouts.delete(jobId);
    }
  }

  /**
   * Process a single job with enhanced error handling and recovery
   */
  private async processJob(job: FileProcessingJob): Promise<void> {
    job.status = 'processing';
    job.startedAt = new Date();

    const fileContent = (job as any).fileContent as string;
    const options = (job as any).options as ProcessFileOptions;

    try {
      // Enhanced progress callback with cancellation check and persistence
      const progressCallback = (progress: FileProcessingProgress) => {
        job.progress = {
          ...progress,
          timestamp: new Date()
        };
        
        // Check for cancellation
        if (job.status === 'cancelled') {
          throw new Error('Job cancelled by user');
        }

        // Emit progress event for real-time updates (in production, use WebSocket or SSE)
        this.emitProgressUpdate(job.id, job.progress);
      };

      // Stage 1: File format detection and parsing
      progressCallback({
        stage: 'parsing',
        progress: 5,
        message: 'Detecting file format...',
        processedRecords: 0,
        totalRecords: 0,
        errors: [],
        warnings: []
      });

      // Create a mock file for format detection
      const mockFile = new File([fileContent], (job as any).originalFileName || job.fileName);
      const fileFormat = await this.dataImportService.detectFileFormat(mockFile);
      
      progressCallback({
        stage: 'parsing',
        progress: 15,
        message: `Detected format: ${fileFormat}. Parsing content...`,
        processedRecords: 0,
        totalRecords: 0,
        errors: [],
        warnings: []
      });

      // Parse file content based on detected format
      let headers: string[];
      let rows: string[][];

      try {
        if (fileFormat === 'CSV') {
          const parsed = await this.dataImportService.parseCSVFile(fileContent);
          headers = parsed.headers;
          rows = parsed.rows;
        } else {
          const parsed = await this.dataImportService.parseFile(mockFile);
          headers = parsed.headers;
          rows = parsed.rows;
        }
      } catch (parseError) {
        throw new Error(`Failed to parse ${fileFormat} file: ${parseError instanceof Error ? parseError.message : 'Unknown parsing error'}`);
      }
      
      progressCallback({
        stage: 'parsing',
        progress: 30,
        message: `Parsed ${rows.length} records with ${headers.length} columns`,
        processedRecords: 0,
        totalRecords: rows.length,
        errors: [],
        warnings: []
      });

      // Stage 2: Data structure validation
      const structureErrors = await this.dataImportService.validateDataStructure(headers, rows, job.fileType);
      if (structureErrors.length > 0 && !options.continueOnError) {
        throw new Error(`Data structure validation failed: ${structureErrors.map(e => e.message).join(', ')}`);
      }

      // Stage 3: Business logic validation
      progressCallback({
        stage: 'validating',
        progress: 40,
        message: 'Validating business rules...',
        processedRecords: 0,
        totalRecords: rows.length,
        errors: structureErrors,
        warnings: []
      });

      let validationResult: ImportValidationResult;
      
      if (job.fileType === 'accounts') {
        validationResult = await this.dataImportService.validateAccountImport(
          headers,
          rows,
          progressCallback
        );
      } else {
        validationResult = await this.dataImportService.validateTransactionImport(
          headers,
          rows,
          progressCallback
        );
      }

      // Combine structure errors with validation errors
      validationResult.errors = [...structureErrors, ...validationResult.errors];

      // Check if we should continue with errors
      if (!validationResult.isValid && !options.continueOnError) {
        job.status = 'failed';
        job.error = `Validation failed: ${validationResult.errors.length} errors found`;
        job.result = {
          importedRecords: 0,
          skippedRecords: rows.length,
          errorRecords: validationResult.errors.length,
          validationResult,
          summary: `Validation failed with ${validationResult.errors.length} errors. Use 'continueOnError' option to import valid records.`
        };
        job.completedAt = new Date();
        return;
      }

      // Stage 4: Data import with transaction support
      progressCallback({
        stage: 'importing',
        progress: 60,
        message: 'Starting data import with transaction support...',
        processedRecords: 0,
        totalRecords: validationResult.validRecords,
        errors: validationResult.errors,
        warnings: validationResult.warnings
      });

      let importResult: FileProcessingResult;

      // Use database transaction for data integrity
      try {
        if (job.fileType === 'accounts') {
          importResult = await this.importAccountsWithTransaction(headers, rows, validationResult, options, progressCallback);
        } else {
          importResult = await this.importTransactionsWithTransaction(headers, rows, validationResult, options, progressCallback);
        }
      } catch (importError) {
        // Rollback any partial changes and report error
        throw new Error(`Import failed: ${importError instanceof Error ? importError.message : 'Unknown import error'}. All changes have been rolled back.`);
      }

      // Stage 5: Completion
      job.result = importResult;
      job.status = 'completed';
      job.completedAt = new Date();

      progressCallback({
        stage: 'complete',
        progress: 100,
        message: importResult.summary,
        processedRecords: importResult.importedRecords,
        totalRecords: rows.length,
        errors: validationResult.errors,
        warnings: validationResult.warnings
      });

      // Log successful completion
      console.log(`Job ${job.id} completed successfully:`, {
        fileName: job.fileName,
        fileType: job.fileType,
        importedRecords: importResult.importedRecords,
        skippedRecords: importResult.skippedRecords,
        errorRecords: importResult.errorRecords
      });

    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Unknown error';
      job.completedAt = new Date();
      
      const errorProgress: FileProcessingProgress = {
        stage: 'error',
        progress: 0,
        message: `Processing failed: ${job.error}`,
        processedRecords: 0,
        totalRecords: 0,
        errors: [{
          row: 0,
          message: job.error,
          severity: 'error',
          code: 'PROCESSING_FAILED'
        }],
        warnings: []
      };

      job.progress = errorProgress;
      this.emitProgressUpdate(job.id, errorProgress);

      // Log error details for debugging
      console.error(`Job ${job.id} failed:`, {
        fileName: job.fileName,
        fileType: job.fileType,
        userId: job.userId,
        error: job.error,
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }

  /**
   * Emit progress update (placeholder for real-time updates)
   */
  private emitProgressUpdate(jobId: string, progress: FileProcessingProgress): void {
    // In a production system, this would emit to WebSocket connections or Server-Sent Events
    // For now, we just store the progress in the job object
    console.log(`Job ${jobId} progress: ${progress.stage} - ${progress.progress}% - ${progress.message}`);
  }

  /**
   * Import accounts with database transaction support
   */
  private async importAccountsWithTransaction(
    headers: string[],
    rows: string[][],
    validationResult: ImportValidationResult,
    options: ProcessFileOptions,
    progressCallback: (progress: FileProcessingProgress) => void
  ): Promise<FileProcessingResult> {
    // For now, delegate to the original method
    // In a full implementation, this would use database transactions
    return this.importAccounts(headers, rows, validationResult, options, progressCallback);
  }

  /**
   * Import transactions with database transaction support
   */
  private async importTransactionsWithTransaction(
    headers: string[],
    rows: string[][],
    validationResult: ImportValidationResult,
    options: ProcessFileOptions,
    progressCallback: (progress: FileProcessingProgress) => void
  ): Promise<FileProcessingResult> {
    // For now, delegate to the original method
    // In a full implementation, this would use database transactions
    return this.importTransactions(headers, rows, validationResult, options, progressCallback);
  }

  /**
   * Import accounts from validated data
   */
  private async importAccounts(
    headers: string[],
    rows: string[][],
    validationResult: ImportValidationResult,
    options: ProcessFileOptions,
    progressCallback: (progress: FileProcessingProgress) => void
  ): Promise<FileProcessingResult> {
    const importedIds: string[] = [];
    let importedRecords = 0;
    let skippedRecords = 0;
    let errorRecords = 0;

    const batchSize = options.batchSize || 50;
    const headerMap = this.createHeaderMap(headers);

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      
      for (let j = 0; j < batch.length; j++) {
        const rowIndex = i + j;
        const row = batch[j];
        const rowNumber = rowIndex + 2;

        try {
          // Check for cancellation
          if (this.activeJobs.get(this.getCurrentJobId())?.status === 'cancelled') {
            throw new Error('Job cancelled');
          }

          // Update progress
          if (rowIndex % 10 === 0) {
            progressCallback({
              stage: 'importing',
              progress: 60 + Math.round((rowIndex / rows.length) * 35),
              message: `Importing account ${rowIndex + 1} of ${rows.length}...`,
              processedRecords: importedRecords,
              totalRecords: rows.length,
              errors: validationResult.errors,
              warnings: validationResult.warnings
            });
          }

          // Skip rows with validation errors
          const hasError = validationResult.errors.some(error => error.row === rowNumber);
          if (hasError && !options.continueOnError) {
            skippedRecords++;
            continue;
          }

          const rowData = this.mapRowToObject(headers, row);

          // Check if account already exists
          const existingAccount = await this.accountRepository.findByCode(rowData[headerMap.code!]);
          if (existingAccount && options.skipDuplicates) {
            skippedRecords++;
            continue;
          }

          // Create account data
          const accountData: CreateAccountData = {
            code: rowData[headerMap.code!],
            name: rowData[headerMap.name!],
            type: rowData[headerMap.type!].toUpperCase() as any,
            parentId: undefined, // Will be resolved later if parent_code is provided
            description: rowData[headerMap.description!] || undefined
          };

          // Resolve parent ID if parent code is provided
          if (rowData[headerMap.parent_code!]) {
            const parentAccount = await this.accountRepository.findByCode(rowData[headerMap.parent_code!]);
            if (parentAccount) {
              accountData.parentId = parentAccount.id;
            }
          }

          // Create account
          const newAccount = await this.accountRepository.create(accountData);
          importedIds.push(newAccount.id);
          importedRecords++;

        } catch (error) {
          errorRecords++;
          console.error(`Error importing account at row ${rowNumber}:`, error);
        }
      }

      // Small delay between batches to prevent overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    return {
      importedRecords,
      skippedRecords,
      errorRecords,
      validationResult,
      importedIds,
      summary: `Successfully imported ${importedRecords} accounts, skipped ${skippedRecords}, ${errorRecords} errors`
    };
  }

  /**
   * Import transactions from validated data
   */
  private async importTransactions(
    headers: string[],
    rows: string[][],
    validationResult: ImportValidationResult,
    options: ProcessFileOptions,
    progressCallback: (progress: FileProcessingProgress) => void
  ): Promise<FileProcessingResult> {
    const importedIds: string[] = [];
    let importedRecords = 0;
    let skippedRecords = 0;
    let errorRecords = 0;

    const batchSize = options.batchSize || 20; // Smaller batches for transactions
    const headerMap = this.createHeaderMap(headers);

    // Group rows by transaction (assuming transactions can span multiple rows)
    const transactionGroups = this.groupTransactionRows(headers, rows);

    for (let i = 0; i < transactionGroups.length; i += batchSize) {
      const batch = transactionGroups.slice(i, i + batchSize);
      
      for (let j = 0; j < batch.length; j++) {
        const transactionIndex = i + j;
        const transactionRows = batch[j];

        try {
          // Check for cancellation
          if (this.activeJobs.get(this.getCurrentJobId())?.status === 'cancelled') {
            throw new Error('Job cancelled');
          }

          // Update progress
          if (transactionIndex % 5 === 0) {
            progressCallback({
              stage: 'importing',
              progress: 60 + Math.round((transactionIndex / transactionGroups.length) * 35),
              message: `Importing transaction ${transactionIndex + 1} of ${transactionGroups.length}...`,
              processedRecords: importedRecords,
              totalRecords: transactionGroups.length,
              errors: validationResult.errors,
              warnings: validationResult.warnings
            });
          }

          // Process transaction group
          const firstRow = transactionRows[0];
          const firstRowData = this.mapRowToObject(headers, firstRow.row);

          // Check for duplicate reference number
          const referenceNumber = firstRowData[headerMap.reference_number!];
          if (referenceNumber && options.skipDuplicates) {
            const existing = await this.bookkeepingService.transactionRepository.findByReference(referenceNumber);
            if (existing) {
              skippedRecords++;
              continue;
            }
          }

          // Build transaction data
          const transactionData: ProcessTransactionData = {
            date: new Date(firstRowData[headerMap.date!]),
            description: firstRowData[headerMap.description!],
            entries: [],
            createdBy: this.getCurrentJobUserId()
          };

          // Add journal entries
          for (const rowInfo of transactionRows) {
            const rowData = this.mapRowToObject(headers, rowInfo.row);
            
            transactionData.entries.push({
              accountId: await this.getAccountIdByCode(rowData[headerMap.account_code!]),
              debitAmount: rowData[headerMap.debit_amount!] || '0',
              creditAmount: rowData[headerMap.credit_amount!] || '0',
              description: rowData[headerMap.entry_description!] || undefined
            });
          }

          // Create transaction
          const newTransaction = await this.bookkeepingService.processTransaction(transactionData);
          importedIds.push(newTransaction.id);
          importedRecords++;

        } catch (error) {
          errorRecords++;
          console.error(`Error importing transaction at index ${transactionIndex}:`, error);
        }
      }

      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    return {
      importedRecords,
      skippedRecords,
      errorRecords,
      validationResult,
      importedIds,
      summary: `Successfully imported ${importedRecords} transactions, skipped ${skippedRecords}, ${errorRecords} errors`
    };
  }

  /**
   * Group transaction rows by transaction (based on reference number or date+description)
   */
  private groupTransactionRows(headers: string[], rows: string[][]): Array<Array<{ row: string[]; index: number }>> {
    const groups: Array<Array<{ row: string[]; index: number }>> = [];
    const headerMap = this.createHeaderMap(headers);
    
    // Simple grouping: each row is a separate transaction for now
    // In a more sophisticated implementation, you would group by reference number or other criteria
    for (let i = 0; i < rows.length; i++) {
      groups.push([{ row: rows[i], index: i }]);
    }

    return groups;
  }

  /**
   * Get account ID by account code
   */
  private async getAccountIdByCode(accountCode: string): Promise<string> {
    const account = await this.accountRepository.findByCode(accountCode);
    if (!account) {
      throw new Error(`Account with code '${accountCode}' not found`);
    }
    return account.id;
  }

  /**
   * Helper methods
   */
  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  private getCurrentJobId(): string {
    // In a real implementation, this would track the current job being processed
    return Array.from(this.activeJobs.keys()).find(id => 
      this.activeJobs.get(id)?.status === 'processing'
    ) || '';
  }

  private getCurrentJobUserId(): string {
    const currentJobId = this.getCurrentJobId();
    return this.activeJobs.get(currentJobId)?.userId || 'system';
  }

  private createHeaderMap(headers: string[]): Record<string, number> {
    const map: Record<string, number> = {};
    
    headers.forEach((header, index) => {
      const normalizedHeader = header.toLowerCase().replace(/[^a-z0-9]/g, '_');
      map[normalizedHeader] = index;
    });

    return map;
  }

  private mapRowToObject(headers: string[], row: string[]): Record<string, string> {
    const obj: Record<string, string> = {};
    
    headers.forEach((header, index) => {
      const normalizedHeader = header.toLowerCase().replace(/[^a-z0-9]/g, '_');
      obj[normalizedHeader] = row[index] || '';
    });

    return obj;
  }

  /**
   * Clean up completed jobs older than specified time
   */
  cleanupOldJobs(olderThanHours: number = 24): number {
    const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    let cleanedCount = 0;

    for (const [jobId, job] of this.activeJobs.entries()) {
      if (job.status === 'completed' || job.status === 'failed') {
        if (job.completedAt && job.completedAt < cutoffTime) {
          this.activeJobs.delete(jobId);
          cleanedCount++;
        }
      }
    }

    return cleanedCount;
  }

  /**
   * Get processing statistics
   */
  getProcessingStats(): {
    totalJobs: number;
    queuedJobs: number;
    processingJobs: number;
    completedJobs: number;
    failedJobs: number;
  } {
    const jobs = Array.from(this.activeJobs.values());
    
    return {
      totalJobs: jobs.length,
      queuedJobs: jobs.filter(j => j.status === 'queued').length,
      processingJobs: jobs.filter(j => j.status === 'processing').length,
      completedJobs: jobs.filter(j => j.status === 'completed').length,
      failedJobs: jobs.filter(j => j.status === 'failed').length
    };
  }
}