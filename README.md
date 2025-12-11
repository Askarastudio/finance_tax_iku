# Finance Tax IKU (finance_tax_iku)

Finance Tax Application Website using Bun Framework - A comprehensive financial management system specifically designed for Indonesian PT Companies (Perseroan Terbatas). The system implements double-entry bookkeeping principles and provides complete tax compliance features aligned with Indonesian regulations.

## 🎯 Features

- **Double-Entry Bookkeeping**: Complete accounting system with automatic balance validation
- **Indonesian Tax Compliance**: VAT calculations and tax reporting for Indonesian regulations
- **Financial Reporting**: Balance sheets, income statements, and cash flow statements
- **User Management**: Role-based access control with audit trails
- **Data Import/Export**: Support for CSV, Excel, and XML formats
- **Real-time Dashboard**: Financial KPIs and performance indicators

## 🚀 Technology Stack

### Backend
- **Runtime**: Bun v1.1+
- **Framework**: ElysiaJS
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: JWT with role-based access control

### Frontend
- **Framework**: React 18+ with Vite
- **UI**: Tailwind CSS with Shadcn/UI components
- **State Management**: Zustand
- **Forms**: React Hook Form with Zod validation

## 📁 Project Structure

```
├── backend/                 # Backend API (ElysiaJS + Drizzle)
│   ├── src/
│   │   ├── controllers/     # API route handlers
│   │   ├── services/        # Business logic
│   │   ├── repositories/    # Data access layer
│   │   ├── db/             # Database schema and migrations
│   │   └── types/          # TypeScript type definitions
│   └── package.json
├── frontend/               # Frontend React app
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── store/          # Zustand stores
│   │   └── types/          # TypeScript type definitions
│   └── package.json
└── package.json           # Root workspace configuration
```

## 🛠️ Getting Started

### Prerequisites

- Bun v1.1 or higher
- PostgreSQL 14 or higher
- Node.js 18+ (for compatibility)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Askarastudio/finance_tax_iku.git
cd finance_tax_iku
```

2. Install dependencies:
```bash
bun install
```

3. Set up environment variables:
```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your database credentials
```

4. Set up the database:
```bash
# Create database
createdb finance_tax_compliance

# Run migrations
bun run db:migrate
```

5. Start the development servers:
```bash
# Start both backend and frontend
bun run dev

# Or start individually
bun run dev:backend
bun run dev:frontend
```

### Available Scripts

- `bun run dev` - Start both backend and frontend in development mode
- `bun run build` - Build both applications for production
- `bun run test` - Run all tests
- `bun run db:generate` - Generate database migrations
- `bun run db:migrate` - Run database migrations
- `bun run db:studio` - Open Drizzle Studio for database management

## 🧪 Testing

The project includes comprehensive testing with **88 passing tests**:
- Unit tests for business logic
- Property-based tests for mathematical invariants
- Integration tests for API endpoints
- Frontend component tests

Run tests with:
```bash
bun run test
```

### Test Coverage
✅ Account management and validation  
✅ Double-entry bookkeeping  
✅ Indonesian tax calculations (VAT)  
✅ Currency conversion accuracy  
✅ Financial reporting (Balance Sheet, Income Statement)  
✅ Data import/export validation  
✅ Role-based access control  
✅ Audit trail completeness  

## 🇮🇩 Indonesian Compliance Features

This system is specifically designed for Indonesian PT companies and includes:

- **Chart of Accounts**: Structured according to Indonesian accounting standards
- **VAT Calculations**: Automatic PPN (Pajak Pertambahan Nilai) calculations
- **Tax Reporting**: Electronic filing format generation
- **Audit Trails**: Complete activity logging for compliance
- **Multi-currency**: Support for IDR and foreign currencies

## 🔧 Development

### Database Management

The project uses Drizzle ORM for database management. Schema definitions are located in `backend/src/db/schema/`.

To make schema changes:
1. Modify schema files in `backend/src/db/schema/`
2. Generate migration: `bun run db:generate`
3. Run migration: `bun run db:migrate`

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.
