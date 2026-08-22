import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './pool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

initDatabase();
