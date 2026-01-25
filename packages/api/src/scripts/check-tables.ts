import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgresql://neondb_owner:npg_N8uWQfalCY0o@ep-winter-block-ahidrsiy-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const res = await pool.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
  console.log('Existing tables:', res.rows.map(r => r.tablename).join(', '));
  await pool.end();
}

main();
