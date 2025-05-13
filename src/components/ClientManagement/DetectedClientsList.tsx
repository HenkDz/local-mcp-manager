import type React from 'react';
import { useEffect, useState } from 'react';
import type { DetectedClient } from '../../../types'; // Adjust path as necessary
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface DetectedClientsListProps {
  clients: DetectedClient[];
  isLoading: boolean;
  error: string | null;
  onConfigureClient: (client: DetectedClient) => void;
}

const DetectedClientsList: React.FC<DetectedClientsListProps> = ({ clients, isLoading, error, onConfigureClient }) => {
  if (isLoading) {
    return <p>Loading client configurations...</p>;
  }

  if (error) {
    return <p className="text-red-500">Error detecting clients: {error}</p>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Detected MCP Clients</CardTitle>
        <CardDescription>
          The following MCP-compatible clients have been detected on your system based on their global configuration files.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {clients.length === 0 && !isLoading && !error? (
          <p>No clients detected or none have a recognizable global MCP configuration.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Global MCP Config Path</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">{client.name}</TableCell>
                  <TableCell>
                    {client.isConfigured ? (
                      <Badge variant="success">Configured</Badge>
                    ) : (
                      <Badge variant="outline">Not Configured</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {client.globalMcpConfigPath || 'N/A'}
                  </TableCell>
                  <TableCell>
                    {client.globalMcpConfigPath && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => onConfigureClient(client)}
                        disabled={!client.globalMcpConfigPath}
                      >
                        Configure
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default DetectedClientsList; 