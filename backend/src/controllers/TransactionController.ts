import { Elysia, t } from 'elysia';
import { TransactionRepository, CreateTransactionData, TransactionFilter } from '../repositories/TransactionRepository';
import { BookkeepingService, ProcessTransactionData } from '../services/BookkeepingService';
import { AuthService } from '../services/AuthService';

// Request/Response schemas for validation
const journalEntrySchema = t.Object({
  accountId: t.String(),
  debitAmount: t.String({ pattern: '^\\d+(\\.\\d{1,2})?$' }), // Decimal with up to 2 decimal places
  creditAmount: t.String({ pattern: '^\\d+(\\.\\d{1,2})?$' }),
  description: t.Optional(t.String({ maxLength: 500 }))
});

const createTransactionSchema = t.Object({
  date: t.String({ format: 'date' }), // ISO date string
  description: t.String({ minLength: 1, maxLength: 500 }),
  entries: t.Array(journalEntrySchema, { minItems: 2 }) // At least 2 entries for double-entry
});

const transactionQuerySchema = t.Object({
  dateFrom: t.Optional(t.String({ format: 'date' })),
  dateTo: t.Optional(t.String({ format: 'date' })),
  accountId: t.Optional(t.String()),
  createdBy: t.Optional(t.String()),
  referenceNumber: t.Optional(t.String()),
  search: t.Optional(t.String()),
  limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
  offset: t.Optional(t.Number({ minimum: 0 }))
});

const balanceValidationSchema = t.Object({
  entries: t.Array(journalEntrySchema, { minItems: 1 })
});

export class TransactionController {
  private transactionRepository: TransactionRepository;
  private bookkeepingService: BookkeepingService;
  private authService: AuthService;

  constructor() {
    this.transactionRepository = new TransactionRepository();
    this.bookkeepingService = new BookkeepingService();
    this.authService = new AuthService();
  }

