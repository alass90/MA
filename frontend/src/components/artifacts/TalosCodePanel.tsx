'use client';

import React from 'react';
import { 
  SandpackProvider, 
  SandpackLayout, 
  SandpackFileExplorer, 
  SandpackCodeEditor, 
  SandpackPreview,
  SandpackThemeProp
} from "@codesandbox/sandpack-react";
import { useInitialDaytonaFiles, useDaytonaSync } from '@/hooks/use-daytona-sync';
import { Loader2 } from 'lucide-react';

interface TalosCodePanelProps {
  sandboxId: string;
  previewUrl?: string; // Daytona port 8080 URL
  theme?: 'dark' | 'light';
  initialFiles?: Record<string, any>;
}

const sandpackDarkTheme: SandpackThemeProp = "dark";
const sandpackLightTheme: SandpackThemeProp = "light";

export const TalosCodePanel: React.FC<TalosCodePanelProps> = ({ 
  sandboxId, 
  previewUrl, 
  theme = 'dark',
  initialFiles
}) => {
  const { files: daytonaFiles, loading, error } = useInitialDaytonaFiles(sandboxId);
  
  // Use initialFiles if provided (for mocking), otherwise use daytonaFiles
  const files = initialFiles || daytonaFiles;

  if (loading && !initialFiles) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground bg-background">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="text-sm font-medium">Loading sandbox files...</p>
      </div>
    );
  }

  if (error && !initialFiles) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-destructive bg-background p-8 text-center">
        <p className="font-bold">Error loading workspace</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full border rounded-xl overflow-hidden bg-background">
      <SandpackProvider
        files={files}
        theme={theme === 'dark' ? sandpackDarkTheme : sandpackLightTheme}
        options={{
          recompileMode: "immediate",
          recompileDelay: 300,
        }}
      >
        {/* Sync hook needs to be inside SandpackProvider */}
        <SandpackSyncWrapper sandboxId={sandboxId} />
        
        {/* We use SandpackLayout with the standard components for the classic "template" look */}
        <SandpackLayout className="h-full border-none rounded-none">
          <SandpackFileExplorer className="h-full border-r" />
          <SandpackCodeEditor 
            showLineNumbers 
            showTabs 
            closableTabs 
            showInlineErrors
            showRunButton={false}
            className="h-full border-r"
          />
          <SandpackPreview 
            showOpenInCodeSandbox={true}
            showRefreshButton
            showRestartButton
            className="h-full"
            {...(previewUrl ? { startRoute: previewUrl } : {})}
          />
        </SandpackLayout>
      </SandpackProvider>
    </div>
  );
};

/**
 * Internal component to handle the synchronization hook within the Sandpack context.
 */
function SandpackSyncWrapper({ sandboxId }: { sandboxId: string }) {
  useDaytonaSync(sandboxId);
  return null;
}
