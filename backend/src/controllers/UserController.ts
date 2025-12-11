import { Elysia, t } from 'elysia';
import { AuthService, CreateUserData, LoginCredentials, PasswordChangeData } from '../services/AuthService';
import { UserRole, userRoleEnum } from '../db/schema/users';

// Request/Response schemas for validation
const loginSchema = t.Object({
  email: t.String({ format: 'email' }),
  password: t.String({ minLength: 6 })
});

const createUserSchema = t.Object({
  email: t.String({ format: 'email' }),
  name: t.String({ minLength: 1, maxLength: 255 }),
  password: t.String({ minLength: 8, maxLength: 128 }),
  role: t.Union([
    t.Literal('ADMIN'),
    t.Literal('ACCOUNTANT'),
    t.Literal('BOOKKEEPER'),
    t.Literal('VIEWER')
  ])
});

const changePasswordSchema = t.Object({
  currentPassword: t.String({ minLength: 6 }),
  newPassword: t.String({ minLength: 8, maxLength: 128 })
});

const supervisoryAuthSchema = t.Object({
  supervisorToken: t.String(),
  operation: t.String({ minLength: 1, maxLength: 255 })
});

export class UserController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  /**
   * Setup user and authentication routes with ElysiaJS
   */
  setupRoutes(app: Elysia): Elysia {
    return app.group('/auth', (group) =>
      group
        // POST /auth/login - User authentication
        .post('/login', async ({ body }) => {
          try {
            const credentials: LoginCredentials = {
              email: body.email,
              password: body.password
            };

            const session = await this.authService.authenticateUser(credentials);

            return {
              success: true,
              data: {
                user: {
                  id: session.id,
                  email: session.email,
                  name: session.name,
                  role: session.role,
                  lastLoginAt: session.lastLoginAt
                },
                sessionToken: session.sessionToken,
                expiresAt: session.expiresAt
              },
              message: 'Login successful'
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Login failed'
            };
          }
        }, {
          body: loginSchema
        })

        // POST /auth/logout - User logout
        .post('/logout', async ({ headers }) => {
          try {
            const authHeader = headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
              return {
                success: false,
                error: 'Authorization header required'
              };
            }

            const token = authHeader.substring(7);
            await this.authService.logoutUser(token);

            return {
              success: true,
              message: 'Logout successful'
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Logout failed'
            };
          }
        })

        // GET /auth/validate - Validate session token
        .get('/validate', async ({ headers }) => {
          try {
            const authHeader = headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
              return {
                success: false,
                error: 'Authorization header required'
              };
            }

            const token = authHeader.substring(7);
            const validation = await this.authService.validateSession(token);

            if (!validation.isValid || !validation.user) {
              return {
                success: false,
                error: validation.reason || 'Invalid session'
              };
            }

            return {
              success: true,
              data: {
                user: validation.user,
                isValid: true
              }
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Session validation failed'
            };
          }
        })

        // Authentication middleware for protected routes
        .derive(async ({ headers, path }) => {
          // Skip authentication for login, logout, and validate endpoints
          if (path.includes('/login') || path.includes('/logout') || path.includes('/validate')) {
            return {};
          }

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

        // POST /auth/users - Create new user (admin only)
        .post('/users', async ({ body, user }) => {
          try {
            // Check permission - only admins can create users
            this.authService.requirePermission(user.role, 'users:create');

            const userData: CreateUserData = {
              email: body.email,
              name: body.name,
              password: body.password,
              role: body.role as UserRole
            };

            const newUser = await this.authService.createUser(userData, user.id);

            return {
              success: true,
              data: {
                id: newUser.id,
                email: newUser.email,
                name: newUser.name,
                role: newUser.role,
                isActive: newUser.isActive,
                createdAt: newUser.createdAt
              },
              message: 'User created successfully'
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to create user'
            };
          }
        }, {
          body: createUserSchema
        })

        // POST /auth/change-password - Change user password
        .post('/change-password', async ({ body, user }) => {
          try {
            const passwordData: PasswordChangeData = {
              userId: user.id,
              currentPassword: body.currentPassword,
              newPassword: body.newPassword,
              changedBy: user.id
            };

            await this.authService.changePassword(passwordData);

            return {
              success: true,
              message: 'Password changed successfully'
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to change password'
            };
          }
        }, {
          body: changePasswordSchema
        })

        // POST /auth/users/:userId/deactivate - Deactivate user (admin only)
        .post('/users/:userId/deactivate', async ({ params, user }) => {
          try {
            // Check permission - only admins can deactivate users
            this.authService.requirePermission(user.role, 'users:deactivate');

            await this.authService.deactivateUser(params.userId, user.id);

            return {
              success: true,
              message: 'User deactivated successfully'
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to deactivate user'
            };
          }
        }, {
          params: t.Object({
            userId: t.String()
          })
        })

        // POST /auth/supervisory-auth - Require supervisory authorization
        .post('/supervisory-auth', async ({ body, user }) => {
          try {
            await this.authService.requireSupervisoryAuth(
              user.role,
              body.supervisorToken,
              body.operation
            );

            return {
              success: true,
              message: 'Supervisory authorization granted'
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Supervisory authorization failed'
            };
          }
        }, {
          body: supervisoryAuthSchema
        })

        // GET /auth/permissions/:permission - Check if user has specific permission
        .get('/permissions/:permission', async ({ params, user }) => {
          try {
            const hasPermission = this.authService.checkPermission(user.role, params.permission);

            return {
              success: true,
              data: {
                permission: params.permission,
                hasPermission,
                userRole: user.role
              }
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to check permission'
            };
          }
        }, {
          params: t.Object({
            permission: t.String()
          })
        })

        // GET /auth/resource-access/:resource/:action - Check resource access
        .get('/resource-access/:resource/:action', async ({ params, user }) => {
          try {
            const hasAccess = this.authService.checkResourceAccess(
              user.role,
              params.resource,
              params.action
            );

            return {
              success: true,
              data: {
                resource: params.resource,
                action: params.action,
                hasAccess,
                userRole: user.role
              }
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to check resource access'
            };
          }
        }, {
          params: t.Object({
            resource: t.String(),
            action: t.String()
          })
        })

        // GET /auth/sessions - Get active sessions (admin only)
        .get('/sessions', async ({ user }) => {
          try {
            // Check permission - only admins can view all sessions
            this.authService.requirePermission(user.role, 'sessions:read');

            const activeSessions = this.authService.getActiveSessions();

            // Remove sensitive information before returning
            const sanitizedSessions = activeSessions.map(session => ({
              id: session.id,
              email: session.email,
              name: session.name,
              role: session.role,
              lastLoginAt: session.lastLoginAt,
              expiresAt: session.expiresAt,
              sessionToken: session.sessionToken.substring(0, 8) + '...' // Partial token for identification
            }));

            return {
              success: true,
              data: sanitizedSessions,
              count: sanitizedSessions.length
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to fetch active sessions'
            };
          }
        })

        // POST /auth/sessions/:userId/invalidate - Force logout user sessions (admin only)
        .post('/sessions/:userId/invalidate', async ({ params, user }) => {
          try {
            // Check permission - only admins can invalidate other user sessions
            this.authService.requirePermission(user.role, 'sessions:invalidate');

            await this.authService.invalidateUserSessions(params.userId);

            return {
              success: true,
              message: 'User sessions invalidated successfully'
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to invalidate user sessions'
            };
          }
        }, {
          params: t.Object({
            userId: t.String()
          })
        })

        // GET /auth/roles - Get available user roles
        .get('/roles', async ({ user }) => {
          try {
            // Check permission
            this.authService.requirePermission(user.role, 'users:read');

            const roles = [
              {
                role: 'ADMIN',
                description: 'Full system access and user management',
                permissions: ['All permissions']
              },
              {
                role: 'ACCOUNTANT',
                description: 'Financial reporting and account management',
                permissions: ['accounts:*', 'transactions:*', 'reports:*', 'tax:*']
              },
              {
                role: 'BOOKKEEPER',
                description: 'Transaction entry and basic reporting',
                permissions: ['accounts:read', 'transactions:*', 'reports:read']
              },
              {
                role: 'VIEWER',
                description: 'Read-only access to reports and data',
                permissions: ['accounts:read', 'transactions:read', 'reports:read']
              }
            ];

            return {
              success: true,
              data: roles
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to fetch user roles'
            };
          }
        })

        // Error handling middleware
        .onError(({ error, code }) => {
          console.error('User Controller Error:', error);
          
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

          if (error.message.includes('password')) {
            return {
              success: false,
              error: 'Password operation failed',
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