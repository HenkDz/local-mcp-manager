import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { Server, ServerFormData } from '../../../types'; // Updated import path & added ServerFormData
import Notification from './Notification'; // For displaying form-specific messages

interface ServerFormDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSubmit: (formData: ServerFormData, editingServerId: number | null) => Promise<{ success: boolean; error?: string }>;
  editingServer: Server | null;
}

const ServerFormDialog: React.FC<ServerFormDialogProps> = ({ isOpen, onOpenChange, onSubmit, editingServer }) => {
  const [serverName, setServerName] = useState('');
  const [serverType, setServerType] = useState<'command' | 'url'>('command');
  const [serverCommand, setServerCommand] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [serverArgs, setServerArgs] = useState('');
  const [serverEnv, setServerEnv] = useState('');
  const [serverAutostart, setServerAutostart] = useState(false);
  const [formMessage, setFormMessage] = useState('');
  const [formMessageType, setFormMessageType] = useState<'success' | 'error' | 'info'>('info');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = useCallback(() => {
    const type = editingServer?.type || 'command';
    setServerName(editingServer?.name || '');
    setServerType(type);
    setServerCommand(type === 'command' ? (editingServer?.command || '') : '');
    setServerUrl(type === 'url' ? (editingServer?.url || '') : '');
    setServerArgs(type === 'command' && editingServer?.args ? editingServer.args.join(' ') : '');
    setServerEnv(editingServer?.env ? Object.entries(editingServer.env).map(([k,v]) => `${k}=${v}`).join(', ') : '');
    setServerAutostart(editingServer?.autostart || false);
    setFormMessage('');
    setIsSubmitting(false);
  }, [editingServer]);

  useEffect(() => {
    if (isOpen) {
      resetForm();
    } else {
      setFormMessage(''); 
    }
  }, [isOpen, resetForm]);

  const handleSubmit = async () => {
    if (!serverName) {
      setFormMessage('Server Name is required.');
      setFormMessageType('error');
      return;
    }
    if (serverType === 'command' && !serverCommand) {
      setFormMessage('Command is required for command-based servers.');
      setFormMessageType('error');
      return;
    }
    if (serverType === 'url' && !serverUrl) {
      setFormMessage('URL is required for URL-based servers.');
      setFormMessageType('error');
      return;
    }

    setIsSubmitting(true);
    setFormMessage('');

    const envObject: Record<string, string> = {};
    if (serverEnv.trim() !== '') {
        for (const pair of serverEnv.split(',')) {
            const [key, ...valueParts] = pair.split('=');
            const value = valueParts.join('=');
            if (key && value) envObject[key.trim()] = value.trim();
        }
    }

    let formData: ServerFormData;
    if (serverType === 'command') {
      const argsArray = serverArgs.split(' ').filter(arg => arg.trim() !== '');
      formData = {
        name: serverName,
        type: 'command',
        command: serverCommand,
        args: argsArray,
        env: envObject,
        autostart: serverAutostart,
      };
    } else { // type === 'url'
      formData = {
        name: serverName,
        type: 'url',
        url: serverUrl,
        env: envObject,
        autostart: serverAutostart,
        // command & args will be undefined, matching ServerFormData optionality
      };
    }

    const result = await onSubmit(formData, editingServer?.id || null);
    setIsSubmitting(false);

    if (result.success) {
      setFormMessage(editingServer ? 'Server updated successfully!' : 'Server added successfully!');
      setFormMessageType('success');
      setTimeout(() => { onOpenChange(false); }, 1500);
    } else {
      setFormMessage(result.error || 'An unknown error occurred.');
      setFormMessageType('error');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(openState) => {
        if (isSubmitting && !openState) return; // Prevent closing while submitting via Esc key etc.
        onOpenChange(openState);
    }}>
      <DialogContent className="sm:max-w-[600px] p-0 bg-white rounded-lg overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="text-xl">{editingServer ? 'Edit Server' : 'Add New Server'}</DialogTitle>
          <DialogDescription>
            {editingServer 
              ? 'Configure the server settings and click save when done.' 
              : 'Enter the details for the new MCP server below.'}
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[70vh]">
          <div className="p-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="server-name">Server Name</Label>
              <Input
                id="server-name"
                placeholder="Enter a descriptive name"
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
                <Label>Server Type</Label>
                <RadioGroup defaultValue="command" value={serverType} onValueChange={(value: 'command' | 'url') => setServerType(value)} className="flex space-x-4" disabled={isSubmitting}>
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="command" id="type-command" />
                        <Label htmlFor="type-command">Command-based</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="url" id="type-url" />
                        <Label htmlFor="type-url">URL-based (SSE)</Label>
                    </div>
                </RadioGroup>
            </div>

            {serverType === 'command' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="server-command">Command</Label>
                  <Input 
                    id="server-command" 
                    placeholder="python -m server.py or /path/to/executable"
                    value={serverCommand}
                    onChange={(e) => setServerCommand(e.target.value)}
                    disabled={isSubmitting}
                  />
                  <p className="text-xs text-slate-500">The command to execute.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="server-args">Arguments</Label>
                  <Input 
                    id="server-args" 
                    placeholder="--port 8080 --verbose"
                    value={serverArgs}
                    onChange={(e) => setServerArgs(e.target.value)}
                    disabled={isSubmitting}
                  />
                  <p className="text-xs text-slate-500">Space separated arguments.</p>
                </div>
              </>
            )}

            {serverType === 'url' && (
              <div className="space-y-2">
                <Label htmlFor="server-url">Server URL (SSE)</Label>
                <Input 
                  id="server-url" 
                  placeholder="http://localhost:8000/sse"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  disabled={isSubmitting}
                />
                <p className="text-xs text-slate-500">The full URL for the Server-Sent Events endpoint.</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="server-env">Environment Variables</Label>
              <Input 
                id="server-env" 
                placeholder="KEY=value, ANOTHER_KEY=another value"
                value={serverEnv}
                onChange={(e) => setServerEnv(e.target.value)}
                disabled={isSubmitting}
              />
              <p className="text-xs text-slate-500">Comma separated KEY=value pairs.</p>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Checkbox 
                id="server-autostart" 
                checked={serverAutostart}
                onCheckedChange={(checked) => setServerAutostart(checked === true)}
                disabled={isSubmitting}
              />
              <Label
                htmlFor="server-autostart"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Auto-start server with application
              </Label>
            </div>
            
            {formMessage && (
              <Notification message={formMessage} type={formMessageType} onDismiss={() => setFormMessage('')} />
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="bg-slate-50 px-6 py-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} className="ml-2" disabled={isSubmitting}>
            {isSubmitting ? (editingServer ? 'Saving...': 'Adding...') : (editingServer ? 'Save Changes' : 'Add Server')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ServerFormDialog; 