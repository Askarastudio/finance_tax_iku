import { Elysia, t } from 'elysia';
import { TaxService, VATCalculationInput, TaxRateUpdate, TaxReportData } from '../services/TaxService';
import { IndonesianTaxReportService } from '../services/IndonesianTaxReportService';
import { AuthService } from '../services/AuthService';
import { 
  IndonesianTaxType, 
  VATTransactionType, 
  indonesianTaxTypeEnum, 
  vatTransactionTypeEnum 
} from '../db/schema/tax';

// Request/Response schemas for validation
const vatCalculationSchema = t.Object({
  baseAmount: t.String({ pattern: '^\\d+(\\.\\d{1,2})?$' }),
  transactionType: t.Union([
    t.Literal('STANDARD'),
    t.Literal('ZERO_RATED'),
    t.Literal('EXEMPT'),
    t.Literal('EXPORT'),
    t.Literal('IMPORT'),
    t.Literal('LUXURY_GOODS')
  ]),
  transactionDate: t.String({ format: 'date' }),
  transactionId: t.Optional(t.String()),
  notes: t.Optional(t.String({ maxLength: 500 }))
});

const batchVATCalculationSchema = t.Object({
  calculations: t.Array(vatCalculationSchema, { minItems: 1, maxItems: 100 })
});

const taxRateUpdateSchema = t.Object({
  taxType: t.Union([
    t.Literal('VAT'),
    t.Literal('INCOME_TAX'),
    t.Literal('WITHHOLDING_TAX')
  ]),
  transactionType: t.Optional(t.Union([
    t.Literal('STANDARD'),
    t.Literal('ZERO_RATED'),
    t.Literal('EXEMPT'),
    t.Literal('EXPORT'),
    t.Literal('IMPORT'),
    t.Literal('LUXURY_GOODS')
  ])),
  newRate: t.String({ pattern: '^0(\\.\\d{1,4})?$|^1(\\.0{1,4})?$' }), // 0.0000 to 1.0000
  effectiveDate: t.String({ format: 'date' }),
  description: t.Optional(t.String({ maxLength: 500 })),
  legalReference: t.Optional(t.String({ maxLength: 255 }))
});

const taxReportSchema = t.Object({
  reportType: t.String({ minLength: 1, maxLength: 50 }),
  periodMonth: t.String({ pattern: '^(0[1-9]|1[0-2])$' }), // 01-12
  periodYear: t.String({ pattern: '^\\d{4}$' }), // YYYY
  totalTaxableAmount: t.String({ pattern: '^\\d+(\\.\\d{1,2})?$' }),
  totalTaxAmount: t.String({ pattern: '^\\d+(\\.\\d{1,2})?$' }),
  reportData: t.Optional(t.Any())
});

const luxuryTaxSchema = t.Object({
  baseAmount: t.String({ pattern: '^\\d+(\\.\\d{1,2})?$' }),
  luxuryTaxRate: t.String({ pattern: '^0(\\.\\d{1,4})?$|^1(\\.0{1,4})?$' })
});

export class TaxController {
  private taxService: TaxService;
  private indonesianTaxReportService: IndonesianTaxReportService;
  private authService: AuthService;

  constructor() {
    this.taxService = new TaxService();
    this.indonesianTaxReportService = new IndonesianTaxReportService();
    this.authService = new AuthService();
  }

