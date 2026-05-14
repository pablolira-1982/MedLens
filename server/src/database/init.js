const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../../medlens.sqlite');

/**
 * Initializes the SQLite database and creates necessary tables.
 * @returns {Promise<sqlite3.Database>} The initialized database instance.
 */
function initDatabase() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database', err.message);
        reject(err);
      }
      console.log('Connected to the MedLens SQLite database.');
    });

    db.serialize(() => {
      // Conversations Table
      db.run(`CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        title TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Messages Table
      db.run(`CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT,
        role TEXT, -- 'user' or 'assistant'
        content TEXT,
        type TEXT DEFAULT 'text', -- 'text', 'image', 'pdf', 'voice'
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES conversations (id)
      )`);

      // Attachments Table (Privacy-First: Stores extracted data, not images)
      db.run(`CREATE TABLE IF NOT EXISTS attachments (
        id TEXT PRIMARY KEY,
        message_id TEXT,
        file_name TEXT,
        file_type TEXT,
        extracted_text TEXT, -- This is the 'memory' of the image/PDF
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (message_id) REFERENCES messages (id)
      )`, (err) => {
        if (err) reject(err);
        else resolve(db);
      });
    });
  });
}

module.exports = { initDatabase, dbPath };
