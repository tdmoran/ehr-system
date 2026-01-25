import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_N8uWQfalCY0o@ep-winter-block-ahidrsiy-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const isCloudDB = connectionString.includes('supabase.co') ||
                  connectionString.includes('supabase.com') ||
                  connectionString.includes('neon.tech');

const pool = new pg.Pool({
  connectionString,
  ssl: isCloudDB ? { rejectUnauthorized: false } : false,
});

async function runMigration(migrationFile: string) {
  const migrationPath = path.resolve(__dirname, '../../../../database/migrations', migrationFile);

  if (!fs.existsSync(migrationPath)) {
    console.error(`Migration file not found: ${migrationPath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationPath, 'utf-8');

  console.log(`Running migration: ${migrationFile}`);

  try {
    await pool.query(sql);
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

const migrationFile = process.argv[2] || '004_referral_letters.sql';
runMigration(migrationFile);
