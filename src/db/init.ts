import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import { pool } from './pool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function seedAdmin() {
  // ponytail: initial admin is seeded only if SEED_ADMIN_EMAIL/PASSWORD are set.
  // Add when: admin self-service signup is wanted — then gate /register with authenticateJWT + requireAdmin instead.
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) return;

  const existing = await pool.execute<any[]>('SELECT id FROM user WHERE email = ?', [email]);
  if (existing[0].length > 0) {
    console.log('ℹ️  Seed admin already exists, skipping.');
    return;
  }

  const hashed = await bcrypt.hash(password, 10);
  await pool.execute(
    'INSERT INTO user (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
    [process.env.SEED_ADMIN_NAME || 'Administrator', email, hashed, 'admin']
  );
  console.log('✅ Seed admin created:', email);
}

async function initDatabase() {
  console.log('🚀 Running database migrations & schema initialization...');
  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const sqlContent = fs.readFileSync(schemaPath, 'utf8');
    
    // Split SQL by semicolon for multi-statement execution
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const connection = await pool.getConnection();
    try {
      for (const statement of statements) {
        await connection.query(statement);
      }
      console.log('✅ Database schema initialized successfully!');
    } finally {
      connection.release();
    }

    await seedAdmin();
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

initDatabase();
