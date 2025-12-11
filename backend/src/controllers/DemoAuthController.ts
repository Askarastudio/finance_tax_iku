import { Elysia, t } from 'elysia';
import { DemoAuthService } from '../services/DemoAuthService';

export const DemoAuthController = new Elysia({ prefix: '/api/auth' })
  .post('/login', async ({ body }) => {
    try {
      const { email, password } = body as { email: string; password: string };
      
      const result = DemoAuthService.authenticate({ email, password });
      
      if (!result.success) {
        return {
          success: false,
          error: result.message || 'Authentication failed'
        };
      }

      return {
        success: true,
        user: result.user,
        token: result.token
      };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: 'Internal server error'
      };
    }
  }, {
    body: t.Object({
      email: t.String(),
      password: t.String()
    })
  })

  .get('/me', async ({ headers }) => {
    try {
      const authorization = headers.authorization;
      if (!authorization || !authorization.startsWith('Bearer ')) {
        return {
          success: false,
          error: 'No token provided'
        };
      }

      const token = authorization.substring(7);
      const result = DemoAuthService.validateToken(token);
      
      if (!result.success) {
        return {
          success: false,
          error: result.message || 'Invalid token'
        };
      }

      return {
        success: true,
        user: result.user
      };
    } catch (error) {
      console.error('Token validation error:', error);
      return {
        success: false,
        error: 'Internal server error'
      };
    }
  })

  .post('/logout', async ({ headers }) => {
    try {
      const authorization = headers.authorization;
      if (authorization && authorization.startsWith('Bearer ')) {
        const token = authorization.substring(7);
        DemoAuthService.logout(token);
      }

      return {
        success: true,
        message: 'Logged out successfully'
      };
    } catch (error) {
      console.error('Logout error:', error);
      return {
        success: false,
        error: 'Internal server error'
      };
    }
  })

  .get('/demo-users', async () => {
    try {
      const users = DemoAuthService.getDemoUsers();
      return {
        success: true,
        users,
        credentials: [
          { email: 'admin@company.com', password: 'admin123', role: 'Administrator' },
          { email: 'accountant@company.com', password: 'accountant123', role: 'Accountant' },
          { email: 'bookkeeper@company.com', password: 'bookkeeper123', role: 'Bookkeeper' },
          { email: 'viewer@company.com', password: 'viewer123', role: 'Viewer' }
        ]
      };
    } catch (error) {
      console.error('Demo users error:', error);
      return {
        success: false,
        error: 'Internal server error'
      };
    }
  });