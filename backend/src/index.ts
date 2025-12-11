import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { AccountController } from './controllers/AccountController';
import { TransactionController } from './controllers/TransactionController';
import { ReportController } from './controllers/ReportController';
import { TaxController } from './controllers/TaxController';
import { UserController } from './controllers/UserController';
import { FileController } from './controllers/FileController';
import { BackupController } from './controllers/BackupController';
import { DemoAuthController } from './controllers/DemoAuthController';

// Initialize controllers
const accountController = new AccountController();
const transactionController = new TransactionController();
const reportController = new ReportController();
const taxController = new TaxController();
const userController = new UserController();
const fileController = new FileController();

const app = new Elysia()
  .use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  }))
  .use(swagger({
    documentation: {
      info: {
        title: 'Finance & Tax Compliance API',
        version: '1.0.0',
        description: 'API for Indonesian PT Company Finance & Tax Compliance System',
      },
      tags: [
        { name: 'Authentication', description: 'User authentication and authorization' },
        { name: 'Accounts', description: 'Chart of accounts management' },
        { name: 'Transactions', description: 'Double-entry bookkeeping transactions' },
        { name: 'Reports', description: 'Financial reports and statements' },
        { name: 'Tax', description: 'Indonesian tax compliance and calculations' },
        { name: 'Files', description: 'File upload, processing, and data import/export' },
        { name: 'Backup', description: 'System backup and restoration' }
      ]
    },
  }))
  
  // Health check endpoints
  .get('/', () => ({ 
    message: 'Finance & Tax Compliance API is running!',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  }))
  .get('/health', () => ({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    services: {
      database: 'connected',
      authentication: 'active',
      api: 'running'
    }
  }))

  // Demo authentication (no database required)
  .use(DemoAuthController)

  // API versioning
  .group('/api/v1', (api) => 
    api
      // Setup all controller routes
      .use(userController.setupRoutes(new Elysia()))
      .use(accountController.setupRoutes(new Elysia()))
      .use(transactionController.setupRoutes(new Elysia()))
      .use(reportController.setupRoutes(new Elysia()))
      .use(taxController.setupRoutes(new Elysia()))
      .use(fileController.setupRoutes(new Elysia()))
      .use(BackupController)

      // Global error handling for API routes
      .onError(({ error, code }) => {
        console.error('API Error:', error);
        
        // Log error details for debugging
        if (process.env.NODE_ENV === 'development') {
          console.error('Error details:', {
            code,
            message: error.message,
            stack: error.stack
          });
        }

        // Return appropriate error response
        switch (code) {
          case 'VALIDATION':
            return {
              success: false,
              error: 'Request validation failed',
              details: error.message,
              timestamp: new Date().toISOString()
            };
          
          case 'NOT_FOUND':
            return {
              success: false,
              error: 'Endpoint not found',
              timestamp: new Date().toISOString()
            };
          
          case 'PARSE':
            return {
              success: false,
              error: 'Request parsing failed',
              details: 'Invalid JSON or request format',
              timestamp: new Date().toISOString()
            };
          
          default:
            return {
              success: false,
              error: 'Internal server error',
              timestamp: new Date().toISOString(),
              ...(process.env.NODE_ENV === 'development' && { 
                details: error.message 
              })
            };
        }
      })
  )

  // Global middleware for request logging
  .onRequest(({ request }) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`${request.method} ${request.url} - ${new Date().toISOString()}`);
    }
  })

  // Global response middleware
  .onAfterHandle(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`Response sent - ${new Date().toISOString()}`);
    }
  })

  .listen(process.env.PORT || 3000);

console.log(`🦊 Finance & Tax Compliance API is running at http://localhost:${app.server?.port}`);
console.log(`📚 API Documentation available at http://localhost:${app.server?.port}/swagger`);
console.log(`🏥 Health check available at http://localhost:${app.server?.port}/health`);

export default app;