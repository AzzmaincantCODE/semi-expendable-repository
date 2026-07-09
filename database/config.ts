// Suppress type resolution for optional native dependency in editor
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'database', 'property_management.db');
const SCHEMA_PATH = path.join(process.cwd(), 'database', 'schema.sql');

// Ensure database directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize database (use `any` to avoid requiring type declarations)
let db: any | null = null;

export const getDatabase = (): any => {
  if (!db) {
    db = new Database(DB_PATH);
    
    // Enable foreign key constraints
    db.pragma('foreign_keys = ON');
    
    // Initialize schema if database is empty
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    if (tables.length === 0) {
      const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
      db.exec(schema);
      console.log('Database schema initialized');
    }
  }
  return db;
};

export const closeDatabase = (): void => {
  if (db) {
    db.close();
    db = null;
  }
};

// Database connection configuration
export const dbConfig = {
  path: DB_PATH,
  options: {
    verbose: process.env.NODE_ENV === 'development' ? console.log : undefined,
  }
};

export default getDatabase;
