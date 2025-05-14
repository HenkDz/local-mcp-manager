import { app, session, BrowserWindow, ipcMain } from "electron";
import * as path from "node:path";
import path__default from "node:path";
import * as fs from "node:fs";
import fs__default from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const require2 = createRequire(import.meta.url);
require2("better-sqlite3");
let dbPath;
let db;
let initializationError = null;
async function initializeDatabase() {
  if (initializationError) {
    console.error("Database initialization failed during module load:", initializationError);
    throw initializationError;
  }
  try {
    console.log("Initializing database at path:", dbPath);
    const BetterSqlite3 = require2("better-sqlite3");
    db = new BetterSqlite3(dbPath, {
      /* verbose: console.log */
    });
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
    db.exec(`
      CREATE TABLE IF NOT EXISTS clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        configPath TEXT NOT NULL,
        detectedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    const serversTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='servers';").get();
    if (serversTableExists) {
      const columns = db.prepare("PRAGMA table_info(servers)").all();
      const columnMap = new Map(columns.map((col) => [col.name, col]));
      let needsRebuild = false;
      const commandColumnInfo = columnMap.get("command");
      if (commandColumnInfo && commandColumnInfo.notnull === 1) {
        console.log("'command' column is NOT NULL. Table rebuild needed.");
        needsRebuild = true;
      }
      if (!columnMap.has("type")) {
        console.log("'type' column missing.");
        if (!needsRebuild) {
          db.exec("ALTER TABLE servers ADD COLUMN type TEXT NOT NULL DEFAULT 'command'");
          console.log("Added 'type' column to servers table.");
        } else {
          console.log("'type' column will be added during table rebuild.");
        }
      }
      if (!columnMap.has("url")) {
        console.log("'url' column missing.");
        if (!needsRebuild) {
          db.exec("ALTER TABLE servers ADD COLUMN url TEXT");
          console.log("Added 'url' column to servers table.");
        } else {
          console.log("'url' column will be added during table rebuild.");
        }
      }
      if (needsRebuild) {
        console.log("Rebuilding servers table for schema migration...");
        db.exec("BEGIN TRANSACTION;");
        try {
          db.exec("ALTER TABLE servers RENAME TO servers_old_migration;");
          console.log("Renamed existing servers table to servers_old_migration.");
          db.exec(createServersTableSQL);
          console.log("Created new servers table with target schema.");
          const oldColumnsInfo = db.prepare("PRAGMA table_info(servers_old_migration)").all();
          const oldColumnNamesSet = new Set(oldColumnsInfo.map((col) => col.name));
          const selectTypeSQL = oldColumnNamesSet.has("type") ? "type" : "'command'";
          const selectUrlSQL = oldColumnNamesSet.has("url") ? "url" : "NULL";
          const selectArgsSQL = oldColumnNamesSet.has("args") ? "args" : "NULL";
          const selectEnvSQL = oldColumnNamesSet.has("env") ? "env" : "NULL";
          const selectAutostartSQL = oldColumnNamesSet.has("autostart") ? "autostart" : "0";
          const selectCreatedAtSQL = oldColumnNamesSet.has("createdAt") ? "createdAt" : "CURRENT_TIMESTAMP";
          const selectUpdatedAtSQL = oldColumnNamesSet.has("updatedAt") ? "updatedAt" : "CURRENT_TIMESTAMP";
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
          console.log("Attempting to copy data with SQL:", copySQL.replace(/\s+/g, " ").trim());
          db.prepare(copySQL).run();
          console.log("Data copy complete.");
          db.exec("DROP TABLE servers_old_migration;");
          console.log("Dropped servers_old_migration table.");
          db.exec("COMMIT;");
          console.log("Servers table migration completed successfully.");
        } catch (migrationError) {
          db.exec("ROLLBACK;");
          console.error("Error during table migration, rolled back:", migrationError);
          throw migrationError;
        }
      }
    } else {
      console.log("'servers' table not found. Creating new table.");
      db.exec(createServersTableSQL);
      console.log("'servers' table created.");
    }
    console.log("Database initialized and schema checked/updated at:", dbPath);
  } catch (error) {
    console.error("Error initializing database:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    throw error;
  }
}
function getDb() {
  if (initializationError) {
    throw initializationError;
  }
  if (!db) {
    throw new Error("Database not initialized. Call initializeDatabase() first.");
  }
  return db;
}
function addServer(name, type, commandOrUrl, args, env, autostart) {
  if (initializationError) throw initializationError;
  try {
    const currentDb = getDb();
    const stmt = currentDb.prepare(
      "INSERT INTO servers (name, type, command, url, args, env, autostart) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    const serverCommand = type === "command" ? commandOrUrl : null;
    const serverUrl = type === "url" ? commandOrUrl : null;
    const serverArgs = type === "command" && args && args.length > 0 ? JSON.stringify(args) : null;
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
      console.error("Error adding server:", error);
      if (error instanceof Error && "code" in error && error.code === "SQLITE_CONSTRAINT_UNIQUE") {
        throw new Error(`Server with name "${name}" already exists.`);
      }
      throw error;
    }
  } catch (error) {
    console.error("Error in addServer:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    throw error;
  }
}
function getAllServers() {
  if (initializationError) throw initializationError;
  try {
    const currentDb = getDb();
    const stmt = currentDb.prepare("SELECT id, name, type, command, url, args, env, autostart, createdAt, updatedAt FROM servers");
    const rows = stmt.all();
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      command: row.command,
      url: row.url,
      args: row.args ? JSON.parse(row.args) : [],
      // Handle null args from DB for URL types
      env: row.env ? JSON.parse(row.env) : {},
      autostart: Boolean(row.autostart),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    }));
  } catch (error) {
    console.error("Error in getAllServers:", error);
    throw error;
  }
}
function getServerById(id) {
  if (initializationError) throw initializationError;
  try {
    const currentDb = getDb();
    const stmt = currentDb.prepare("SELECT id, name, type, command, url, args, env, autostart, createdAt, updatedAt FROM servers WHERE id = ?");
    const row = stmt.get(id);
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
      updatedAt: row.updatedAt
    };
  } catch (error) {
    console.error("Error in getServerById:", error);
    throw error;
  }
}
function updateServer(id, name, type, commandOrUrl, args, env, autostart) {
  if (initializationError) throw initializationError;
  try {
    const currentDb = getDb();
    const stmt = currentDb.prepare(
      "UPDATE servers SET name = ?, type = ?, command = ?, url = ?, args = ?, env = ?, autostart = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?"
    );
    const serverCommand = type === "command" ? commandOrUrl : null;
    const serverUrl = type === "url" ? commandOrUrl : null;
    const serverArgs = type === "command" && args && args.length > 0 ? JSON.stringify(args) : null;
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
    console.error("Error in updateServer:", error);
    throw error;
  }
}
function deleteServer(id) {
  if (initializationError) {
    throw initializationError;
  }
  try {
    const currentDb = getDb();
    const stmt = currentDb.prepare("DELETE FROM servers WHERE id = ?");
    const result = stmt.run(id);
    return result.changes > 0;
  } catch (error) {
    console.error("Error in deleteServer:", error);
    throw error;
  }
}
try {
  console.log("Database.ts module loaded, initializing with app.getPath");
  dbPath = path__default.join(app.getPath("userData"), "mcp-manager.sqlite3");
  console.log("Database path set to:", dbPath);
} catch (error) {
  console.error("Error in database.ts module initialization:", error);
  if (error instanceof Error) {
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    initializationError = error;
  }
}
function getUserHomeDir() {
  return process.env.HOME || process.env.USERPROFILE || "";
}
function getVSCodeGlobalMcpJsonPath() {
  const homeDir = getUserHomeDir();
  if (!homeDir) return "";
  switch (process.platform) {
    case "win32":
      return process.env.APPDATA ? path.join(process.env.APPDATA, "Code", "User", "mcp.json") : "";
    case "darwin":
      return path.join(homeDir, "Library", "Application Support", "Code", "User", "mcp.json");
    case "linux":
      return path.join(homeDir, ".config", "Code", "User", "mcp.json");
    default:
      return "";
  }
}
function getCursorGlobalMcpJsonPath() {
  const homeDir = getUserHomeDir();
  if (!homeDir) return "";
  switch (process.platform) {
    case "win32":
      return path.join(homeDir, ".cursor", "mcp.json");
    case "darwin":
      return path.join(homeDir, ".cursor", "mcp.json");
    case "linux":
      return path.join(homeDir, ".cursor", "mcp.json");
    default:
      return "";
  }
}
const SUPPORTED_CLIENTS = [
  {
    id: "vscode",
    name: "Visual Studio Code",
    getGlobalMcpPath: getVSCodeGlobalMcpJsonPath
  },
  {
    id: "cursor",
    name: "Cursor",
    getGlobalMcpPath: getCursorGlobalMcpJsonPath
  }
  // { // Future: Claude Desktop, etc.
  //   id: 'claudedesktop',
  //   name: 'Claude Desktop',
  //   getGlobalMcpPath: () => '', // To be implemented
  // }
];
async function detectMClients() {
  console.log("Attempting to detect MCP clients by their global configurations...");
  const detected = [];
  for (const clientProfile of SUPPORTED_CLIENTS) {
    const mcpPath = clientProfile.getGlobalMcpPath();
    let isConfigured = false;
    let actualPath = void 0;
    if (mcpPath && fs.existsSync(mcpPath)) {
      isConfigured = true;
      actualPath = mcpPath;
      console.log(`Found ${clientProfile.name} global mcp.json at: ${mcpPath}`);
    } else {
      console.log(`Global mcp.json for ${clientProfile.name} not found at expected path: ${mcpPath || "N/A"}`);
    }
    detected.push({
      id: clientProfile.id,
      name: clientProfile.name,
      globalMcpConfigPath: actualPath,
      isConfigured
    });
  }
  console.log(`Detection complete. Found clients: ${JSON.stringify(detected.filter((c) => c.isConfigured).map((c) => c.id))}`);
  return detected;
}
const __filename = fileURLToPath(import.meta.url);
const __dirname = path__default.dirname(__filename);
app.on("ready", () => {
  if (session.defaultSession) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          // IMPORTANT: Adjust this CSP based on your actual needs.
          // 'unsafe-inline' for styles is often needed with Vite dev server.
          // For production, try to be more restrictive if possible.
          // http://localhost:* is for Vite dev server.
          "Content-Security-Policy": [
            "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' http://localhost:*; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' http://localhost:*"
          ]
        }
      });
    });
  } else {
    console.warn("session.defaultSession is not available. CSP not set.");
  }
});
console.log("Main.ts module loaded, __dirname resolved to:", __dirname);
const createWindow = async () => {
  try {
    const preloadScriptPath = path__default.join(__dirname, "preload.js");
    console.log("Creating window with constructed preload path:", preloadScriptPath);
    const mainWindow = new BrowserWindow({
      width: 1800,
      height: 800,
      webPreferences: {
        preload: preloadScriptPath,
        // Use the constructed path
        nodeIntegration: false,
        contextIsolation: true
      }
    });
    try {
      await initializeDatabase();
      console.log("Database initialized successfully");
    } catch (error) {
      console.error("Failed to initialize database:", error);
    }
    ipcMain.handle("db-add-server", async (event, serverDetails) => {
      try {
        const commandOrUrl = serverDetails.type === "command" ? serverDetails.command : serverDetails.url;
        if (commandOrUrl === void 0) {
          throw new Error("Command or URL must be provided for the server type.");
        }
        const serverId = addServer(
          serverDetails.name,
          serverDetails.type,
          commandOrUrl,
          // This is now correctly serverDetails.command or serverDetails.url
          serverDetails.type === "command" ? serverDetails.args : void 0,
          serverDetails.env,
          serverDetails.autostart
        );
        return { success: true, serverId };
      } catch (error) {
        console.error("Error in db-add-server handler:", error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });
    ipcMain.handle("db-get-servers", async () => {
      try {
        const servers = getAllServers();
        return { success: true, servers };
      } catch (error) {
        console.error("Error in db-get-servers handler:", error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });
    ipcMain.handle("db-get-server", async (event, id) => {
      try {
        const server = getServerById(id);
        return { success: true, server };
      } catch (error) {
        console.error("Error in db-get-server handler:", error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });
    ipcMain.handle("db-update-server", async (event, serverDetails) => {
      try {
        const commandOrUrl = serverDetails.type === "command" ? serverDetails.command : serverDetails.url;
        if (commandOrUrl === void 0) {
          throw new Error("Command or URL must be provided for the server type.");
        }
        const updated = updateServer(
          serverDetails.id,
          serverDetails.name,
          serverDetails.type,
          commandOrUrl,
          // Correctly serverDetails.command or serverDetails.url
          serverDetails.type === "command" ? serverDetails.args : void 0,
          serverDetails.env,
          serverDetails.autostart
          // serverDetails.createdAt is not passed as it's not updatable via this function
        );
        return { success: updated };
      } catch (error) {
        console.error("Error in db-update-server handler:", error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });
    ipcMain.handle("db-delete-server", async (event, id) => {
      try {
        const deleted = deleteServer(id);
        return { success: deleted };
      } catch (error) {
        console.error("Error in db-delete-server handler:", error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });
    ipcMain.handle("app:detect-clients", async () => {
      try {
        const clients = await detectMClients();
        return { success: true, clients };
      } catch (error) {
        console.error("Error in app:detect-clients handler:", error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });
    ipcMain.handle("client:get-mcp-servers", async (_event, filePath) => {
      try {
        const content = await fs__default.promises.readFile(filePath, "utf-8");
        const parsedServers = JSON.parse(content);
        console.log("Successfully read and parsed MCP servers from", filePath);
        return { success: true, data: parsedServers };
      } catch (error) {
        console.error(`Error reading/parsing MCP servers from ${filePath}:`, error);
        const message = error instanceof Error ? error.message : "Failed to read/parse mcp.json";
        return { success: false, error: message };
      }
    });
    ipcMain.handle(
      "client:write-mcp-config",
      async (_event, clientConfigPath, managedServers, clientId) => {
        if (!clientConfigPath) {
          console.error("Attempted to write MCP config with no path.");
          return { success: false, error: "Client configuration path is missing." };
        }
        try {
          let mcpConfig = {};
          try {
            const existingContent = await fs__default.promises.readFile(clientConfigPath, "utf-8");
            mcpConfig = JSON.parse(existingContent);
            if (typeof mcpConfig !== "object" || mcpConfig === null) mcpConfig = {};
          } catch (readError) {
            const message = readError instanceof Error ? readError.message : "Unknown error during file read/parse";
            console.warn(`Could not read existing client MCP config at ${clientConfigPath} (may be new or corrupt):`, message);
            mcpConfig = {};
          }
          const outputServers = {};
          for (const server of managedServers) {
            const serverEntry = {
              autostart: server.autostart
              // Add autostart
            };
            if (server.type === "url") {
              serverEntry.url = server.url;
            } else {
              serverEntry.command = server.command;
              serverEntry.args = server.args && server.args.length > 0 ? server.args : [];
            }
            serverEntry.env = server.env || {};
            outputServers[server.name] = serverEntry;
          }
          const mcpOutputKey = clientId === "cursor" ? "servers" : "mcpServers";
          mcpConfig[mcpOutputKey] = outputServers;
          delete mcpConfig[clientId === "cursor" ? "mcpServers" : "servers"];
          const dir = path__default.dirname(clientConfigPath);
          await fs__default.promises.mkdir(dir, { recursive: true });
          await fs__default.promises.writeFile(clientConfigPath, JSON.stringify(mcpConfig, null, 2), "utf-8");
          console.log(`Successfully wrote ${managedServers.length} managed servers to ${clientConfigPath}`);
          return { success: true };
        } catch (error) {
          console.error(`Error writing MCP config to ${clientConfigPath}:`, error);
          const message = error instanceof Error ? error.message : "Failed to write client mcp.json";
          return { success: false, error: message };
        }
      }
    );
    ipcMain.handle("servers:import", async (event, jsonString) => {
      let importedCount = 0;
      let errorCount = 0;
      const errors = [];
      try {
        const importData = JSON.parse(jsonString);
        if (!importData || typeof importData.mcpServers !== "object") {
          return {
            success: false,
            message: "Invalid JSON structure: mcpServers object not found.",
            importedCount,
            errorCount: 1,
            errors: [{ serverName: "JSON Structure", error: "mcpServers object not found" }]
          };
        }
        const mcpServers = importData.mcpServers;
        for (const serverName in mcpServers) {
          if (Object.prototype.hasOwnProperty.call(mcpServers, serverName)) {
            const details = mcpServers[serverName];
            try {
              if (!details || typeof details.command !== "string") {
                throw new Error(`Missing or invalid command for server: ${serverName}`);
              }
              const name = serverName;
              const command = details.command;
              const args = details.args || [];
              const env = details.env || {};
              const autostart = details.autostart || false;
              addServer(name, command, args, env, autostart);
              importedCount++;
            } catch (err) {
              errorCount++;
              const errorMessage = err instanceof Error ? err.message : String(err);
              errors.push({ serverName, error: errorMessage });
              console.error(`Error importing server ${serverName}:`, errorMessage);
            }
          }
        }
        let message = `Imported ${importedCount} server(s).`;
        if (errorCount > 0) {
          message += ` Failed to import ${errorCount} server(s).`;
        }
        return { success: true, message, importedCount, errorCount, errors };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error during import process.";
        console.error("Error in servers:import handler:", errorMessage);
        return {
          success: false,
          message: `Import failed: ${errorMessage}`,
          importedCount,
          errorCount: errorCount + 1,
          errors
        };
      }
    });
    if (process.env.VITE_DEV_SERVER_URL) {
      console.log("Loading development server URL:", process.env.VITE_DEV_SERVER_URL);
      mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
      if (process.env.NODE_ENV === "development") {
        mainWindow.webContents.openDevTools();
      }
    } else {
      console.log("Loading production file from:", path__default.join(__dirname, "../dist/index.html"));
      mainWindow.loadFile(path__default.join(__dirname, "../dist/index.html"));
    }
  } catch (error) {
    console.error("Error creating window:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
  }
};
app.whenReady().then(async () => {
  try {
    console.log("App is ready, creating window...");
    await createWindow();
    app.on("activate", async () => {
      if (BrowserWindow.getAllWindows().length === 0) await createWindow();
    });
  } catch (error) {
    console.error("Error in app.whenReady handler:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
  }
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  if (error instanceof Error) {
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
  }
});