  /**
   * Setup tax routes with ElysiaJS
   */
  setupRoutes(app: Elysia): Elysia {
    return app.group('/tax', (group) =>
      group
        // Authentication middleware for all tax routes
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

        // POST /tax/vat/calculate - Calculate VAT for single transaction
        .post('/vat/calculate', async ({ body, user }) => {
          try {
            // Check permission
            this.authService.requirePermission(user.role, 'tax:calculate');

            const input: VATCalculationInput = {
              baseAmount: body.baseAmount,
              transactionType: body.transactionType as VATTransactionType,
              transactionDate: new Date(body.transactionDate),
              transactionId: body.transactionId,
              calculatedBy: user.id,
              notes: body.notes
            };

            const result = await this.taxService.calculateVAT(input);

            return {
              success: true,
              data: result,
              metadata: {
                calculatedAt: new Date(),
                calculatedBy: user.id
              }
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to calculate VAT'
            };
          }
        }, {
          body: vatCalculationSchema
        })

        // POST /tax/vat/calculate-batch - Calculate VAT for multiple transactions
        .post('/vat/calculate-batch', async ({ body, user }) => {
          try {
            // Check permission
            this.authService.requirePermission(user.role, 'tax:calculate');

            const inputs: VATCalculationInput[] = body.calculations.map(calc => ({
              baseAmount: calc.baseAmount,
              transactionType: calc.transactionType as VATTransactionType,
              transactionDate: new Date(calc.transactionDate),
              transactionId: calc.transactionId,
              calculatedBy: user.id,
              notes: calc.notes
            }));

            const results = await this.taxService.calculateBatchVAT(inputs);

            return {
              success: true,
              data: results,
              metadata: {
                batchSize: results.length,
                calculatedAt: new Date(),
                calculatedBy: user.id
              }
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to calculate batch VAT'
            };
          }
        }, {
          body: batchVATCalculationSchema
        })

        // GET /tax/rates - Get all active tax configurations
        .get('/rates', async ({ user }) => {
          try {
            // Check permission
            this.authService.requirePermission(user.role, 'tax:read');

            const configurations = await this.taxService.getActiveTaxConfigurations();

            return {
              success: true,
              data: configurations
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to fetch tax rates'
            };
          }
        })

        // GET /tax/rates/:taxType - Get tax rate for specific type and date
        .get('/rates/:taxType', async ({ params, query, user }) => {
          try {
            // Check permission
            this.authService.requirePermission(user.role, 'tax:read');

            const taxType = params.taxType as IndonesianTaxType;
            const transactionType = query.transactionType as VATTransactionType | undefined;
            const effectiveDate = query.effectiveDate ? new Date(query.effectiveDate) : undefined;

            const taxRate = await this.taxService.getApplicableTaxRate(
              taxType,
              transactionType,
              effectiveDate
            );

            if (!taxRate) {
              return {
                success: false,
                error: 'No applicable tax rate found'
              };
            }

            return {
              success: true,
              data: taxRate
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to fetch tax rate'
            };
          }
        }, {
          params: t.Object({
            taxType: t.Union([
              t.Literal('VAT'),
              t.Literal('INCOME_TAX'),
              t.Literal('WITHHOLDING_TAX')
            ])
          }),
          query: t.Object({
            transactionType: t.Optional(t.Union([
              t.Literal('STANDARD'),
              t.Literal('ZERO_RATED'),
              t.Literal('EXEMPT'),
              t.Literal('EXPORT'),
              t.Literal('IMPORT'),
              t.Literal('LUXURY_GOODS')
            ])),
            effectiveDate: t.Optional(t.String({ format: 'date' }))
          })
        })

        // POST /tax/rates - Update tax rate with historical preservation
        .post('/rates', async ({ body, user }) => {
          try {
            // Check permission - require admin privileges for tax rate updates
            this.authService.requirePermission(user.role, 'tax:admin');

            const update: TaxRateUpdate = {
              taxType: body.taxType as IndonesianTaxType,
              transactionType: body.transactionType as VATTransactionType | undefined,
              newRate: body.newRate,
              effectiveDate: new Date(body.effectiveDate),
              description: body.description,
              legalReference: body.legalReference,
              updatedBy: user.id
            };

            const newConfiguration = await this.taxService.updateTaxRate(update);

            return {
              success: true,
              data: newConfiguration,
              message: 'Tax rate updated successfully'
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to update tax rate'
            };
          }
        }, {
          body: taxRateUpdateSchema
        })

        // POST /tax/rates/initialize - Initialize standard Indonesian VAT rates
        .post('/rates/initialize', async ({ user }) => {
          try {
            // Check permission - require admin privileges
            this.authService.requirePermission(user.role, 'tax:admin');

            const configurations = await this.taxService.initializeStandardVATRates(user.id);

            return {
              success: true,
              data: configurations,
              message: 'Standard VAT rates initialized successfully'
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to initialize VAT rates'
            };
          }
        })

        // GET /tax/calculations/:transactionId/history - Get VAT calculation history
        .get('/calculations/:transactionId/history', async ({ params, user }) => {
          try {
            // Check permission
            this.authService.requirePermission(user.role, 'tax:read');

            const history = await this.taxService.getVATCalculationHistory(params.transactionId);

            return {
              success: true,
              data: history
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to fetch VAT calculation history'
            };
          }
        }, {
          params: t.Object({
            transactionId: t.String()
          })
        })

        // POST /tax/validate/vat - Validate VAT calculation consistency
        .post('/validate/vat', async ({ body, user }) => {
          try {
            // Check permission
            this.authService.requirePermission(user.role, 'tax:read');

            const isValid = this.taxService.validateVATCalculation(
              parseFloat(body.baseAmount),
              parseFloat(body.taxRate),
              parseFloat(body.taxAmount),
              parseFloat(body.totalAmount)
            );

            const baseAmount = parseFloat(body.baseAmount);
            const taxRate = parseFloat(body.taxRate);
            const expectedTaxAmount = baseAmount * taxRate;
            const expectedTotalAmount = baseAmount + expectedTaxAmount;

            return {
              success: true,
              data: {
                isValid,
                validation: {
                  baseAmount,
                  taxRate,
                  reportedTaxAmount: parseFloat(body.taxAmount),
                  expectedTaxAmount,
                  reportedTotalAmount: parseFloat(body.totalAmount),
                  expectedTotalAmount,
                  taxAmountDifference: Math.abs(parseFloat(body.taxAmount) - expectedTaxAmount),
                  totalAmountDifference: Math.abs(parseFloat(body.totalAmount) - expectedTotalAmount)
                },
                validatedAt: new Date(),
                validatedBy: user.id
              }
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to validate VAT calculation'
            };
          }
        }, {
          body: t.Object({
            baseAmount: t.String({ pattern: '^\\d+(\\.\\d{1,2})?$' }),
            taxRate: t.String({ pattern: '^0(\\.\\d{1,4})?$|^1(\\.0{1,4})?$' }),
            taxAmount: t.String({ pattern: '^\\d+(\\.\\d{1,2})?$' }),
            totalAmount: t.String({ pattern: '^\\d+(\\.\\d{1,2})?$' })
          })
        })

        // POST /tax/luxury/calculate - Calculate luxury tax (PPnBM)
        .post('/luxury/calculate', async ({ body, user }) => {
          try {
            // Check permission
            this.authService.requirePermission(user.role, 'tax:calculate');

            const result = await this.taxService.calculateLuxuryTax(
              body.baseAmount,
              body.luxuryTaxRate,
              user.id
            );

            return {
              success: true,
              data: result,
              metadata: {
                calculatedAt: new Date(),
                calculatedBy: user.id
              }
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to calculate luxury tax'
            };
          }
        }, {
          body: luxuryTaxSchema
        })

        // POST /tax/reports - Generate tax report for Indonesian compliance
        .post('/reports', async ({ body, user }) => {
          try {
            // Check permission
            this.authService.requirePermission(user.role, 'tax:reports');

            const reportData: TaxReportData = {
              reportType: body.reportType,
              periodMonth: body.periodMonth,
              periodYear: body.periodYear,
              totalTaxableAmount: body.totalTaxableAmount,
              totalTaxAmount: body.totalTaxAmount,
              reportData: body.reportData,
              generatedBy: user.id
            };

            const reportId = await this.taxService.generateTaxReport(reportData);

            return {
              success: true,
              data: {
                reportId,
                reportType: body.reportType,
                period: `${body.periodMonth}/${body.periodYear}`
              },
              message: 'Tax report generated successfully'
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to generate tax report'
            };
          }
        }, {
          body: taxReportSchema
        })

        // POST /tax/reports/indonesian - Generate Indonesian tax authority format report
        .post('/reports/indonesian', async ({ body, user }) => {
          try {
            // Check permission
            this.authService.requirePermission(user.role, 'tax:reports');

            const report = await this.indonesianTaxReportService.generateVATReport(
              parseInt(body.periodMonth),
              parseInt(body.periodYear),
              user.id
            );

            return {
              success: true,
              data: report,
              metadata: {
                generatedAt: new Date(),
                generatedBy: user.id,
                compliance: 'Indonesian Tax Authority Format'
              }
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to generate Indonesian tax report'
            };
          }
        }, {
          body: t.Object({
            periodMonth: t.String({ pattern: '^(0[1-9]|1[0-2])$' }),
            periodYear: t.String({ pattern: '^\\d{4}$' })
          })
        })

        // GET /tax/exemptions/:transactionType - Check if transaction type is exempt
        .get('/exemptions/:transactionType', async ({ params, user }) => {
          try {
            // Check permission
            this.authService.requirePermission(user.role, 'tax:read');

            const transactionType = params.transactionType as VATTransactionType;
            const isExempt = this.taxService.isTransactionExempt(transactionType);

            return {
              success: true,
              data: {
                transactionType,
                isExempt,
                exemptionReason: isExempt ? this.getExemptionReason(transactionType) : null
              }
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to check exemption status'
            };
          }
        }, {
          params: t.Object({
            transactionType: t.Union([
              t.Literal('STANDARD'),
              t.Literal('ZERO_RATED'),
              t.Literal('EXEMPT'),
              t.Literal('EXPORT'),
              t.Literal('IMPORT'),
              t.Literal('LUXURY_GOODS')
            ])
          })
        })

        // GET /tax/transaction-types - Get all supported VAT transaction types
        .get('/transaction-types', async ({ user }) => {
          try {
            // Check permission
            this.authService.requirePermission(user.role, 'tax:read');

            const transactionTypes = [
              {
                type: 'STANDARD',
                description: 'Standard VAT rate applies',
                rate: '11%',
                isExempt: false
              },
              {
                type: 'ZERO_RATED',
                description: 'Zero-rated transactions (0% VAT)',
                rate: '0%',
                isExempt: true
              },
              {
                type: 'EXEMPT',
                description: 'VAT-exempt transactions',
                rate: 'N/A',
                isExempt: true
              },
              {
                type: 'EXPORT',
                description: 'Export transactions (0% VAT)',
                rate: '0%',
                isExempt: true
              },
              {
                type: 'IMPORT',
                description: 'Import transactions (standard VAT)',
                rate: '11%',
                isExempt: false
              },
              {
                type: 'LUXURY_GOODS',
                description: 'Luxury goods (VAT + PPnBM)',
                rate: '11% + PPnBM',
                isExempt: false
              }
            ];

            return {
              success: true,
              data: transactionTypes
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to fetch transaction types'
            };
          }
        })

        // Error handling middleware
        .onError(({ error, code }) => {
          console.error('Tax Controller Error:', error);
          
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

          if (error.message.includes('tax') || error.message.includes('VAT')) {
            return {
              success: false,
              error: 'Tax calculation failed',
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

  /**
   * Get exemption reason for transaction type
   */
  private getExemptionReason(transactionType: VATTransactionType): string {
    switch (transactionType) {
      case vatTransactionTypeEnum.EXEMPT:
        return 'Transaction is VAT-exempt under Indonesian tax law';
      case vatTransactionTypeEnum.ZERO_RATED:
        return 'Zero-rated transaction (0% VAT applies)';
      case vatTransactionTypeEnum.EXPORT:
        return 'Export transaction (0% VAT for exports)';
      default:
        return 'Not exempt';
    }
  }
}