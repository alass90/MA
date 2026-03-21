import { useState, useCallback } from 'react';
import { backendApi as api } from '@/lib/api-client';

/**
 * Hook to manage agent-generated file snapshots from Supabase Storage.
 * Handles signed URL refreshment for private buckets.
 */
export function useFileSnapshot(initialUrl?: string, supabasePath?: string) {
    const [url, setUrl] = useState<string | undefined>(initialUrl);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refreshUrl = useCallback(async () => {
        if (!supabasePath) return;

        setIsRefreshing(true);
        setError(null);
        try {
            const response = await api.post<{ url: string }>('/storage/refresh-url', {
                supabase_path: supabasePath
            });
            if (response.success && response.data?.url) {
                setUrl(response.data.url);
                return response.data.url;
            }
            throw new Error(response.error?.message || 'Failed to refresh URL');
        } catch (err: any) {
            console.error('Failed to refresh signed URL:', err);
            setError(err.message || 'Failed to refresh URL');
            return null;
        } finally {
            setIsRefreshing(false);
        }
    }, [supabasePath]);

    // Helper to handle 403/401 errors from storage
    const handleLoadError = useCallback(() => {
        // If we have a path, try to refresh once on error
        if (supabasePath && !isRefreshing) {
            refreshUrl();
        }
    }, [supabasePath, isRefreshing, refreshUrl]);

    return {
        url,
        isRefreshing,
        error,
        refreshUrl,
        handleLoadError
    };
}
