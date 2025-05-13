import type React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import type { Server } from '../../../types'; // Corrected import path

interface ServerTableProps {
  servers: Server[];
  isLoading: boolean;
  onEditServer: (server: Server) => void;
  onDeleteServer: (id: number) => void;
  currentError?: string; // To display error if table loading fails specifically
}

const ServerTable: React.FC<ServerTableProps> = ({ servers, isLoading, onEditServer, onDeleteServer, currentError }) => {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-40">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  // If there was an error loading servers (passed via currentError), it's handled by Notification component in App.tsx
  // This specific check is for when there's no general error, but the server list is empty.
  if (!currentError && servers.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
        <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-slate-900">No servers available</h3>
        <p className="mt-1 text-sm text-slate-500">Get started by adding a new server.</p>
      </div>
    );
  }
  
  // If there is a currentError, the Notification component in App.tsx will display it.
  // We don't want to show "No servers available" if there was an error fetching them.
  if (currentError && servers.length === 0) {
    return null; // Error is handled by Notification component
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="w-12">ID</TableHead>
              <TableHead className="w-[15%]">Name</TableHead>
              <TableHead className="w-[30%]">Details</TableHead>
              <TableHead className="w-[20%]">Environment</TableHead>
              <TableHead>Autostart</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {servers.map((srv) => (
              <TableRow key={srv.id}>
                <TableCell className="font-medium">{srv.id}</TableCell>
                <TableCell className="font-semibold">{srv.name}</TableCell>
                <TableCell className="font-mono text-sm break-all">
                  {srv.type === 'url' ? (
                    <div title={srv.url}>
                      <span className="font-semibold">URL: </span>{srv.url}
                    </div>
                  ) : (
                    <>
                      <div>
                        <span className="font-semibold">Cmd: </span>{srv.command || <span className="text-slate-400 italic">N/A</span>}
                      </div>
                      {srv.args && srv.args.length > 0 && (
                        <div className="text-xs mt-1" title={srv.args.join(' ')}>
                          <span className="font-semibold">Args: </span>
                          <span className="truncate">{srv.args.join(' ')}</span>
                        </div>
                      )}
                    </>
                  )}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  <div 
                    className="max-w-[200px] truncate" 
                    title={srv.env && Object.keys(srv.env).length > 0 ? Object.entries(srv.env).map(([k, v]) => `${k}=${v}`).join(', ') : 'None'}
                  >
                    {srv.env && Object.keys(srv.env).length > 0 
                      ? Object.entries(srv.env).map(([k, v]) => `${k}=${v}`).join(', ')
                      : <span className="text-slate-400 italic">None</span>
                    }
                  </div>
                </TableCell>
                <TableCell>
                  {srv.autostart ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Enabled
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                      Disabled
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end space-x-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="h-8 px-2 text-slate-700"
                      onClick={() => onEditServer(srv)}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                        <title>Edit</title>
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                      Edit
                    </Button>
                    <Button 
                      variant="outline"
                      size="sm"
                      className="h-8 px-2 text-red-700 border-red-200 hover:bg-red-50 hover:text-red-800" 
                      onClick={() => onDeleteServer(srv.id)}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                        <title>Delete</title>
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        <line x1="10" y1="11" x2="10" y2="17" />
                        <line x1="14" y1="11" x2="14" y2="17" />
                      </svg>
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default ServerTable; 