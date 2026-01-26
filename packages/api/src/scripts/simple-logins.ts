import pg from 'pg';
import bcrypt from 'bcryptjs';

const connectionString = process.env.DATABASE_URL || 'postgresql://ehr:ehr@localhost:5432/ehr';
const isCloudDB = connectionString.includes('neon.tech') || connectionString.includes('supabase');

const pool = new pg.Pool({
  connectionString,
  ssl: isCloudDB ? { rejectUnauthorized: false } : false
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
