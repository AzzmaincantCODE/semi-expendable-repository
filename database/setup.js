const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Create database directory if it doesn't exist
const dbDir = path.dirname(__filename);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Create or connect to database
const dbPath = path.join(dbDir, 'property_management.db');
const db = new Database(dbPath);

console.log('Setting up database...');

// Read and execute schema
const schemaPath = path.join(__dirname, 'schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf8');

try {
  db.exec(schema);
  console.log('Database schema created successfully');
} catch (error) {
  console.error('Error creating database schema:', error);
  process.exit(1);
}

// Close database connection
db.close();

console.log('Database setup completed successfully!');
console.log('Database file location:', dbPath);