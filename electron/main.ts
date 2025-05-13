import { app, BrowserWindow, ipcMain, session } from 'electron';
import path from 'node:path';
import fs from 'node:fs'; // Import fs for file operations
import { fileURLToPath } from 'node:url'; // Added for ESM __dirname equivalent
import { 
  initializeDatabase, 
  addServer, 
  getAllServers, 
  getServerById, 
  updateServer, 
  deleteServer, 

} from './database';
import { detectMClients as detectInstalledClients } from './main/clientDetectionService';
import type { Server, DetectedClient, ServerFormData, ClientMcpJsonData, ClientMcpServerDetail } from '../types'; // Ensure Server type is imported

// ESM __dirname equivalent - calculate here directly in this module scope
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// It's good practice to set the CSP before any windows are created or URLs loaded.
app.on('ready', () => {
  if (session.defaultSession) { // Check if defaultSession is available
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          // IMPORTANT: Adjust this CSP based on your actual needs.
          // 'unsafe-inline' for styles is often needed with Vite dev server.
          // For production, try to be more restrictive if possible.
          // http://localhost:* is for Vite dev server.
          'Content-Security-Policy': [
            "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' http://localhost:*; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' http://localhost:*"
          ]
        }
      });
    });
  } else {
    console.warn("session.defaultSession is not available. CSP not set.");
  }
});

console.log('Main.ts module loaded, __dirname resolved to:', __dirname);

// vite-plugin-electron will inject environment variables for dev server URL and preload script path
// For example: process.env.VITE_DEV_SERVER_URL and process.env.ELECTRON_PRELOAD_URL

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
// Removed electron-squirrel-startup check to resolve "require is not defined" in ESM scope
// if (require('electron-squirrel-startup')) {
//   app.quit();
// }

