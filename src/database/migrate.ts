import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db } from '../config/database';
import { pool } from '../config/database';
import * as fs from 'fs';

async function runMigrations() {
  console.log('🔄 Running database migrations...');
  
  try {
    // Determine migrations folder based on whether we're running from src or dist
    const migrationsFolder = fs.existsSync('./dist/database/migrations')
      ? './dist/database/migrations'
      : './src/database/migrations';
    
    console.log(`📁 Using migrations folder: ${migrationsFolder}`);
    
    await migrate(db, { migrationsFolder });
    console.log('✅ Migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
