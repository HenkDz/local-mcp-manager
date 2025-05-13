import * as fs from 'node:fs';
import * as path from 'node:path';

export interface DetectedClient {
  id: string; // e.g., 'vscode', 'cursor'
  name: string; // e.g., 'Visual Studio Code', 'Cursor'
  globalMcpConfigPath?: string; // Path to the global mcp.json, if found
  isConfigured: boolean; // True if global mcp.json is found
}

/**
 * Gets the user's home directory.
 */
function getUserHomeDir(): string {
  return process.env.HOME || process.env.USERPROFILE || '';
}

/**
 * Gets the expected global mcp.json path for VS Code.
 * @returns {string} The platform-specific path.
 */
function getVSCodeGlobalMcpJsonPath(): string {
  const homeDir = getUserHomeDir();
  if (!homeDir) return '';

  switch (process.platform) {
    case 'win32':
      return process.env.APPDATA ? path.join(process.env.APPDATA, 'Code', 'User', 'mcp.json') : '';
    case 'darwin':
      return path.join(homeDir, 'Library', 'Application Support', 'Code', 'User', 'mcp.json');
    case 'linux':
      return path.join(homeDir, '.config', 'Code', 'User', 'mcp.json');
    default:
      return '';
  }
}

/**
 * Gets the expected global mcp.json path for Cursor.
 * Based on user example: C:\Users\username\.cursor\mcp.json
 * @returns {string} The platform-specific path.
 */
function getCursorGlobalMcpJsonPath(): string {
  const homeDir = getUserHomeDir();
  if (!homeDir) return '';

  switch (process.platform) {
    case 'win32':
      return path.join(homeDir, '.cursor', 'mcp.json');
    case 'darwin':
      // Assuming similar path structure on macOS, needs verification
      return path.join(homeDir, '.cursor', 'mcp.json'); 
    case 'linux':
      // Assuming similar path structure on Linux, needs verification
      return path.join(homeDir, '.cursor', 'mcp.json');
    default:
      return '';
  }
}

interface ClientProfile {
  id: string;
  name: string;
  getGlobalMcpPath: () => string;
}

const SUPPORTED_CLIENTS: ClientProfile[] = [
  {
    id: 'vscode',
    name: 'Visual Studio Code',
    getGlobalMcpPath: getVSCodeGlobalMcpJsonPath,
  },
  {
    id: 'cursor',
    name: 'Cursor',
    getGlobalMcpPath: getCursorGlobalMcpJsonPath,
  },
  // { // Future: Claude Desktop, etc.
  //   id: 'claudedesktop',
  //   name: 'Claude Desktop',
  //   getGlobalMcpPath: () => '', // To be implemented
  // }
];

/**
 * Detects installed MCP clients by checking for their global mcp.json files.
 */
export async function detectMClients(): Promise<DetectedClient[]> {
  console.log('Attempting to detect MCP clients by their global configurations...');
  const detected: DetectedClient[] = [];

  for (const clientProfile of SUPPORTED_CLIENTS) {
    const mcpPath = clientProfile.getGlobalMcpPath();
    let isConfigured = false;
    let actualPath: string | undefined = undefined;

    if (mcpPath && fs.existsSync(mcpPath)) {
      isConfigured = true;
      actualPath = mcpPath;
      console.log(`Found ${clientProfile.name} global mcp.json at: ${mcpPath}`);
    } else {
      console.log(`Global mcp.json for ${clientProfile.name} not found at expected path: ${mcpPath || 'N/A'}`);
    }

    detected.push({
      id: clientProfile.id,
      name: clientProfile.name,
      globalMcpConfigPath: actualPath,
      isConfigured,
    });
  }

  console.log(`Detection complete. Found clients: ${JSON.stringify(detected.filter(c => c.isConfigured).map(c=>c.id))}`);
  return detected;
}

// Removed the old detectVSCode function and placeholder client list.
// The new structure is more modular and focuses on global paths. 