const { contextBridge, ipcRenderer } = require("electron");
console.log("Preload script loaded successfully from electron/preload.ts");
const electronAPI = {
  // Database operations
  addServer: (serverDetails) => ipcRenderer.invoke("db-add-server", serverDetails),
  getAllServers: () => ipcRenderer.invoke("db-get-servers"),
  getServerById: (id) => ipcRenderer.invoke("db-get-server", id),
  updateServer: (serverDetails) => ipcRenderer.invoke("db-update-server", serverDetails),
  deleteServer: (id) => ipcRenderer.invoke("db-delete-server", id),
  importServers: (jsonString) => ipcRenderer.invoke("servers:import", jsonString),
  // Client detection and configuration
  detectClients: () => ipcRenderer.invoke("app:detect-clients"),
  getClientMcpServers: (filePath) => ipcRenderer.invoke("client:get-mcp-servers", filePath),
  writeClientMcpConfig: (filePath, servers, clientId) => ipcRenderer.invoke("client:write-mcp-config", filePath, servers, clientId)
};
try {
  contextBridge.exposeInMainWorld("electronAPI", electronAPI);
} catch (error) {
  console.error("[Preload] Failed to expose electronAPI to main world:", error);
}