const createWindow = async () => {
  try {
    // Construct preload path manually relative to __dirname of the BUILT main.js
    // __dirname in this context (after build) will be /dist-electron/
    const preloadScriptPath = path.join(__dirname, 'preload.js');
    console.log('Creating window with constructed preload path:', preloadScriptPath);
    
    const mainWindow = new BrowserWindow({
      width: 1800,
      height: 800,
      webPreferences: {
        preload: preloadScriptPath, // Use the constructed path
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    // Initialize database when the app starts
    try {
      await initializeDatabase();
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Failed to initialize database:', error);
    }

    // Set up IPC handlers for database operations
    ipcMain.handle('db-add-server', async (event, serverDetails: ServerFormData) => {
      try {
        const commandOrUrl = serverDetails.type === 'command' ? serverDetails.command : serverDetails.url;
        if (commandOrUrl === undefined) {
          throw new Error('Command or URL must be provided for the server type.');
        }
        const serverId = addServer(
          serverDetails.name,
          serverDetails.type,
          commandOrUrl, // This is now correctly serverDetails.command or serverDetails.url
          serverDetails.type === 'command' ? serverDetails.args : undefined,
          serverDetails.env,
          serverDetails.autostart
        );
        return { success: true, serverId };
      } catch (error) {
        console.error('Error in db-add-server handler:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });
    // IPC handler for fetching all servers
    ipcMain.handle('db-get-servers', async () => {
      try {
        const servers = getAllServers();
        return { success: true, servers };
      } catch (error) {
        console.error('Error in db-get-servers handler:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });
    // IPC handler for fetching a single server by ID
    ipcMain.handle('db-get-server', async (event, id) => {
      try {
        const server = getServerById(id);
        return { success: true, server };
      } catch (error) {
        console.error('Error in db-get-server handler:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });
    // IPC handler for updating a server
    ipcMain.handle('db-update-server', async (event, serverDetails: Server) => { // Type is Server
      try {
        const commandOrUrl = serverDetails.type === 'command' ? serverDetails.command : serverDetails.url;
        if (commandOrUrl === undefined) {
          throw new Error('Command or URL must be provided for the server type.');
        }
        const updated = updateServer(
          serverDetails.id,
          serverDetails.name,
          serverDetails.type,
          commandOrUrl, // Correctly serverDetails.command or serverDetails.url
          serverDetails.type === 'command' ? serverDetails.args : undefined,
          serverDetails.env,
          serverDetails.autostart
          // serverDetails.createdAt is not passed as it's not updatable via this function
        );
        return { success: updated };
      } catch (error) {
        console.error('Error in db-update-server handler:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });
    // IPC handler for deleting a server
    ipcMain.handle('db-delete-server', async (event, id) => {
      try {
        const deleted = deleteServer(id);
        return { success: deleted };
      } catch (error) {
        console.error('Error in db-delete-server handler:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    // IPC handler for detecting MCP clients
    ipcMain.handle('app:detect-clients', async () => {
      try {
        const clients = await detectInstalledClients();
        return { success: true, clients };
      } catch (error) {
        console.error('Error in app:detect-clients handler:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    // IPC handler for getting servers from a client's mcp.json
    ipcMain.handle('client:get-mcp-servers', async (_event, filePath: string) => {
      try {
        const content = await fs.promises.readFile(filePath, 'utf-8');
        const parsedServers = JSON.parse(content);
        console.log('Successfully read and parsed MCP servers from', filePath);
        return { success: true, data: parsedServers as ClientMcpJsonData }; // Added type assertion
      } catch (error: unknown) {
        console.error(`Error reading/parsing MCP servers from ${filePath}:`, error);
        const message = error instanceof Error ? error.message : 'Failed to read/parse mcp.json';
        return { success: false, error: message };
      }
    });

    // Handler to write managed servers to a client's mcp.json
    ipcMain.handle(
      'client:write-mcp-config',
      async (_event, clientConfigPath: string, managedServers: Server[]) => {
        if (!clientConfigPath) {
          console.error('Attempted to write MCP config with no path.');
          return { success: false, error: 'Client configuration path is missing.' };
        }

        try {
          let mcpConfig: ClientMcpJsonData = {};
          try {
            const existingContent = await fs.promises.readFile(clientConfigPath, 'utf-8');
            mcpConfig = JSON.parse(existingContent);
            if (typeof mcpConfig !== 'object' || mcpConfig === null) mcpConfig = {}; // Ensure it's an object
          } catch (readError: unknown) {
            // If file doesn't exist or is invalid JSON, we'll create/overwrite it.
            const message = readError instanceof Error ? readError.message : 'Unknown error during file read/parse';
            console.warn(`Could not read existing client MCP config at ${clientConfigPath} (may be new or corrupt):`, message);
            mcpConfig = {}; // Initialize if reading failed
          }

          // Standardize to use mcpServers, but be aware some clients might use 'servers'
          // For now, we will write to mcpServers. If a client exclusively uses 'servers', this might need adjustment.
          const outputServers: Record<string, ClientMcpServerDetail> = {};
          for (const server of managedServers) {
            const serverEntry: ClientMcpServerDetail = {
              autostart: server.autostart, // Add autostart
            };

            if (server.type === 'url') {
              serverEntry.url = server.url;
            } else {
              serverEntry.command = server.command;
              // server.args is already string[] from database processing
              serverEntry.args = server.args && server.args.length > 0 ? server.args : [];
            }

            // server.env is already Record<string, string> from database processing
            serverEntry.env = server.env || {};

            // Using server.name as the key
            outputServers[server.name] = serverEntry;
          }

          // Update mcpConfig with the new set of servers
          // We will overwrite the mcpServers key. If client uses 'servers' key, this needs more sophisticated merging.
          mcpConfig.mcpServers = outputServers;
          
          // Ensure the directory exists
          const dir = path.dirname(clientConfigPath);
          await fs.promises.mkdir(dir, { recursive: true });

          await fs.promises.writeFile(clientConfigPath, JSON.stringify(mcpConfig, null, 2), 'utf-8');
          console.log(`Successfully wrote ${managedServers.length} managed servers to ${clientConfigPath}`);
          return { success: true };
        } catch (error: unknown) {
          console.error(`Error writing MCP config to ${clientConfigPath}:`, error);
          const message = error instanceof Error ? error.message : 'Failed to write client mcp.json';
          return { success: false, error: message };
        }
      }
    );

    // IPC handler for importing servers
    ipcMain.handle('servers:import', async (event, jsonString: string) => {
      let importedCount = 0;
      let errorCount = 0;
      const errors: { serverName: string; error: string }[] = [];

      try {
        const importData = JSON.parse(jsonString);
        if (!importData || typeof importData.mcpServers !== 'object') {
          return {
            success: false,
            message: 'Invalid JSON structure: mcpServers object not found.',
            importedCount,
            errorCount: 1, 
            errors: [{ serverName: 'JSON Structure', error: 'mcpServers object not found' }]
          };
        }

        const mcpServers = importData.mcpServers;
        for (const serverName in mcpServers) {
          if (Object.prototype.hasOwnProperty.call(mcpServers, serverName)) {
            const details = mcpServers[serverName];
            try {
              if (!details || typeof details.command !== 'string') {
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
        const errorMessage = error instanceof Error ? error.message : 'Unknown error during import process.';
        console.error('Error in servers:import handler:', errorMessage);
        return {
          success: false,
          message: `Import failed: ${errorMessage}`,
          importedCount,
          errorCount: errorCount + 1, 
          errors
        };
      }
    });

    // Load the app
    if (process.env.VITE_DEV_SERVER_URL) {
      console.log('Loading development server URL:', process.env.VITE_DEV_SERVER_URL);
      mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
      if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools();
      }
    } else {
      // In production, load the index.html file from the 'dist' directory (renderer output)
      console.log('Loading production file from:', path.join(__dirname, '../dist/index.html'));
      mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
  } catch (error) {
    console.error('Error creating window:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
  }
};

app.whenReady().then(async () => {
  try {
    console.log('App is ready, creating window...');
    await createWindow();

    app.on('activate', async () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (BrowserWindow.getAllWindows().length === 0) await createWindow();
    });
  } catch (error) {
    console.error('Error in app.whenReady handler:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle any uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  if (error instanceof Error) {
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
  }
}); 