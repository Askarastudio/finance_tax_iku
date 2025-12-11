import { Elysia, t } from 'elysia';
import { FileProcessingService, ProcessFileOptions } from '../services/FileProcessingService';
import { DataImportService } from '../services/DataImportService';
import { AuthService } from '../services/AuthService';

// Request/Response schemas for validation
const uploadOptionsSchema = t.Object({
  fileType: t.Union([
    t.Literal('accounts'),
    t.Literal('transactions')
  ]),
  skipValidation: t.Optional(t.Boolean()),
  skipDuplicates: t.Optional(t.Boolean()),
  continueOnError: t.Optional(t.Boolean()),
  batchSize: t.Optional(t.Number({ minimum: 1, maximum: 1000 }))
});

const exportOptionsSchema = t.Object({
  format: t.Union([
    t.Literal('CSV'),
    t.Literal('EXCEL'),
    t.Literal('XML')
  ]),
  includeHeaders: t.Optional(t.Boolean()),
  dateFormat: t.Optional(t.String()),
  encoding: t.Optional(t.Union([
    t.Literal('UTF-8'),
    t.Literal('UTF-16'),
    t.Literal('ISO-8859-1')
  ]))
});

export class FileController {
  private fileProcessingService: FileProcessingService;
  private dataImportService: DataImportService;
  private authService: AuthService;

  constructor() {
    this.fileProcessingService = new FileProcessingService();
    this.dataImportService = new DataImportService();
    this.authService = new AuthService();
  }

