import { Elysia, t } from 'elysia';
import { ReportService, ReportFilters, ReportExportOptions } from '../services/ReportService';
import { AuthService } from '../services/AuthService';
import { AccountType, accountTypeEnum } from '../db/schema/accounts';

// Request/Response schemas for validation
const reportFiltersSchema = t.Object({
  dateFrom: t.Optional(t.String({ format: 'date' })),
  dateTo: t.Optional(t.String({ format: 'date' })),
  accountIds: t.Optional(t.Array(t.String())),
  accountTypes: t.Optional(t.Array(t.Union([
    t.Literal('ASSET'),
    t.Literal('LIABILITY'),
    t.Literal('EQUITY'),
    t.Literal('REVENUE'),
    t.Literal('EXPENSE')
  ]))),
  includeInactive: t.Optional(t.Boolean())
});

const exportOptionsSchema = t.Object({
  format: t.Union([
    t.Literal('PDF'),
    t.Literal('EXCEL'),
    t.Literal('CSV')
  ]),
  includeMetadata: t.Optional(t.Boolean()),
  companyInfo: t.Optional(t.Object({
    name: t.String(),
    address: t.Optional(t.String()),
    taxId: t.Optional(t.String())
  }))
});

const balanceSheetRequestSchema = t.Object({
  asOfDate: t.String({ format: 'date' }),
  filters: t.Optional(reportFiltersSchema)
});

const incomeStatementRequestSchema = t.Object({
  periodStart: t.String({ format: 'date' }),
  periodEnd: t.String({ format: 'date' }),
  filters: t.Optional(reportFiltersSchema)
});

const cashFlowRequestSchema = t.Object({
  periodStart: t.String({ format: 'date' }),
  periodEnd: t.String({ format: 'date' }),
  filters: t.Optional(reportFiltersSchema)
});

const exportRequestSchema = t.Object({
  reportType: t.Union([
    t.Literal('balance-sheet'),
    t.Literal('income-statement'),
    t.Literal('cash-flow')
  ]),
  reportData: t.Any(), // The actual report data
  exportOptions: exportOptionsSchema
});

export class ReportController {
  private reportService: ReportService;
  private authService: AuthService;

  constructor() {
    this.reportService = new ReportService();
    this.authService = new AuthService();
  }

