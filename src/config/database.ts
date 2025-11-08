import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { environment } from './environment';
import * as schema from '../database/schema';

// Create PostgreSQL connection pool
// Production uses DATABASE_URL (Railway/Render)
// Development uses individual connection params
export const pool = environment.nodeEnv === 'production' && environment.database.url
  ? new Pool({
      connectionString: environment.database.url,
      ssl: { rejectUnauthorized: false }, // Required for Railway/Render
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    })
  : new Pool({
      host: environment.database.host,
      port: environment.database.port,
      user: environment.database.user,
      password: environment.database.password,
      database: environment.database.database,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

// Create Drizzle ORM instance
export const db = drizzle(pool, { schema });

// Connection event handlers
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL');
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL error:', err);
});

// Test database connection
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    console.log('✅ PostgreSQL connection test successful');
    return true;
  } catch (error) {
    console.error('❌ PostgreSQL connection test failed:', error);
    return false;
  }
}

// Graceful shutdown
export async function closeDatabaseConnection(): Promise<void> {
  await pool.end();
}