  /**
   * Setup file processing routes with ElysiaJS
   */
  setupRoutes(app: Elysia): Elysia {
    return app.group('/files', (group) =>
      group
        // Authentication middleware for all file routes
        .derive(async ({ headers }) => {
          const authHeader = headers.authorization;
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new Error('Authorization header required');
          }

          const token = authHeader.substring(7);
          const sessionValidation = await this.authService.validateSession(token);
          
          if (!sessionValidation.isValid || !sessionValidation.user) {
            throw new Error('Invalid or expired session');
          }

          return { user: sessionValidation.user };
        })

        // POST /files/upload - Upload and process file
        .post('/upload', async ({ body, user }) => {
          try {
            // Check permission
            this.authService.requirePermission(user.role, 'files:upload');

            const file = body.file as File;
            const options = body.options as ProcessFileOptions;

            if (!file) {
              return {
                success: false,
                error: 'No file provided'
              };
            }

            // Validate file constraints
            const constraintErrors = this.dataImportService.validateFileConstraints(file);
            if (constraintErrors.length > 0) {
              return {
                success: false,
                error: 'File validation failed',
                details: constraintErrors
              };
            }

            // Detect file format
            const fileFormat = await this.dataImportService.detectFileFormat(file);
            if (fileFormat === 'UNKNOWN') {
              return {
                success: false,
                error: 'Unsupported file format'
              };
            }

            // Queue file for processing
            const jobId = await this.fileProcessingService.queueFileProcessing(
              file,
              options.fileType || 'transactions',
              user.id,
              options
            );

            return {
              success: true,
              data: {
                jobId,
                fileName: file.name,
                fileSize: file.size,
                fileFormat,
                status: 'queued'
              },
              message: 'File queued for processing'
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to upload file'
            };
          }
        }, {
          body: t.Object({
            file: t.File(),
            options: uploadOptionsSchema
          })
        })

        // POST /files/validate - Validate file without importing
        .post('/validate', async ({ body, user }) => {
          try {
            // Check permission
            this.authService.requirePermission(user.role, 'files:validate');

            const file = body.file as File;
            const fileType = body.fileType;

            if (!file) {
              return {
                success: false,
                error: 'No file provided'
              };
            }

            // Validate file constraints
            const constraintErrors = this.dataImportService.validateFileConstraints(file);
            if (constraintErrors.length > 0) {
              return {
                success: false,
                error: 'File validation failed',
                details: constraintErrors
              };
            }

            // Parse file content based on format
            const { headers, rows } = await this.dataImportService.parseFile(file);
            
            // Validate data structure
            const structureErrors = await this.dataImportService.validateDataStructure(headers, rows, fileType);
            if (structureErrors.length > 0) {
              return {
                success: false,
                error: 'File structure validation failed',
                details: structureErrors
              };
            }

            let validationResult;
            if (fileType === 'accounts') {
              validationResult = await this.dataImportService.validateAccountImport(headers, rows);
            } else {
              validationResult = await this.dataImportService.validateTransactionImport(headers, rows);
            }

            return {
              success: true,
              data: {
                fileName: file.name,
                fileSize: file.size,
                totalRecords: rows.length,
                validationResult,
                preview: {
                  headers,
                  sampleRows: rows.slice(0, 5) // First 5 rows for preview
                }
              }
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to validate file'
            };
          }
        }, {
          body: t.Object({
            file: t.File(),
            fileType: t.Union([
              t.Literal('accounts'),
              t.Literal('transactions')
            ])
          })
        })

        // GET /files/jobs - Get user's file processing jobs
        .get('/jobs', async ({ user }) => {
          try {
            // Check permission
            this.authService.requirePermission(user.role, 'files:read');

            const jobs = this.fileProcessingService.getUserJobs(user.id);

            return {
              success: true,
              data: jobs.map(job => ({
                id: job.id,
                fileName: job.fileName,
                fileSize: job.fileSize,
                fileType: job.fileType,
                status: job.status,
                progress: job.progress,
                result: job.result,
                error: job.error,
                createdAt: job.createdAt,
                startedAt: job.startedAt,
                completedAt: job.completedAt
              }))
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to fetch jobs'
            };
          }
        })

        // GET /files/jobs/:jobId - Get specific job status
        .get('/jobs/:jobId', async ({ params, user }) => {
          try {
            // Check permission
            this.authService.requirePermission(user.role, 'files:read');

            const job = this.fileProcessingService.getJobStatus(params.jobId);
            
            if (!job) {
              return {
                success: false,
                error: 'Job not found'
              };
            }

            // Ensure user can only access their own jobs
            if (job.userId !== user.id && !this.authService.checkPermission(user.role, 'files:admin')) {
              return {
                success: false,
                error: 'Access denied'
              };
            }

            return {
              success: true,
              data: {
                id: job.id,
                fileName: job.fileName,
                fileSize: job.fileSize,
                fileType: job.fileType,
                status: job.status,
                progress: job.progress,
                result: job.result,
                error: job.error,
                createdAt: job.createdAt,
                startedAt: job.startedAt,
                completedAt: job.completedAt
              }
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to fetch job status'
            };
          }
        }, {
          params: t.Object({
            jobId: t.String()
          })
        })

        // POST /files/jobs/:jobId/cancel - Cancel a job
        .post('/jobs/:jobId/cancel', async ({ params, user }) => {
          try {
            // Check permission
            this.authService.requirePermission(user.role, 'files:cancel');

            const cancelled = this.fileProcessingService.cancelJob(params.jobId, user.id);
            
            if (!cancelled) {
              return {
                success: false,
                error: 'Job not found or cannot be cancelled'
              };
            }

            return {
              success: true,
              message: 'Job cancelled successfully'
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to cancel job'
            };
          }
        }, {
          params: t.Object({
            jobId: t.String()
          })
        })

        // POST /files/jobs/:jobId/retry - Retry a failed job
        .post('/jobs/:jobId/retry', async ({ params, user }) => {
          try {
            // Check permission
            this.authService.requirePermission(user.role, 'files:retry');

            const retried = this.fileProcessingService.retryJob(params.jobId, user.id);
            
            if (!retried) {
              return {
                success: false,
                error: 'Job not found, not failed, or cannot be retried'
              };
            }

            return {
              success: true,
              message: 'Job queued for retry'
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to retry job'
            };
          }
        }, {
          params: t.Object({
            jobId: t.String()
          })
        })

        // GET /files/templates - Get import templates
        .get('/templates', async ({ user }) => {
          try {
            // Check permission
            this.authService.requirePermission(user.role, 'files:read');

            const templates = [
              {
                type: 'accounts',
                name: 'Chart of Accounts Import Template',
                description: 'Template for importing chart of accounts',
                headers: ['code', 'name', 'type', 'parent_code', 'description'],
                example: [
                  ['1000', 'Cash', 'ASSET', '', 'Cash on hand and in bank'],
                  ['1100', 'Accounts Receivable', 'ASSET', '', 'Money owed by customers'],
                  ['2000', 'Accounts Payable', 'LIABILITY', '', 'Money owed to suppliers']
                ],
                format: 'CSV'
              },
              {
                type: 'transactions',
                name: 'Transaction Import Template',
                description: 'Template for importing journal entries',
                headers: ['date', 'description', 'reference_number', 'account_code', 'debit_amount', 'credit_amount', 'entry_description'],
                example: [
                  ['2024-01-15', 'Office supplies purchase', 'TXN001', '5100', '150.00', '0.00', 'Office supplies'],
                  ['2024-01-15', 'Office supplies purchase', 'TXN001', '1000', '0.00', '150.00', 'Cash payment']
                ],
                format: 'CSV'
              }
            ];

            return {
              success: true,
              data: templates
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to fetch templates'
            };
          }
        })

        // GET /files/templates/:type/download - Download import template
        .get('/templates/:type/download', async ({ params, user }) => {
          try {
            // Check permission
            this.authService.requirePermission(user.role, 'files:read');

            const templateType = params.type;
            let csvContent = '';
            let fileName = '';

            if (templateType === 'accounts') {
              fileName = 'accounts_import_template.csv';
              csvContent = 'code,name,type,parent_code,description\n';
              csvContent += '1000,Cash,ASSET,,Cash on hand and in bank\n';
              csvContent += '1100,Accounts Receivable,ASSET,,Money owed by customers\n';
              csvContent += '2000,Accounts Payable,LIABILITY,,Money owed to suppliers\n';
            } else if (templateType === 'transactions') {
              fileName = 'transactions_import_template.csv';
              csvContent = 'date,description,reference_number,account_code,debit_amount,credit_amount,entry_description\n';
              csvContent += '2024-01-15,Office supplies purchase,TXN001,5100,150.00,0.00,Office supplies\n';
              csvContent += '2024-01-15,Office supplies purchase,TXN001,1000,0.00,150.00,Cash payment\n';
            } else {
              return {
                success: false,
                error: 'Invalid template type'
              };
            }

            return new Response(csvContent, {
              headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="${fileName}"`
              }
            });
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to download template'
            };
          }
        }, {
          params: t.Object({
            type: t.Union([
              t.Literal('accounts'),
              t.Literal('transactions')
            ])
          })
        })

        // GET /files/stats - Get file processing statistics (admin only)
        .get('/stats', async ({ user }) => {
          try {
            // Check permission - admin only
            this.authService.requirePermission(user.role, 'files:admin');

            const stats = this.fileProcessingService.getJobStatistics();

            return {
              success: true,
              data: {
                ...stats,
                systemInfo: {
                  maxConcurrentJobs: 3,
                  queueCapacity: 100,
                  supportedFormats: ['CSV', 'EXCEL', 'XML'],
                  maxFileSize: '10MB'
                }
              }
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to fetch statistics'
            };
          }
        })

        // POST /files/cleanup - Clean up old completed jobs (admin only)
        .post('/cleanup', async ({ body, user }) => {
          try {
            // Check permission - admin only
            this.authService.requirePermission(user.role, 'files:admin');

            const olderThanHours = body.olderThanHours || 24;
            const cleanedCount = this.fileProcessingService.cleanupOldJobs(olderThanHours);

            return {
              success: true,
              data: {
                cleanedJobs: cleanedCount,
                olderThanHours
              },
              message: `Cleaned up ${cleanedCount} old jobs`
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to cleanup jobs'
            };
          }
        }, {
          body: t.Object({
            olderThanHours: t.Optional(t.Number({ minimum: 1, maximum: 168 })) // 1 hour to 1 week
          })
        })

        // GET /files/formats - Get supported file formats
        .get('/formats', async ({ user }) => {
          try {
            // Check permission
            this.authService.requirePermission(user.role, 'files:read');

            const formats = [
              {
                format: 'CSV',
                description: 'Comma Separated Values',
                extensions: ['.csv'],
                mimeTypes: ['text/csv'],
                maxSize: '10MB',
                features: ['Universal compatibility', 'Easy to create', 'Lightweight']
              },
              {
                format: 'EXCEL',
                description: 'Microsoft Excel Spreadsheet',
                extensions: ['.xlsx', '.xls'],
                mimeTypes: ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
                maxSize: '10MB',
                features: ['Rich formatting', 'Multiple sheets', 'Data validation']
              },
              {
                format: 'XML',
                description: 'Extensible Markup Language',
                extensions: ['.xml'],
                mimeTypes: ['text/xml', 'application/xml'],
                maxSize: '10MB',
                features: ['Structured data', 'Schema validation', 'Hierarchical format']
              }
            ];

            return {
              success: true,
              data: formats
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to fetch file formats'
            };
          }
        })

        // Error handling middleware
        .onError(({ error, code }) => {
          console.error('File Controller Error:', error);
          
          if (code === 'VALIDATION') {
            return {
              success: false,
              error: 'Validation failed',
              details: error.message
            };
          }

          if (error.message.includes('Authorization') || error.message.includes('session')) {
            return {
              success: false,
              error: 'Authentication required'
            };
          }

          if (error.message.includes('permission') || error.message.includes('Access denied')) {
            return {
              success: false,
              error: 'Insufficient permissions'
            };
          }

          if (error.message.includes('file') || error.message.includes('upload')) {
            return {
              success: false,
              error: 'File processing failed',
              details: error.message
            };
          }

          return {
            success: false,
            error: 'Internal server error'
          };
        })
    );
  }
}