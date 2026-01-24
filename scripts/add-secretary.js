import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const connectionString = process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_N8uWQfalCY0o@ep-winter-block-ahidrsiy-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const isCloudDB = connectionString.includes('supabase.co') ||
                  connectionString.includes('supabase.com') ||
                  connectionString.includes('neon.tech');

const pool = new pg.Pool({
  connectionString,
  ssl: isCloudDB ? { rejectUnauthorized: false } : false,
});

async function addSecretary() {
  console.log('Connecting to database...');

  const client = await pool.connect();

  try {
    // Read migration file
    const migrationPath = path.join(__dirname, '..', 'database', 'migrations', '002_add_secretary_role.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('Adding secretary role and user...');
    await client.query(migrationSQL);
    console.log('Secretary role added successfully!');
    console.log('');
    console.log('You can now login as:');
    console.log('  Email: secretary.moran@example.com');
    console.log('  Password: password123');

  } catch (error) {
    console.error('Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

addSecretary().catch(err => {
  console.error(err);
  process.exit(1);
});
