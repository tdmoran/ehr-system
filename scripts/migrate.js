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

async function migrate() {
  console.log('Connecting to database...');
  console.log('Using cloud database:', isCloudDB);

  const client = await pool.connect();

  try {
    // Read migration file
    const migrationPath = path.join(__dirname, '..', 'database', 'migrations', '001_initial_schema.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('Running migration...');
    await client.query(migrationSQL);
    console.log('Migration completed successfully!');

    // Read seed file
    const seedPath = path.join(__dirname, '..', 'database', 'seeds', 'dev_data.sql');
    const seedSQL = fs.readFileSync(seedPath, 'utf8');

    console.log('Running seed data...');
    await client.query(seedSQL);
    console.log('Seed data inserted successfully!');

  } catch (error) {
    console.error('Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(err => {
  console.error(err);
  process.exit(1);
});
