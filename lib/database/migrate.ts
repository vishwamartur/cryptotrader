import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db, client } from './connection';

export async function runMigrations() {
  console.log('🚀 Running database migrations...');
  
  try {
    await migrate(db, { migrationsFolder: './lib/database/migrations' });
    console.log('✅ Database migrations completed successfully');
  } catch (error) {
    console.error('❌ Database migration failed:', error);
    throw error;
  }
}

export async function createDatabase() {
  console.log('🏗️  Creating database schema...');
  
  try {
    // Check if we can connect to the database
    await client`SELECT 1`;
    console.log('✅ Database connection established');
    
    // Run migrations
    await runMigrations();
    
    console.log('🎉 Database setup completed successfully');
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    throw error;
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  createDatabase()
    .then(() => {
      console.log('Database setup completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Database setup failed:', error);
      process.exit(1);
    });
}
