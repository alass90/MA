import { useEffect, useState } from "react";
import { useSandpack } from "@codesandbox/sandpack-react";

/**
 * Hook to synchronize Sandpack files with a Daytona sandbox.
 * 
 * @param sandboxId - The ID of the Daytona sandbox
 * @param shouldSync - Whether to actively sync files (e.g., only when an agent is running)
 */
export function useDaytonaSync(sandboxId: string, shouldSync: boolean = true) {
  const { sandpack } = useSandpack();

  useEffect(() => {
    if (!sandboxId || !shouldSync) return;

    let isMounted = true;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/sandbox/${sandboxId}/files`);
        if (!res.ok) throw new Error("Failed to fetch files");
        
        const files = await res.json();
        
        if (!isMounted) return;

        // Update each file in Sandpack
        Object.entries(files).forEach(([path, content]) => {
          // Only update if content changed to avoid unnecessary re-renders
          if (sandpack.files[path]?.code !== content) {
            sandpack.updateFile(path, content as string);
          }
        });
      } catch (error) {
        console.error("[useDaytonaSync] Synchronization error:", error);
      }
    }, 1000); // Polling every 1 second for balance

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [sandboxId, shouldSync, sandpack]);
}

/**
 * Hook to fetch initial files from a Daytona sandbox.
 */
export function useInitialDaytonaFiles(sandboxId: string) {
  const [files, setFiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sandboxId) return;

    async function fetchInitialFiles() {
      try {
        setLoading(true);
        const res = await fetch(`/api/sandbox/${sandboxId}/files`);
        if (!res.ok) throw new Error("Failed to fetch initial files");
        
        const data = await res.json();
        setFiles(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchInitialFiles();
  }, [sandboxId]);

  return { files, loading, error };
}
