import { Elysia, t } from 'elysia';
import { AccountRepository, CreateAccountData, UpdateAccountData } from '../repositories/AccountRepository';
import { AuthService } from '../services/AuthService';
import { AccountType, accountTypeEnum } from '../db/schema/accounts';

// Request/Response schemas for validation
const createAccountSchema = t.Object({
  code: t.String({ minLength: 3, maxLength: 10 }),
  name: t.String({ minLength: 1, maxLength: 255 }),
  type: t.Union([
    t.Literal('ASSET'),
    t.Literal('LIABILITY'), 
    t.Literal('EQUITY'),
    t.Literal('REVENUE'),
    t.Literal('EXPENSE')
  ]),
  parentId: t.Optional(t.String()),
  description: t.Optional(t.String({ maxLength: 500 }))
});

const updateAccountSchema = t.Object({
  name: t.Optional(t.String({ minLength: 1, maxLength: 255 })),
  description: t.Optional(t.String({ maxLength: 500 })),
  parentId: t.Optional(t.String())
});

const accountQuerySchema = t.Object({
  type: t.Optional(t.Union([
    t.Literal('ASSET'),
    t.Literal('LIABILITY'),
    t.Literal('EQUITY'), 
    t.Literal('REVENUE'),
    t.Literal('EXPENSE')
  ])),
  isActive: t.Optional(t.Boolean()),
  parentId: t.Optional(t.String()),
  search: t.Optional(t.String())
});

export class AccountController {
  private accountRepository: AccountRepository;
  private authService: AuthService;

  constructor() {
    this.accountRepository = new AccountRepository();
    this.authService = new AuthService();
  }

  /**
   * Setup account routes with ElysiaJS
   */
  setupRoutes(app: Elysia): Elysia {
    return app.group('/accounts', (group) =>
      group
        // Authentication middleware for all account routes
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

        // GET /accounts - List all accounts with optional filtering
        .get('/', async ({ query, user }) => {
          try {
            // Check permission
            this.authService.requirePermission(user.role, 'accounts:read');

            const filters: any = {};
            
            if (query.type) {
              filters.type = query.type as AccountType;
            }
            
            if (query.isActive !== undefined) {
              filters.isActive = query.isActive;
            }
            
            if (query.parentId !== undefined) {
              filters.parentId = query.parentId || null;
            }

            let accounts;
            if (query.search) {
              accounts = await this.accountRepository.search(query.search);
            } else {
              accounts = await this.accountRepository.findAll(filters);
            }

            return {
              success: true,
              data: accounts,
              count: accounts.length
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to fetch accounts'
            };
          }
        }, {
          query: accountQuerySchema
        })

        // GET /accounts/hierarchy - Get account hierarchy tree
        .get('/hierarchy', async ({ query, user }) => {
          try {
            // Check permission
            this.authService.requirePermission(user.role, 'accounts:read');

            const rootType = query.type as AccountType | undefined;
            const hierarchy = await this.accountRepository.getHierarchy(rootType);

            return {
              success: true,
              data: hierarchy
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to fetch account hierarchy'
            };
          }
        }, {
          query: t.Object({
            type: t.Optional(t.Union([
              t.Literal('ASSET'),
              t.Literal('LIABILITY'),
              t.Literal('EQUITY'),
              t.Literal('REVENUE'),
              t.Literal('EXPENSE')
            ]))
          })
        })

        // GET /accounts/:id - Get specific account by ID
        .get('/:id', async ({ params, user }) => {
          try {
            // Check permission
            this.authService.requirePermission(user.role, 'accounts:read');

            const account = await this.accountRepository.findById(params.id);
            
            if (!account) {
              return {
                success: false,
                error: 'Account not found'
              };
            }

            return {
              success: true,
              data: account
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to fetch account'
            };
          }
        }, {
          params: t.Object({
            id: t.String()
          })
        })

        // GET /accounts/code/:code - Get account by code
        .get('/code/:code', async ({ params, user }) => {
          try {
            // Check permission
            this.authService.requirePermission(user.role, 'accounts:read');

            const account = await this.accountRepository.findByCode(params.code);
            
            if (!account) {
              return {
                success: false,
                error: 'Account not found'
              };
            }

            return {
              success: true,
              data: account
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to fetch account'
            };
          }
        }, {
          params: t.Object({
            code: t.String()
          })
        })

        // POST /accounts - Create new account
        .post('/', async ({ body, user }) => {
          try {
            // Check permission
            this.authService.requirePermission(user.role, 'accounts:create');

            const accountData: CreateAccountData = {
              code: body.code,
              name: body.name,
              type: body.type as AccountType,
              parentId: body.parentId,
              description: body.description
            };

            const newAccount = await this.accountRepository.create(accountData);

            return {
              success: true,
              data: newAccount,
              message: 'Account created successfully'
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to create account'
            };
          }
        }, {
          body: createAccountSchema
        })

        // PUT /accounts/:id - Update existing account
        .put('/:id', async ({ params, body, user }) => {
          try {
            // Check permission
            this.authService.requirePermission(user.role, 'accounts:update');

            const updateData: UpdateAccountData = {
              name: body.name,
              description: body.description,
              parentId: body.parentId
            };

            const updatedAccount = await this.accountRepository.update(params.id, updateData);

            return {
              success: true,
              data: updatedAccount,
              message: 'Account updated successfully'
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to update account'
            };
          }
        }, {
          params: t.Object({
            id: t.String()
          }),
          body: updateAccountSchema
        })

        // PATCH /accounts/:id/deactivate - Deactivate account
        .patch('/:id/deactivate', async ({ params, user }) => {
          try {
            // Check permission - require higher privileges for deactivation
            this.authService.requirePermission(user.role, 'accounts:deactivate');

            const deactivatedAccount = await this.accountRepository.deactivate(params.id);

            return {
              success: true,
              data: deactivatedAccount,
              message: 'Account deactivated successfully'
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to deactivate account'
            };
          }
        }, {
          params: t.Object({
            id: t.String()
          })
        })

        // DELETE /accounts/:id - Delete account (only if no transactions)
        .delete('/:id', async ({ params, user }) => {
          try {
            // Check permission - require admin privileges for deletion
            this.authService.requirePermission(user.role, 'accounts:delete');

            await this.accountRepository.delete(params.id);

            return {
              success: true,
              message: 'Account deleted successfully'
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to delete account'
            };
          }
        }, {
          params: t.Object({
            id: t.String()
          })
        })

        // GET /accounts/type/:type - Get accounts by type
        .get('/type/:type', async ({ params, user }) => {
          try {
            // Check permission
            this.authService.requirePermission(user.role, 'accounts:read');

            const accountType = params.type as AccountType;
            
            // Validate account type
            if (!Object.values(accountTypeEnum).includes(accountType)) {
              return {
                success: false,
                error: 'Invalid account type'
              };
            }

            const accounts = await this.accountRepository.getAccountsByType(accountType);

            return {
              success: true,
              data: accounts,
              count: accounts.length
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to fetch accounts by type'
            };
          }
        }, {
          params: t.Object({
            type: t.Union([
              t.Literal('ASSET'),
              t.Literal('LIABILITY'),
              t.Literal('EQUITY'),
              t.Literal('REVENUE'),
              t.Literal('EXPENSE')
            ])
          })
        })

        // Error handling middleware
        .onError(({ error, code }) => {
          console.error('Account Controller Error:', error);
          
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

          return {
            success: false,
            error: 'Internal server error'
          };
        })
    );
  }
}