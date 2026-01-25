import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_N8uWQfalCY0o@ep-winter-block-ahidrsiy-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const res = await pool.query('SELECT id, email, first_name, last_name, role, active FROM users');
  console.log('Users in database:');
  res.rows.forEach(row => {
    console.log(`  ${row.email} (${row.role}) - active: ${row.active}`);
  });
  await pool.end();
}

main().catch(console.error);
