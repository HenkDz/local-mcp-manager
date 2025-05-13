import type React from 'react';
import { Button } from '@/components/ui/button';
import { CardTitle, CardDescription } from "@/components/ui/card";

interface PageHeaderProps {
  onAddNewServer: () => void;
  onImportServers: () => void;
}

const PageHeader: React.FC<PageHeaderProps> = ({ onAddNewServer, onImportServers }) => {
  return (
    <div className="flex justify-between items-center">
      <div>
        <CardTitle className="text-2xl font-bold text-slate-800">MCP Manager</CardTitle>
        <CardDescription className="text-slate-500">Manage your Model Context Protocol servers</CardDescription>
      </div>
      <div className="flex space-x-2">
        <Button onClick={onImportServers} variant="outline" className="gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <title>Import Servers</title>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          Import Servers
        </Button>
        <Button onClick={onAddNewServer} className="gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <title>Add New Server</title>
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add New Server
        </Button>
      </div>
    </div>
  );
};

export default PageHeader; 