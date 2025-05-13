import type { DetectedClient as ImportedDetectedClient } from '../electron/main/clientDetectionService.js';

export type DetectedClient = ImportedDetectedClient;

// Type for server records exposed via IPC
export interface Server {
    id: number;
    name: string;
    type: 'command' | 'url';
    command?: string;
    args?: string[];
    url?: string;
    env?: Record<string, string>;
    autostart: boolean;
    createdAt: string;
    updatedAt: string;
  }

// For ServerFormDialog component
export interface ServerFormData {
  name: string;
  type: 'command' | 'url';
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  autostart: boolean;
}

// For import functionality
export interface ImportResult {
  success: boolean;
  message: string;
  importedCount?: number;
  errorCount?: number;
  errors?: { serverName: string; error: string }[];
}
  
  // Define the API shape
  export interface IElectronAPI {
    addServer: (serverDetails: ServerFormData) => Promise<{ success: boolean; serverId?: number; error?: string }>;
    getAllServers: () => Promise<{ success: boolean; servers?: Server[]; error?: string }>;
    getServerById: (id: number) => Promise<{ success: boolean; server?: Server; error?: string }>;
    updateServer: (serverDetails: Server) => Promise<{ success: boolean; error?: string }>;
    deleteServer: (id: number) => Promise<{ success: boolean; error?: string }>;
    importServers: (jsonString: string) => Promise<{ success: boolean; message: string; importedCount?: number; errorCount?: number; errors?: { serverName: string; error: string }[] }>;
    detectClients: () => Promise<{ success: boolean; clients?: DetectedClient[]; error?: string }>;
    getClientMcpServers: (filePath: string) => Promise<{ success: boolean; data?: ClientMcpJsonData; error?: string }>;
    writeClientMcpConfig: (filePath: string, servers: Server[]) => Promise<{ success: boolean; error?: string }>;
  }

// Represents the data structure within a client's mcp.json file
export interface ClientMcpServerDetail {
  command?: string;
  args?: string[] | string; 
  url?: string;
  env?: Record<string, string>;
  name?: string; 
  autostart?: boolean;
  [key: string]: unknown; // Allow other properties, changed any to unknown
}

export interface ClientMcpJsonData {
  mcpServers?: Record<string, ClientMcpServerDetail>;
  servers?: Record<string, ClientMcpServerDetail>;
  [key: string]: unknown; // Allow other top-level properties, changed any to unknown
}

declare global {
  // ... existing code ...
}