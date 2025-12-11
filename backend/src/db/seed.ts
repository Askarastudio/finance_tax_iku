import { db } from './connection';
import { users, UserRole } from './schema/users';

async function seedDatabase() {
  console.log('🌱 Seeding database...');

  try {
    // Create demo users
    const demoUsers = [
      {
        email: 'admin@company.com',
        name: 'Administrator',
        password: 'admin123',
        role: 'administrator' as UserRole
      },
      {
        email: 'accountant@company.com',
        name: 'Akuntan',
        password: 'accountant123',
        role: 'accountant' as UserRole
      },
      {
        email: 'bookkeeper@company.com',
        name: 'Pembukuan',
        password: 'bookkeeper123',
        role: 'bookkeeper' as UserRole
      },
      {
        email: 'viewer@company.com',
        name: 'Viewer',
        password: 'viewer123',
        role: 'viewer' as UserRole
      }
    ];

    for (const userData of demoUsers) {
      // Hash password (simple base64 for demo - NOT SECURE for production)
      const passwordHash = Buffer.from(userData.password).toString('base64');
      
      // Check if user already exists
      const existingUser = await db.select().from(users).where(eq(users.email, userData.email));
      
      if (existingUser.length === 0) {
        await db.insert(users).values({
          email: userData.email,
          name: userData.name,
          passwordHash,
          role: userData.role,
          updatedAt: new Date()
        });
        
        console.log(`✅ Created user: ${userData.email} (${userData.role})`);
      } else {
        console.log(`⚠️  User already exists: ${userData.email}`);
      }
    }

    console.log('🎉 Database seeding completed!');
    console.log('\n📋 Demo Login Credentials:');
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│                    DEMO ACCOUNTS                        │');
    console.log('├─────────────────────────────────────────────────────────┤');
    console.log('│ Administrator:                                          │');
    console.log('│   Email: admin@company.com                              │');
    console.log('│   Password: admin123                                    │');
    console.log('├─────────────────────────────────────────────────────────┤');
    console.log('│ Accountant:                                             │');
    console.log('│   Email: accountant@company.com                         │');
    console.log('│   Password: accountant123                               │');
    console.log('├─────────────────────────────────────────────────────────┤');
    console.log('│ Bookkeeper:                                             │');
    console.log('│   Email: bookkeeper@company.com                         │');
    console.log('│   Password: bookkeeper123                               │');
    console.log('├─────────────────────────────────────────────────────────┤');
    console.log('│ Viewer:                                                 │');
    console.log('│   Email: viewer@company.com                             │');
    console.log('│   Password: viewer123                                   │');
    console.log('└─────────────────────────────────────────────────────────┘');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  }
}

// Import eq function
import { eq } from 'drizzle-orm';

// Run seeder if called directly
if (import.meta.main) {
  seedDatabase()
    .then(() => {
      console.log('Seeding completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seeding failed:', error);
      process.exit(1);
    });
}

export { seedDatabase };