  /**
   * Setup report routes with ElysiaJS
   */
  setupRoutes(app: Elysia): Elysia {
    return app.group('/reports', (group) =>
      group
        // Authentication middleware for all report routes
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

        // POST /reports/balance-sheet - Generate balance sheet
        .post('/balance-sheet', async ({ body, user }) => {
          try {
            // Check permission
            this.authService.requirePermission(user.role, 'reports:read');

            const asOfDate = new Date(body.asOfDate);
            const filters: ReportFilters | undefined = body.filters ? {
              dateFrom: body.filters.dateFrom ? new Date(body.filters.dateFrom) : undefined,
              dateTo: body.filters.dateTo ? new Date(body.filters.dateTo) : undefined,
              accountIds: body.filters.accountIds,
              accountTypes: body.filters.accountTypes as AccountType[] | undefined,
              includeInactive: body.filters.includeInactive
            } : undefined;

            const balanceSheet = await this.reportService.generateBalanceSheet(asOfDate, filters);

            return {
              success: true,
              data: balanceSheet,
              metadata: {
                reportType: 'balance-sheet',
                generatedAt: new Date(),
                generatedBy: user.id
              }
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to generate balance sheet'
            };
          }
        }, {
          body: balanceSheetRequestSchema
        })

        // POST /reports/income-statement - Generate income statement
        .post('/income-statement', async ({ body, user }) => {
          try {
            // Check permission
            this.authService.requirePermission(user.role, 'reports:read');

            const periodStart = new Date(body.periodStart);
            const periodEnd = new Date(body.periodEnd);
            
            // Validate period
            if (periodStart >= periodEnd) {
              return {
                success: false,
                error: 'Period start date must be before period end date'
              };
            }

            const filters: ReportFilters | undefined = body.filters ? {
              dateFrom: body.filters.dateFrom ? new Date(body.filters.dateFrom) : undefined,
              dateTo: body.filters.dateTo ? new Date(body.filters.dateTo) : undefined,
              accountIds: body.filters.accountIds,
              accountTypes: body.filters.accountTypes as AccountType[] | undefined,
              includeInactive: body.filters.includeInactive
            } : undefined;

            const incomeStatement = await this.reportService.generateIncomeStatement(
              periodStart,
              periodEnd,
              filters
            );

            return {
              success: true,
              data: incomeStatement,
              metadata: {
                reportType: 'income-statement',
                generatedAt: new Date(),
                generatedBy: user.id
              }
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to generate income statement'
            };
          }
        }, {
          body: incomeStatementRequestSchema
        })

        // POST /reports/cash-flow - Generate cash flow statement
        .post('/cash-flow', async ({ body, user }) => {
          try {
            // Check permission
            this.authService.requirePermission(user.role, 'reports:read');

            const periodStart = new Date(body.periodStart);
            const periodEnd = new Date(body.periodEnd);
            
            // Validate period
            if (periodStart >= periodEnd) {
              return {
                success: false,
                error: 'Period start date must be before period end date'
              };
            }

            const filters: ReportFilters | undefined = body.filters ? {
              dateFrom: body.filters.dateFrom ? new Date(body.filters.dateFrom) : undefined,
              dateTo: body.filters.dateTo ? new Date(body.filters.dateTo) : undefined,
              accountIds: body.filters.accountIds,
              accountTypes: body.filters.accountTypes as AccountType[] | undefined,
              includeInactive: body.filters.includeInactive
            } : undefined;

            const cashFlowStatement = await this.reportService.generateCashFlowStatement(
              periodStart,
              periodEnd,
              filters
            );

            return {
              success: true,
              data: cashFlowStatement,
              metadata: {
                reportType: 'cash-flow-statement',
                generatedAt: new Date(),
                generatedBy: user.id
              }
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to generate cash flow statement'
            };
          }
        }, {
          body: cashFlowRequestSchema
        })

        // POST /reports/export - Export report to various formats
        .post('/export', async ({ body, user }) => {
          try {
            // Check permission
            this.authService.requirePermission(user.role, 'reports:export');

            const exportOptions: ReportExportOptions = {
              format: body.exportOptions.format,
              includeMetadata: body.exportOptions.includeMetadata,
              companyInfo: body.exportOptions.companyInfo
            };

            let exportResult;

            switch (body.reportType) {
              case 'balance-sheet':
                exportResult = await this.reportService.exportBalanceSheet(
                  body.reportData,
                  exportOptions
                );
                break;
              
              case 'income-statement':
                exportResult = await this.reportService.exportIncomeStatement(
                  body.reportData,
                  exportOptions
                );
                break;
              
              case 'cash-flow':
                exportResult = await this.reportService.exportCashFlowStatement(
                  body.reportData,
                  exportOptions
                );
                break;
              
              default:
                return {
                  success: false,
                  error: 'Invalid report type for export'
                };
            }

            return {
              success: true,
              data: {
                filename: exportResult.filename,
                mimeType: exportResult.mimeType,
                content: exportResult.content,
                size: exportResult.content.length
              },
              metadata: {
                exportedAt: new Date(),
                exportedBy: user.id,
                format: body.exportOptions.format
              }
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to export report'
            };
          }
        }, {
          body: exportRequestSchema
        })

        // POST /reports/validate/balance-sheet - Validate balance sheet equation
        .post('/validate/balance-sheet', async ({ body, user }) => {
          try {
            // Check permission
            this.authService.requirePermission(user.role, 'reports:read');

            const isValid = this.reportService.validateBalanceSheetEquation(
              body.totalAssets,
              body.totalLiabilities,
              body.totalEquity
            );

            const assets = parseFloat(body.totalAssets);
            const liabilities = parseFloat(body.totalLiabilities);
            const equity = parseFloat(body.totalEquity);
            const difference = assets - (liabilities + equity);

            return {
              success: true,
              data: {
                isValid,
                equation: {
                  assets,
                  liabilities,
                  equity,
                  liabilitiesAndEquity: liabilities + equity,
                  difference: Math.abs(difference),
                  formula: 'Assets = Liabilities + Equity'
                },
                validatedAt: new Date(),
                validatedBy: user.id
              }
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to validate balance sheet'
            };
          }
        }, {
          body: t.Object({
            totalAssets: t.String({ pattern: '^\\d+(\\.\\d{1,2})?$' }),
            totalLiabilities: t.String({ pattern: '^\\d+(\\.\\d{1,2})?$' }),
            totalEquity: t.String({ pattern: '^\\d+(\\.\\d{1,2})?$' })
          })
        })

        // POST /reports/validate/income-statement - Validate income statement calculation
        .post('/validate/income-statement', async ({ body, user }) => {
          try {
            // Check permission
            this.authService.requirePermission(user.role, 'reports:read');

            const isValid = this.reportService.validateIncomeStatementCalculation(
              body.totalRevenue,
              body.totalExpenses,
              body.netIncome
            );

            const revenue = parseFloat(body.totalRevenue);
            const expenses = parseFloat(body.totalExpenses);
            const netIncome = parseFloat(body.netIncome);
            const calculatedNetIncome = revenue - expenses;
            const difference = Math.abs(netIncome - calculatedNetIncome);

            return {
              success: true,
              data: {
                isValid,
                calculation: {
                  revenue,
                  expenses,
                  reportedNetIncome: netIncome,
                  calculatedNetIncome,
                  difference,
                  formula: 'Net Income = Total Revenue - Total Expenses'
                },
                validatedAt: new Date(),
                validatedBy: user.id
              }
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to validate income statement'
            };
          }
        }, {
          body: t.Object({
            totalRevenue: t.String({ pattern: '^\\d+(\\.\\d{1,2})?$' }),
            totalExpenses: t.String({ pattern: '^\\d+(\\.\\d{1,2})?$' }),
            netIncome: t.String({ pattern: '^-?\\d+(\\.\\d{1,2})?$' }) // Can be negative
          })
        })

        // GET /reports/templates - Get available report templates
        .get('/templates', async ({ user }) => {
          try {
            // Check permission
            this.authService.requirePermission(user.role, 'reports:read');

            const templates = [
              {
                id: 'balance-sheet-standard',
                name: 'Standard Balance Sheet',
                description: 'Indonesian standard balance sheet format',
                type: 'balance-sheet',
                compliance: 'Indonesian GAAP'
              },
              {
                id: 'income-statement-standard',
                name: 'Standard Income Statement',
                description: 'Indonesian standard income statement format',
                type: 'income-statement',
                compliance: 'Indonesian GAAP'
              },
              {
                id: 'cash-flow-indirect',
                name: 'Cash Flow Statement (Indirect Method)',
                description: 'Cash flow statement using indirect method',
                type: 'cash-flow',
                compliance: 'Indonesian GAAP'
              }
            ];

            return {
              success: true,
              data: templates
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to fetch report templates'
            };
          }
        })

        // GET /reports/formats - Get supported export formats
        .get('/formats', async ({ user }) => {
          try {
            // Check permission
            this.authService.requirePermission(user.role, 'reports:read');

            const formats = [
              {
                format: 'PDF',
                description: 'Portable Document Format',
                mimeType: 'application/pdf',
                extension: '.pdf',
                features: ['Professional formatting', 'Print-ready', 'Audit compliance']
              },
              {
                format: 'EXCEL',
                description: 'Microsoft Excel Spreadsheet',
                mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                extension: '.xlsx',
                features: ['Editable', 'Formulas', 'Data analysis']
              },
              {
                format: 'CSV',
                description: 'Comma Separated Values',
                mimeType: 'text/csv',
                extension: '.csv',
                features: ['Universal compatibility', 'Data import/export', 'Lightweight']
              }
            ];

            return {
              success: true,
              data: formats
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to fetch export formats'
            };
          }
        })

        // Error handling middleware
        .onError(({ error, code }) => {
          console.error('Report Controller Error:', error);
          
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

          if (error.message.includes('balance sheet') || error.message.includes('equation')) {
            return {
              success: false,
              error: 'Balance sheet validation failed',
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