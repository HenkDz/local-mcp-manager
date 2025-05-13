import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import Notification, { type NotificationProps } from './components/ServerManagement/Notification';
import PageHeader from './components/ServerManagement/PageHeader';
import ServerTable from './components/ServerManagement/ServerTable';
import ServerFormDialog from './components/ServerManagement/ServerFormDialog';
import type { DetectedClient, Server, ServerFormData, ClientMcpJsonData, ImportResult } from '../types';
import ImportServersDialog from './components/ServerManagement/ImportServersDialog';
import DetectedClientsList from './components/ClientManagement/DetectedClientsList';
import DiscoveredServersTable, { type DiscoveredServerItem } from './components/ServerManagement/DiscoveredServersTable';

// Removed local declare global block for window.electronAPI
// The declaration in src/renderer.d.ts will be used instead.

function App() {
  // Managed Servers State
  const [servers, setServers] = useState<Server[]>([]);
  const [isLoadingServers, setIsLoadingServers] = useState<boolean>(true);
  const [serversError, setServersError] = useState<string>('');

  // Form and Dialog State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<Server | null>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);

  // Detected Clients State
  const [detectedClients, setDetectedClients] = useState<DetectedClient[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState<boolean>(true);
  const [clientsError, setClientsError] = useState<string>('');

  // Discovered Servers (from clients) State
  const [discoveredItems, setDiscoveredItems] = useState<DiscoveredServerItem[]>([]);
  const [isLoadingDiscovered, setIsLoadingDiscovered] = useState<boolean>(false);
  const [discoveredError, setDiscoveredError] = useState<string>('');
  
  // Notification State
  const [notificationProps, setNotificationProps] = useState<NotificationProps | null>(null);
  const [potentiallyImportedMap, setPotentiallyImportedMap] = useState<Record<string, boolean>>({});

  const showNotification = useCallback((message: string, type: 'success' | 'error' | 'info', title?: string) => {
    setNotificationProps({ message, type, title, onDismiss: () => setNotificationProps(null) });
  }, []);

  // Fetch Managed Servers
  const fetchManagedServers = useCallback(async () => {
    setIsLoadingServers(true);
    setServersError('');
    if (!window.electronAPI?.getAllServers) {
      const err = 'Electron API (getAllServers) is not available.';
      setServersError(err);
      setIsLoadingServers(false);
      return;
    }
    try {
      const result = await window.electronAPI.getAllServers();
      if (result.success && result.servers) {
        setServers(result.servers);
      } else {
        setServersError(result.error || 'Unknown API error loading managed servers');
      }
    } catch (error) {
      setServersError(error instanceof Error ? error.message : 'Exception loading managed servers');
    } finally {
      setIsLoadingServers(false);
    }
  }, []);

  // Fetch Discovered Servers from a specific client
  const fetchDiscoveredServersForClient = useCallback(async (client: DetectedClient): Promise<DiscoveredServerItem[]> => {
    if (!client.globalMcpConfigPath || !window.electronAPI?.getClientMcpServers) {
      console.warn(`API or path missing for ${client.name}`);
      return [];
    }
    try {
      const result = await window.electronAPI.getClientMcpServers(client.globalMcpConfigPath);
      const clientSideDiscoveredItems: DiscoveredServerItem[] = [];
      if (result.success && result.data) {
        const mcpData = result.data;
        const serversSource = mcpData.mcpServers || mcpData.servers || {};
        
        for (const serverNameInFile in serversSource) {
          if (Object.prototype.hasOwnProperty.call(serversSource, serverNameInFile)) {
            const details = serversSource[serverNameInFile];
            const serverFormData: ServerFormData = {
              name: typeof details.name === 'string' ? details.name : serverNameInFile,
              type: typeof details.url === 'string' ? 'url' : 'command',
              command: typeof details.command === 'string' ? details.command : undefined,
              url: typeof details.url === 'string' ? details.url : undefined,
              args: Array.isArray(details.args) ? details.args.map(String) : (typeof details.args === 'string' ? details.args.split(' ') : []),
              env: typeof details.env === 'object' && details.env !== null ? details.env as Record<string, string> : {},
              autostart: typeof details.autostart === 'boolean' ? details.autostart : false,
            };
            clientSideDiscoveredItems.push({
              clientId: client.id,
              clientName: client.name,
              originalServerName: serverFormData.name,
              details: serverFormData,
            });
          }
        }
      }
      return clientSideDiscoveredItems;
    } catch (err) {
      console.error(`Exception fetching discovered from ${client.name}:`, err);
      return [];
    }
  }, []);


  // Initial Load Logic
  useEffect(() => {
    const initialLoad = async () => {
      setIsLoadingClients(true);
      setClientsError('');
      if (!window.electronAPI?.detectClients) {
        setClientsError('Client detection API not available.');
        setIsLoadingClients(false);
        setIsLoadingDiscovered(false);
        return;
      }

      let localDetectedClients: DetectedClient[] = [];
      try {
        const clientResult = await window.electronAPI.detectClients();
        if (clientResult.success && clientResult.clients) {
          localDetectedClients = clientResult.clients;
          setDetectedClients(localDetectedClients);
        } else {
          setClientsError(clientResult.error || 'Failed to detect clients.');
        }
      } catch (err) {
        setClientsError(err instanceof Error ? err.message : 'Unknown error during client detection');
      } finally {
        setIsLoadingClients(false);
      }

      if (localDetectedClients.length > 0) {
        setIsLoadingDiscovered(true);
        setDiscoveredError('');
        try {
          const allDiscoveredPromises = localDetectedClients.map(c =>
            (c.isConfigured && c.globalMcpConfigPath) ? fetchDiscoveredServersForClient(c) : Promise.resolve([])
          );
          const allDiscoveredResults = await Promise.all(allDiscoveredPromises);
          setDiscoveredItems(allDiscoveredResults.flat());
        } catch (err) {
          setDiscoveredError(err instanceof Error ? err.message : 'Failed to load discovered servers.');
        } finally {
          setIsLoadingDiscovered(false);
        }
      }
      
      fetchManagedServers();
    };

    initialLoad();
  }, [fetchManagedServers, fetchDiscoveredServersForClient]);
  
  // Update isPotentiallyImported flag
  useEffect(() => {
    const newMap: Record<string, boolean> = {};
    for (const item of discoveredItems) {
      const key = `${item.clientName}-${item.originalServerName}`;
      newMap[key] = servers.some(
        managed =>
          managed.name === item.details.name ||
          managed.name === `${item.details.name} (from ${item.clientName})`
      );
    }
    setPotentiallyImportedMap(newMap);
  }, [servers, discoveredItems]);

  const handleImportDiscoveredServer = useCallback(async (serverDetailsToImport: ServerFormData, clientName: string, originalServerName: string) => {
    if (!window.electronAPI?.addServer) {
      showNotification('Add server function not available.', 'error', 'Import Error');
      return;
    }
    
    let newServerName = serverDetailsToImport.name;
    if (servers.some(s => s.name === newServerName)) {
      newServerName = `${newServerName} (from ${clientName})`;
    }
    let suffix = 1;
    let finalName = newServerName;
    while(servers.some(s => s.name === finalName)) {
        finalName = `${newServerName}_${suffix++}`;
    }

    const finalServerData: ServerFormData = {
        ...serverDetailsToImport,
        name: finalName, 
    };

    try {
      const result = await window.electronAPI.addServer(finalServerData);
      if (result.success) {
        showNotification(`Server "${finalName}" imported successfully.`, 'success');
        fetchManagedServers(); 
      } else {
        showNotification(result.error || 'Failed to import server.', 'error', 'Import Error');
      }
    } catch (error) {
      showNotification(`Exception during import: ${error instanceof Error ? error.message : String(error)}`, 'error', 'Import Error');
    }
  }, [servers, fetchManagedServers, showNotification]);

  const handleOpenAddForm = () => {
    setEditingServer(null);
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (server: Server) => {
    setEditingServer(server);
    setIsFormOpen(true);
  };

  const handleFormSubmit = useCallback(async (
    formData: ServerFormData, 
    editingId: number | null
  ): Promise<{ success: boolean; error?: string }> => {
    if (!window.electronAPI) {
      return { success: false, error: 'Electron API not available.' };
    }
    try {
      if (editingId !== null && editingServer) {
        if (!window.electronAPI.updateServer) return { success: false, error: 'Update server API not found.' };
        const serverToUpdate: Server = {
            id: editingId,
            name: formData.name,
            type: formData.type,
            command: formData.type === 'command' ? formData.command : undefined,
            url: formData.type === 'url' ? formData.url : undefined,
            args: formData.type === 'command' ? (formData.args || []) : [], 
            env: formData.env || {},
            autostart: formData.autostart,
            createdAt: editingServer.createdAt, 
            updatedAt: new Date().toISOString(), 
        };
        const result = await window.electronAPI.updateServer(serverToUpdate);
        if (result.success) {
          showNotification('Server updated successfully.', 'success');
          fetchManagedServers(); 
          return { success: true };
        }
        showNotification(result.error || 'Failed to update.', 'error', 'Update Error');
        return { success: false, error: result.error };
      }
      
      if (!window.electronAPI.addServer) return { success: false, error: 'Add server API not found.' };
      const result = await window.electronAPI.addServer(formData);
      if (result.success) {
        showNotification('Server added successfully.', 'success');
        fetchManagedServers();
        return { success: true };
      }
      showNotification(result.error || 'Failed to add.', 'error', 'Add Error');
      return { success: false, error: result.error };
    } catch (error) {
      const msg = `Form submission error: ${error instanceof Error ? error.message : String(error)}`;
      showNotification(msg, 'error', 'Form Error');
      return { success: false, error: msg };
    }
  }, [editingServer, fetchManagedServers, showNotification]);

  const handleDeleteServer = useCallback(async (id: number) => {
    if (!window.electronAPI?.deleteServer) {
        showNotification('Delete server API not found.', 'error', 'Delete Error');
        return;
    }
    if (confirm('Are you sure you want to delete this server?')) {
      try {
        const result = await window.electronAPI.deleteServer(id);
        if (result.success) {
          showNotification('Server deleted.', 'success');
          fetchManagedServers();
        } else {
          showNotification(result.error || 'Failed to delete.', 'error', 'Delete Error');
        }
      } catch (error) {
        showNotification(`Exception during delete: ${error instanceof Error ? error.message : String(error)}`, 'error', 'Delete Error');
      }
    }
  }, [fetchManagedServers, showNotification]);

  const handleOpenImportDialog = () => setIsImportDialogOpen(true);

  const handleImportServersSubmit = useCallback(async (jsonString: string): Promise<ImportResult> => {
    if (!window.electronAPI?.importServers) {
      const errorResult = { success: false, message: 'Import servers API not found.', errorCount: 1, errors: [{serverName: 'API', error: 'Not found'}] };
      showNotification(errorResult.message, 'error', 'Import Error');
      return errorResult;
    }
    setIsLoadingServers(true);
    try {
      const result = await window.electronAPI.importServers(jsonString);
      showNotification(result.message || 'Import finished.', result.success && (!result.errorCount || result.errorCount === 0) ? 'success' : 'info', 'Import Result');
      if (result.success) fetchManagedServers();
      return result;
    } catch (error) {
      const errorMsg = `Exception during import: ${error instanceof Error ? error.message : String(error)}`;
      showNotification(errorMsg, 'error', 'Import Error');
      return { success: false, message: errorMsg, errorCount: 1, errors: [{serverName: 'Exception', error: errorMsg }] };
    } finally {
      setIsLoadingServers(false);
    }
  }, [fetchManagedServers, showNotification]);

  const handleConfigureClient = useCallback(async (client: DetectedClient) => {
    if (!client.globalMcpConfigPath) {
      showNotification('Client configuration path is missing.', 'error', 'Configuration Error');
      return;
    }
    showNotification(`Configuring ${client.name}...`, 'info', 'Client Configuration');
    try {
      const result = await window.electronAPI.writeClientMcpConfig(client.globalMcpConfigPath, servers);
      if (result.success) {
        showNotification(`${client.name} configured. mcp.json updated.`, 'success', 'Configuration Complete');
      } else {
        showNotification(result.error || 'Failed to write config.', 'error', 'Configuration Failed');
      }
    } catch (error: unknown) {
      let message = 'Unknown error';
      if (error instanceof Error) {
        message = error.message;
      }
      showNotification(`Error configuring ${client.name}: ${message}`, 'error', 'Configuration Failed');
    }
  }, [servers, showNotification]);

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      {notificationProps && (
        <Notification {...notificationProps} />
      )}
      <div className="container mx-auto px-4">
        <Tabs defaultValue="servers" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6 bg-slate-200 dark:bg-slate-800 p-1 rounded-lg">
            <TabsTrigger value="servers">Servers</TabsTrigger>
            <TabsTrigger value="clients">Clients</TabsTrigger>
          </TabsList>

          <TabsContent value="servers">
            <Card className="shadow-lg border-slate-200">
              <CardHeader className="bg-white border-b border-slate-100">
                <PageHeader onAddNewServer={handleOpenAddForm} onImportServers={handleOpenImportDialog} />
              </CardHeader>
              <CardContent className="p-6">
                {serversError && (
                  <Notification message={serversError} type="error" title="Managed Servers Error" onDismiss={() => setServersError('')} />
                )}
                <h2 className="text-lg font-semibold mb-4">Managed Servers ({isLoadingServers ? '...' : servers.length})</h2>
                <ServerTable servers={servers} isLoading={isLoadingServers} onEditServer={handleOpenEditForm} onDeleteServer={handleDeleteServer} currentError={serversError} />
                
                <div className="my-6 pt-6 border-t border-slate-200">
                    <h2 className="text-lg font-semibold mb-4">Discovered Servers ({isLoadingDiscovered ? '...' : discoveredItems.length})</h2>
                    {discoveredError && (
                       <Notification message={discoveredError} type="error" title="Discovered Servers Error" onDismiss={() => setDiscoveredError('')} />
                    )}
                    <DiscoveredServersTable 
                      servers={discoveredItems}
                      isLoading={isLoadingDiscovered}
                      onImportServer={handleImportDiscoveredServer}
                      isServerImportedMap={potentiallyImportedMap}
                    />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="clients">
            {clientsError && (
              <Notification message={clientsError} type="error" title="Client Detection Error" onDismiss={() => setClientsError('')} />
            )}
            <DetectedClientsList clients={detectedClients} isLoading={isLoadingClients} error={clientsError} onConfigureClient={handleConfigureClient} />
          </TabsContent>
        </Tabs>
      </div>

      <ServerFormDialog isOpen={isFormOpen} onOpenChange={setIsFormOpen} onSubmit={handleFormSubmit} editingServer={editingServer} />
      <ImportServersDialog isOpen={isImportDialogOpen} onOpenChange={setIsImportDialogOpen} onImportSubmit={handleImportServersSubmit} />
    </div>
  );
}

export default App; 