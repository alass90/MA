import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Github, Loader2, CheckCircle2, ExternalLink, Send as Publish } from 'lucide-react';
import { backendApi } from '@/lib/api-client';
import { toast } from 'sonner';

interface GithubPushModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  sandboxId?: string;
  defaultRepoName?: string;
}

export function GithubPushModal({ isOpen, onOpenChange, sandboxId, defaultRepoName = 'talos-ai-project' }: GithubPushModalProps) {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [repoName, setRepoName] = useState(defaultRepoName);
  const [isPrivate, setIsPrivate] = useState(false);
  const [successUrl, setSuccessUrl] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      checkStatus();
      setSuccessUrl(null);
    }
  }, [isOpen]);

  // Window message listener for OAuth callback
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'github-integration-success') {
        toast.success('GitHub account connected successfully!');
        checkStatus();
      } else if (event.data?.type === 'github-integration-error') {
        toast.error(`GitHub connection failed: ${event.data.message}`);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const checkStatus = async () => {
    setIsChecking(true);
    try {
      const res = await backendApi.get('/github/status');
      if (res.success && res.data) {
        setIsConnected(res.data.connected);
      } else {
        setIsConnected(false);
      }
    } catch (e) {
      setIsConnected(false);
    } finally {
      setIsChecking(false);
    }
  };

  const handleConnect = async () => {
    try {
      // To pass the token, we can just intercept the Supabase session
      import('@/lib/supabase/client').then(async ({ createClient }) => {
        const supabase = createClient();
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) {
          toast.error("You must be logged in to connect GitHub.");
          return;
        }
        
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || '';
        const connectUrl = `${backendUrl}/github/connect?token=${token}`;
        
        // Open popup
        const width = 600;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;
        window.open(connectUrl, 'github-oauth', `width=${width},height=${height},left=${left},top=${top}`);
      });
    } catch (e) {
      toast.error("Failed to initiate GitHub connection");
    }
  };

  const handlePush = async () => {
    if (!sandboxId) {
      toast.error("No active sandbox to push.");
      return;
    }
    if (!repoName.trim()) {
      toast.error("Repository name is required.");
      return;
    }

    setIsPushing(true);
    try {
      const res = await backendApi.post('/github/push', {
        sandbox_id: sandboxId,
        repo_name: repoName.trim(),
        is_private: isPrivate
      });

      if (res.success && res.data) {
        toast.success("Successfully published to GitHub!");
        setSuccessUrl(res.data.url);
      } else {
        toast.error(res.error?.message || "Failed to push to GitHub");
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to push to GitHub");
    } finally {
      setIsPushing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Github className="w-5 h-5" />
            Push to GitHub
          </DialogTitle>
          <DialogDescription>
            Export your generated code directly to a GitHub repository.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {isChecking ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : successUrl ? (
            <div className="flex flex-col items-center justify-center space-y-4 py-6">
              <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-medium">Successfully Published!</h3>
                <p className="text-sm text-muted-foreground mt-1">Your code is now live on GitHub.</p>
              </div>
              <Button className="w-full mt-2 gap-2" variant="outline" onClick={() => window.open(successUrl, '_blank')}>
                <ExternalLink className="w-4 h-4" />
                View Repository
              </Button>
            </div>
          ) : !isConnected ? (
            <div className="flex flex-col items-center justify-center space-y-4 py-6 text-center">
              <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                <Github className="w-6 h-6 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-medium">Connect your account</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-[280px]">
                  Authorize TalosAI to create repositories and push code on your behalf.
                </p>
              </div>
              <Button onClick={handleConnect} className="mt-2 text-white bg-zinc-900 shadow-sm border border-transparent hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white dark:bg-white dark:text-zinc-900 border-none">
                <Github className="w-4 h-4 mr-2" />
                Connect GitHub
              </Button>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="repoName">Repository Name</Label>
                <Input
                  id="repoName"
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value.replace(/[^a-zA-Z0-9-_]/g, '-'))}
                  placeholder="my-awesome-project"
                />
                <p className="text-[11px] text-muted-foreground">Only letters, numbers, dashes, and underscores.</p>
              </div>
              
              <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                <div className="space-y-0.5">
                  <Label className="text-sm">Private Repository</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Only you can see this repository.
                  </p>
                </div>
                <Switch
                  checked={isPrivate}
                  onCheckedChange={setIsPrivate}
                />
              </div>

              <Button 
                onClick={handlePush} 
                disabled={isPushing || !repoName.trim()} 
                className="w-full mt-4 text-white bg-zinc-900 shadow-sm border border-transparent hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white dark:bg-white dark:text-zinc-900 border-none"
              >
                {isPushing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Pushing to GitHub...
                  </>
                ) : (
                  <>
                    <Publish className="w-4 h-4 mr-2" />
                    Push Code
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
