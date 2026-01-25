import pg from 'pg';
import bcrypt from 'bcrypt';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_N8uWQfalCY0o@ep-winter-block-ahidrsiy-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  // Hash password "123"
  const passwordHash = await bcrypt.hash('123', 10);

  // Update or insert provider (doc@t.co)
  await pool.query(`
    INSERT INTO users (id, email, password_hash, first_name, last_name, role)
    VALUES ('a0000000-0000-0000-0000-000000000002', 'doc@t.co', $1, 'Tom', 'Moran', 'provider')
    ON CONFLICT (id) DO UPDATE SET email = 'doc@t.co', password_hash = $1
  `, [passwordHash]);

  console.log('Updated provider: doc@t.co / 123');

  // Update or insert secretary (sec@t.co) linked to the provider
  await pool.query(`
    INSERT INTO users (id, email, password_hash, first_name, last_name, role, provider_id)
    VALUES ('a0000000-0000-0000-0000-000000000004', 'sec@t.co', $1, 'Emily', 'Smith', 'secretary', 'a0000000-0000-0000-0000-000000000002')
    ON CONFLICT (id) DO UPDATE SET email = 'sec@t.co', password_hash = $1
  `, [passwordHash]);

  console.log('Updated secretary: sec@t.co / 123');

  await pool.end();
  console.log('Done!');
}

main().catch(console.error);
