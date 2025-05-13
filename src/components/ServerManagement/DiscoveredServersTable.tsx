import type React from 'react';
import type { ServerFormData } from '../../../types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge'; // For client name

export interface DiscoveredServerItem {
  clientName: string;
  clientId: string;
  originalServerName: string; 
  details: ServerFormData; 
}

interface DiscoveredServersTableProps {
  servers: DiscoveredServerItem[];
  isLoading: boolean;
  currentError?: string | null;
  onImportServer: (serverToImport: ServerFormData, originalClientName: string, originalServerName: string) => void;
  isServerImportedMap?: Record<string, boolean>;
}

const DiscoveredServersTable: React.FC<DiscoveredServersTableProps> = ({
  servers,
  isLoading,
  currentError,
  onImportServer,
  isServerImportedMap = {},
}) => {
  if (isLoading) {
    return <p className="text-center py-4">Checking for servers in client configurations...</p>;
  }

  if (currentError) {
    return <p className="text-red-500 text-center py-4">Error loading discovered servers: {currentError}</p>;
  }

  if (servers.length === 0) {
    return <p className="text-center text-slate-600 py-4">No servers discovered in client MCP configurations, or no clients configured.</p>;
  }

  return (
    <div className="mt-6 border rounded-lg overflow-hidden shadow-sm bg-white">
      <Table>
        <TableHeader className="bg-slate-50">
          <TableRow>
            <TableHead className="w-[25%]">Server Name</TableHead>
            <TableHead className="w-[30%]">Details</TableHead>
            <TableHead className="w-[20%]">Originating Client</TableHead>
            <TableHead className="text-right w-[25%]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {servers.map((server) => {
            const importKey = `${server.clientName}-${server.originalServerName}`;
            const isImported = isServerImportedMap[importKey] || false;
            return (
              <TableRow key={`${server.clientId}-${server.originalServerName}`}>
                <TableCell className="font-medium">{server.details.name}</TableCell>
                <TableCell className="font-mono text-xs break-all max-w-xs truncate">
                  {server.details.type === 'url' ? (
                    <div title={server.details.url}>
                      <span className="font-semibold">URL: </span>{server.details.url}
                    </div>
                  ) : (
                    <>
                      <div>
                        <span className="font-semibold">Cmd: </span>{server.details.command || <span className="text-slate-400 italic">N/A</span>}
                      </div>
                      {server.details.args && server.details.args.length > 0 && (
                        <div className="text-xs mt-1" title={server.details.args.join(' ')}>
                          <span className="font-semibold">Args: </span>
                          <span className="truncate">{server.details.args.join(' ')}</span>
                        </div>
                      )}
                    </>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{server.clientName}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => onImportServer(server.details, server.clientName, server.originalServerName)}
                    disabled={isImported}
                    className="text-xs disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {isImported ? 'Imported' : 'Import'}
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
        {servers.length > 0 && (
             <TableCaption className="py-3 text-xs">These servers were found in the mcp.json files of your detected clients.</TableCaption>
        )}
      </Table>
    </div>
  );
};

export default DiscoveredServersTable; 