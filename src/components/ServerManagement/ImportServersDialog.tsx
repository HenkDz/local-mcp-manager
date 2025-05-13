import type React from 'react';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import Notification from './Notification';

export interface ImportResult {
  success: boolean;
  message: string;
  importedCount?: number;
  errorCount?: number;
  errors?: { serverName: string; error: string }[];
}

interface ImportServersDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onImportSubmit: (jsonString: string) => Promise<ImportResult>;
}

const ImportServersDialog: React.FC<ImportServersDialogProps> = ({ isOpen, onOpenChange, onImportSubmit }) => {
  const [jsonInput, setJsonInput] = useState('');
  const [importMessage, setImportMessage] = useState('');
  const [importMessageType, setImportMessageType] = useState<'success' | 'error' | 'info'>('info');
  const [isImporting, setIsImporting] = useState(false);

  const handleSubmit = async () => {
    if (!jsonInput.trim()) {
      setImportMessage('JSON input cannot be empty.');
      setImportMessageType('error');
      return;
    }
    setIsImporting(true);
    setImportMessage('');

    try {
      JSON.parse(jsonInput); 
    } catch (e) {
      setImportMessage('Invalid JSON format. Please check your input.');
      setImportMessageType('error');
      setIsImporting(false);
      return;
    }

    const result = await onImportSubmit(jsonInput);
    setIsImporting(false);
    setImportMessage(result.message);
    setImportMessageType(result.success ? 'success' : 'error');

    if (result.success && result.errorCount === 0) {
      setTimeout(() => {
        onOpenChange(false);
        setJsonInput('');
      }, 1500);
    } 
  };
  
  const handleDialogInteraction = (openStatus: boolean) => {
    if(isImporting && !openStatus) return;
    onOpenChange(openStatus);
    if(!openStatus) {
        setImportMessage('');
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogInteraction}>
      <DialogContent className="sm:max-w-lg p-0 bg-white rounded-lg overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="text-xl">Import Servers from JSON</DialogTitle>
          <DialogDescription className="text-sm text-slate-500">
            Paste your MCP server configurations in JSON format below.
            Refer to the expected `mcpServers` object structure.
          </DialogDescription>
        </DialogHeader>
        
        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="json-import-input">JSON Data</Label>
            <Textarea
              id="json-import-input"
              placeholder='Example: { "mcpServers": { "myServer": { "command": "..." } } }'
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              rows={10}
              disabled={isImporting}
              className="h-[200px] w-[400px] font-mono text-sm border-slate-300 focus:border-primary"
            />
          </div>

          {importMessage && (
            <Notification 
                message={importMessage} 
                type={importMessageType} 
                title={importMessageType === 'error' ? 'Import Error' : 'Import Status'}
                onDismiss={() => setImportMessage('')} 
            />
          )}
        </div>

        <DialogFooter className="bg-slate-50 px-6 py-4 border-t">
          <Button variant="outline" onClick={() => handleDialogInteraction(false)} disabled={isImporting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} className="ml-2" disabled={isImporting}>
            {isImporting ? 'Importing...' : 'Import Servers'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImportServersDialog; 