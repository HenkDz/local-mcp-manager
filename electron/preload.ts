// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

const { contextBridge, ipcRenderer } = require("electron");
import type { IElectronAPI, ServerFormData, Server, DetectedClient, ClientMcpJsonData } from '../types/index.js';

console.log('Preload script loaded successfully from electron/preload.ts');

const electronAPI: IElectronAPI = {
  // Database operations
  addServer: (serverDetails: ServerFormData) => ipcRenderer.invoke('db-add-server', serverDetails),
  getAllServers: () => ipcRenderer.invoke('db-get-servers'),
  getServerById: (id: number) => ipcRenderer.invoke('db-get-server', id),
  updateServer: (serverDetails: Server) => ipcRenderer.invoke('db-update-server', serverDetails),
  deleteServer: (id: number) => ipcRenderer.invoke('db-delete-server', id),
  importServers: (jsonString: string) => ipcRenderer.invoke('servers:import', jsonString),
  
  // Client detection and configuration
  detectClients: () => ipcRenderer.invoke('app:detect-clients'),
  getClientMcpServers: (filePath: string) => ipcRenderer.invoke('client:get-mcp-servers', filePath),
  writeClientMcpConfig: (filePath: string, servers: Server[], clientId: string) => ipcRenderer.invoke('client:write-mcp-config', filePath, servers, clientId),
};

try {
  contextBridge.exposeInMainWorld('electronAPI', electronAPI);
} catch (error) {
  console.error('[Preload] Failed to expose electronAPI to main world:', error);
}

// Example: send: (channel, data) => ipcRenderer.send(channel, data),
// Example: on: (channel, func) => ipcRenderer.on(channel, (event, ...args) => func(...args)) 