  /**
   * Setup transaction routes with ElysiaJS
   */
  setupRoutes(app: Elysia): Elysia {
    return app.group('/transactions', (group) =>
      group
        // Authentication middleware for all transaction routes
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

        // GET /transactions - List all transactions with filtering
        .get('/', async ({ query, user }) => {
          try {
            // Check permission
            this.authService.requirePermission(user.role, 'transactions:read');

            const filters: TransactionFilter = {};
            
            if (query.dateFrom) {
              filters.dateFrom = new Date(query.dateFrom);
            }
            
            if (query.dateTo) {
              filters.dateTo = new Date(query.dateTo);
            }
            
            if (query.accountId) {
              filters.accountId = query.accountId;
            }
            
            if (query.createdBy) {
              filters.createdBy = query.createdBy;
            }
            
            if (query.referenceNumber) {
              filters.referenceNumber = query.referenceNumber;
            }

            let transactions;
            if (query.search) {
              transactions = await this.transactionRepository.search(
                query.search,
                query.limit || 50,
                query.offset || 0
              );
            } else {
              transactions = await this.transactionRepository.findAll(
                filters,
                query.limit || 50,
                query.offset || 0
              );
            }

            // Get total count for pagination
            const totalCount = await this.transactionRepository.getTransactionCount(filters);

            return {
              success: true,
              data: transactions,
              pagination: {
                total: totalCount,
                limit: query.limit || 50,
                offset: query.offset || 0,
                hasMore: (query.offset || 0) + transactions.length < totalCount
              }
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to fetch transactions'
            };
          }
        }, {
          query: transactionQuerySchema
        })

        // GET /transactions/:id - Get specific transaction by ID
        .get('/:id', async ({ params, user }) => {
          try {
            // Check permission
            this.authService.requirePermission(user.role, 'transactions:read');

            const transaction = await this.transactionRepository.findById(params.id);
            
            if (!transaction) {
              return {
                success: false,
                error: 'Transaction not found'
              };
            }

            return {
              success: true,
              data: transaction
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to fetch transaction'
            };
          }
        }, {
          params: t.Object({
            id: t.String()
          })
        })

        // GET /transactions/reference/:reference - Get transaction by reference number
        .get('/reference/:reference', async ({ params, user }) => {
          try {
            // Check permission
            this.authService.requirePermission(user.role, 'transactions:read');

            const transaction = await this.transactionRepository.findByReference(params.reference);
            
            if (!transaction) {
              return {
                success: false,
                error: 'Transaction not found'
              };
            }

            return {
              success: true,
              data: transaction
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to fetch transaction'
            };
          }
        }, {
          params: t.Object({
            reference: t.String()
          })
        })

        // GET /transactions/account/:accountId - Get transactions for specific account
        .get('/account/:accountId', async ({ params, query, user }) => {
          try {
            // Check permission
            this.authService.requirePermission(user.role, 'transactions:read');

            const transactions = await this.transactionRepository.findByAccount(
              params.accountId,
              query.limit || 50,
              query.offset || 0
            );

            return {
              success: true,
              data: transactions,
              count: transactions.length
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to fetch account transactions'
            };
          }
        }, {
          params: t.Object({
            accountId: t.String()
          }),
          query: t.Object({
            limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
            offset: t.Optional(t.Number({ minimum: 0 }))
          })
        })

        // POST /transactions/validate - Validate transaction balance before saving
        .post('/validate', async ({ body, user }) => {
          try {
            // Check permission
            this.authService.requirePermission(user.role, 'transactions:create');

            const validationResult = await this.bookkeepingService.validateTransactionBalance(body.entries);

            return {
              success: true,
              data: validationResult
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to validate transaction'
            };
          }
        }, {
          body: balanceValidationSchema
        })

        // POST /transactions - Create new transaction with double-entry validation
        .post('/', async ({ body, user }) => {
          try {
            // Check permission
            this.authService.requirePermission(user.role, 'transactions:create');

            const transactionData: ProcessTransactionData = {
              date: new Date(body.date),
              description: body.description,
              entries: body.entries.map(entry => ({
                accountId: entry.accountId,
                debitAmount: entry.debitAmount,
                creditAmount: entry.creditAmount,
                description: entry.description
              })),
              createdBy: user.id
            };

            // Process transaction through bookkeeping service for validation
            const newTransaction = await this.bookkeepingService.processTransaction(transactionData);

            return {
              success: true,
              data: newTransaction,
              message: 'Transaction created successfully'
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to create transaction'
            };
          }
        }, {
          body: createTransactionSchema
        })

        // GET /transactions/:id/history - Get transaction audit history
        .get('/:id/history', async ({ params, user }) => {
          try {
            // Check permission
            this.authService.requirePermission(user.role, 'transactions:read');

            const history = await this.transactionRepository.getTransactionHistory(params.id);

            return {
              success: true,
              data: history
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to fetch transaction history'
            };
          }
        }, {
          params: t.Object({
            id: t.String()
          })
        })

        // GET /accounts/:accountId/balance - Get real-time account balance
        .get('/accounts/:accountId/balance', async ({ params, query, user }) => {
          try {
            // Check permission
            this.authService.requirePermission(user.role, 'accounts:read');

            const asOfDate = query.asOfDate ? new Date(query.asOfDate) : undefined;
            const balance = await this.bookkeepingService.calculateAccountBalance(params.accountId, asOfDate);

            return {
              success: true,
              data: {
                accountId: params.accountId,
                balance,
                asOfDate: asOfDate || new Date(),
                calculatedAt: new Date()
              }
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to calculate account balance'
            };
          }
        }, {
          params: t.Object({
            accountId: t.String()
          }),
          query: t.Object({
            asOfDate: t.Optional(t.String({ format: 'date' }))
          })
        })

        // POST /accounts/balances - Get multiple account balances
        .post('/accounts/balances', async ({ body, user }) => {
          try {
            // Check permission
            this.authService.requirePermission(user.role, 'accounts:read');

            const asOfDate = body.asOfDate ? new Date(body.asOfDate) : undefined;
            const balances = await this.bookkeepingService.getMultipleAccountBalances(body.accountIds, asOfDate);

            // Convert Map to object for JSON response
            const balanceObject: Record<string, string> = {};
            for (const [accountId, balance] of balances.entries()) {
              balanceObject[accountId] = balance;
            }

            return {
              success: true,
              data: {
                balances: balanceObject,
                asOfDate: asOfDate || new Date(),
                calculatedAt: new Date()
              }
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to calculate account balances'
            };
          }
        }, {
          body: t.Object({
            accountIds: t.Array(t.String(), { minItems: 1 }),
            asOfDate: t.Optional(t.String({ format: 'date' }))
          })
        })

        // GET /trial-balance - Get trial balance report
        .get('/trial-balance', async ({ query, user }) => {
          try {
            // Check permission
            this.authService.requirePermission(user.role, 'reports:read');

            const asOfDate = query.asOfDate ? new Date(query.asOfDate) : undefined;
            const trialBalance = await this.bookkeepingService.getTrialBalance(asOfDate);

            // Calculate totals
            const totalDebits = trialBalance.reduce((sum, entry) => sum + entry.debitBalance, 0);
            const totalCredits = trialBalance.reduce((sum, entry) => sum + entry.creditBalance, 0);
            const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

            return {
              success: true,
              data: {
                entries: trialBalance,
                totals: {
                  totalDebits: totalDebits.toFixed(2),
                  totalCredits: totalCredits.toFixed(2),
                  difference: (totalDebits - totalCredits).toFixed(2),
                  isBalanced
                },
                asOfDate: asOfDate || new Date(),
                generatedAt: new Date()
              }
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to generate trial balance'
            };
          }
        }, {
          query: t.Object({
            asOfDate: t.Optional(t.String({ format: 'date' }))
          })
        })

        // POST /transactions/:id/rollback - Rollback transaction (create reversing entries)
        .post('/:id/rollback', async ({ params, body, user }) => {
          try {
            // Check permission - require higher privileges for rollback
            this.authService.requirePermission(user.role, 'transactions:rollback');

            const rollbackTransaction = await this.bookkeepingService.rollbackTransaction({
              transactionId: params.id,
              reason: body.reason,
              rollbackBy: user.id
            });

            return {
              success: true,
              data: rollbackTransaction,
              message: 'Transaction rolled back successfully'
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to rollback transaction'
            };
          }
        }, {
          params: t.Object({
            id: t.String()
          }),
          body: t.Object({
            reason: t.String({ minLength: 1, maxLength: 500 })
          })
        })

        // Error handling middleware
        .onError(({ error, code }) => {
          console.error('Transaction Controller Error:', error);
          
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

          if (error.message.includes('double-entry') || error.message.includes('balance')) {
            return {
              success: false,
              error: 'Double-entry bookkeeping validation failed',
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