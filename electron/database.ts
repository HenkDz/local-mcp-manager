import path from 'node:path';
import { app } from 'electron';
import { createRequire } from 'node:module';
// Removed explicit Database type import; using unknown for db

// Type for server table rows
interface ServerRow {
  id: number;
  name: string;
  type: 'command' | 'url'; // Added type
  command?: string | null; // Now optional, can be null in DB
  args?: string | null;    // JSON string, can be null
  url?: string | null;     // Added URL, can be null
  env?: string | null;     // JSON string, can be null
  autostart: number; // 0 or 1
  createdAt: string;
  updatedAt: string;
}

interface ColumnInfo { 
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | number | null; // Changed from any
  pk: number;
}

// Create a require function
const require = createRequire(import.meta.url);

// Module for better-sqlite3; use for typing
const BetterSqlite3Module = require('better-sqlite3');
type BetterSqlite3Database = InstanceType<typeof BetterSqlite3Module>;

// Variables that need to be accessed by exported functions
let dbPath: string;
let db: BetterSqlite3Database;
let initializationError: Error | null = null;

// Define the functions outside of try-catch, but don't fill their implementation yet
export async function initializeDatabase(): Promise<void> {
  if (initializationError) {
    console.error('Database initialization failed during module load:', initializationError);
    throw initializationError;
  }
  
  try {
    console.log('Initializing database at path:', dbPath);
    
    const BetterSqlite3 = require('better-sqlite3');
    db = new BetterSqlite3(dbPath, { /* verbose: console.log */ }); // Verbose logging disabled for cleaner output during migration tests

    // Define the target schema for the servers table
    const createServersTableSQL = `
      CREATE TABLE servers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL DEFAULT 'command',
        command TEXT, 
        url TEXT,     
        args TEXT,
        env TEXT,
        autostart BOOLEAN DEFAULT FALSE,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Create other tables (e.g., clients) if they don't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        configPath TEXT NOT NULL,
        detectedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Check if 'servers' table exists
    const serversTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='servers';").get();

    if (serversTableExists) {
      // Servers table exists, check its schema for necessary migrations
      const columns: ColumnInfo[] = db.prepare("PRAGMA table_info(servers)").all() as ColumnInfo[];
      const columnMap = new Map(columns.map(col => [col.name, col]));

      let needsRebuild = false;
      const commandColumnInfo = columnMap.get('command');

      if (commandColumnInfo && commandColumnInfo.notnull === 1) {
        console.log("'command' column is NOT NULL. Table rebuild needed.");
        needsRebuild = true;
      }
      
      if (!columnMap.has('type')) {
        console.log("'type' column missing.");
        if (!needsRebuild) {
            db.exec('ALTER TABLE servers ADD COLUMN type TEXT NOT NULL DEFAULT \'command\'');
            console.log("Added 'type' column to servers table.");
        } else {
            console.log("'type' column will be added during table rebuild.");
        }
      }
      if (!columnMap.has('url')) {
         console.log("'url' column missing.");
         if (!needsRebuild) {
            db.exec('ALTER TABLE servers ADD COLUMN url TEXT');
            console.log("Added 'url' column to servers table.");
         } else {
            console.log("'url' column will be added during table rebuild.");
         }
      }

      if (needsRebuild) {
        console.log('Rebuilding servers table for schema migration...');
        db.exec('BEGIN TRANSACTION;'); // Start transaction
        try {
            db.exec('ALTER TABLE servers RENAME TO servers_old_migration;');
            console.log('Renamed existing servers table to servers_old_migration.');
            
            db.exec(createServersTableSQL);
            console.log('Created new servers table with target schema.');

            const oldColumnsInfo: ColumnInfo[] = db.prepare("PRAGMA table_info(servers_old_migration)").all() as ColumnInfo[];
            const oldColumnNamesSet = new Set(oldColumnsInfo.map(col => col.name));
            
            const selectTypeSQL = oldColumnNamesSet.has('type') ? 'type' : "'command'";
            const selectUrlSQL = oldColumnNamesSet.has('url') ? 'url' : 'NULL';
            // Ensure all columns from servers_old_migration are explicitly selected, defaulting if not present (though most should be)
            const selectArgsSQL = oldColumnNamesSet.has('args') ? 'args' : 'NULL';
            const selectEnvSQL = oldColumnNamesSet.has('env') ? 'env' : 'NULL';
            const selectAutostartSQL = oldColumnNamesSet.has('autostart') ? 'autostart' : '0';
            const selectCreatedAtSQL = oldColumnNamesSet.has('createdAt') ? 'createdAt' : 'CURRENT_TIMESTAMP';
            const selectUpdatedAtSQL = oldColumnNamesSet.has('updatedAt') ? 'updatedAt' : 'CURRENT_TIMESTAMP';

            const copySQL = `
              INSERT INTO servers (id, name, type, command, url, args, env, autostart, createdAt, updatedAt)
              SELECT 
                id, 
                name, 
                ${selectTypeSQL}, 
                command, 
                ${selectUrlSQL}, 
                ${selectArgsSQL}, 
                ${selectEnvSQL}, 
                ${selectAutostartSQL}, 
                ${selectCreatedAtSQL}, 
                ${selectUpdatedAtSQL}
              FROM servers_old_migration;
            `;
            
            console.log('Attempting to copy data with SQL:', copySQL.replace(/\s+/g, ' ').trim()); // Log cleaned SQL
            db.prepare(copySQL).run();
            console.log('Data copy complete.');

            db.exec('DROP TABLE servers_old_migration;');
            console.log('Dropped servers_old_migration table.');
            db.exec('COMMIT;'); // Commit transaction
            console.log('Servers table migration completed successfully.');
        } catch (migrationError) {
            db.exec('ROLLBACK;'); // Rollback transaction on error
            console.error('Error during table migration, rolled back:', migrationError);
            throw migrationError; // Re-throw error after rollback
        }
      }
    } else {
      // Servers table does not exist, create it with the target schema
      console.log("'servers' table not found. Creating new table.");
      db.exec(createServersTableSQL);
      console.log("'servers' table created.");
    }

    console.log('Database initialized and schema checked/updated at:', dbPath);
  } catch (error) {
    console.error('Error initializing database:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    throw error; // Rethrow to propagate error
  }
}

export function getDb() {
  if (initializationError) {
    throw initializationError;
  }
  
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

// Example function (we'll expand this later)
export function addServer(
  name: string, 
  type: 'command' | 'url', 
  commandOrUrl: string, // This will be command if type is 'command', or url if type is 'url'
  args?: string[], 
  env?: Record<string, string>, 
  autostart?: boolean
) {
  if (initializationError) throw initializationError;
  try {
    const currentDb = getDb();
    const stmt = currentDb.prepare(
      'INSERT INTO servers (name, type, command, url, args, env, autostart) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    const serverCommand = type === 'command' ? commandOrUrl : null;
    const serverUrl = type === 'url' ? commandOrUrl : null;
    const serverArgs = type === 'command' && args && args.length > 0 ? JSON.stringify(args) : null;
    const serverEnv = env && Object.keys(env).length > 0 ? JSON.stringify(env) : null;

    try {
      const result = stmt.run(
        name, 
        type, 
        serverCommand, 
        serverUrl, 
        serverArgs, 
        serverEnv, 
        autostart ? 1 : 0
      );
      return result.lastInsertRowid;
    } catch (error) {
      console.error('Error adding server:', error);
      if (error instanceof Error && 'code' in error && (error as { code: string }).code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw new Error(`Server with name "${name}" already exists.`);
      }
      throw error;
    }
  } catch (error) {
    console.error('Error in addServer:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    throw error;
  }
}

// Export CRUD functions for servers
export function getAllServers() {
  if (initializationError) throw initializationError;
  try {
    const currentDb = getDb();
    const stmt = currentDb.prepare('SELECT id, name, type, command, url, args, env, autostart, createdAt, updatedAt FROM servers');
    const rows: ServerRow[] = stmt.all();
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      command: row.command,
      url: row.url,
      args: row.args ? JSON.parse(row.args) : [], // Handle null args from DB for URL types
      env: row.env ? JSON.parse(row.env) : {},
      autostart: Boolean(row.autostart),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  } catch (error) {
    console.error('Error in getAllServers:', error);
    throw error;
  }
}

export function getServerById(id: number) {
  if (initializationError) throw initializationError;
  try {
    const currentDb = getDb();
    const stmt = currentDb.prepare('SELECT id, name, type, command, url, args, env, autostart, createdAt, updatedAt FROM servers WHERE id = ?');
    const row: ServerRow | undefined = stmt.get(id);
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      command: row.command,
      url: row.url,
      args: row.args ? JSON.parse(row.args) : [],
      env: row.env ? JSON.parse(row.env) : {},
      autostart: Boolean(row.autostart),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  } catch (error) {
    console.error('Error in getServerById:', error);
    throw error;
  }
}

export function updateServer(
  id: number,
  name: string,
  type: 'command' | 'url',
  commandOrUrl: string, // command if type is 'command', url if type is 'url'
  args: string[] | undefined, // undefined if type is 'url'
  env: Record<string, string> | undefined,
  autostart: boolean
) {
  if (initializationError) throw initializationError;
  try {
    const currentDb = getDb();
    const stmt = currentDb.prepare(
      'UPDATE servers SET name = ?, type = ?, command = ?, url = ?, args = ?, env = ?, autostart = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?'
    );
    const serverCommand = type === 'command' ? commandOrUrl : null;
    const serverUrl = type === 'url' ? commandOrUrl : null;
    const serverArgs = type === 'command' && args && args.length > 0 ? JSON.stringify(args) : null;
    const serverEnv = env && Object.keys(env).length > 0 ? JSON.stringify(env) : null;

    const result = stmt.run(
        name, 
        type, 
        serverCommand, 
        serverUrl, 
        serverArgs, 
        serverEnv, 
        autostart ? 1 : 0, 
        id
    );
    return result.changes > 0;
  } catch (error) {
    console.error('Error in updateServer:', error);
    throw error;
  }
}

export function deleteServer(id: number) {
  if (initializationError) {
    throw initializationError;
  }
  try {
    const currentDb = getDb();
    const stmt = currentDb.prepare('DELETE FROM servers WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  } catch (error) {
    console.error('Error in deleteServer:', error);
    throw error;
  }
}

// Initialize module-level variables in try-catch
try {
  // Don't rely on ESM __dirname equivalent, just use app.getPath
  console.log('Database.ts module loaded, initializing with app.getPath');
  
  // Use app.getPath to get paths without relying on __filename or __dirname
  dbPath = path.join(app.getPath('userData'), 'mcp-manager.sqlite3');
  console.log('Database path set to:', dbPath);
} catch (error) {
  console.error('Error in database.ts module initialization:', error);
  if (error instanceof Error) {
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    initializationError = error;
  }
}

// We'll need functions to:
// - Get all servers
// - Get a specific server by ID or name
// - Update a server
// - Delete a server
// - Manage clients (add/get detected clients) 