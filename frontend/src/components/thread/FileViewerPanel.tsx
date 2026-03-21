'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useFileContentQuery } from '@/hooks/files/use-file-queries';
import { AdaptiveHeader } from './artifacts/file-viewer/AdaptiveHeader';
import { Loader2, FileWarning } from 'lucide-react';
import { renderAsync } from 'docx-preview';
import { Button } from '@/components/ui/button';

interface FileViewerPanelProps {
  sandboxId: string;
  filePath: string;
  onClose: () => void;
}

export const FileViewerPanel: React.FC<FileViewerPanelProps> = ({
  sandboxId,
  filePath,
  onClose,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // State for header
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [zoom, setZoom] = useState(100);

  const extension = useMemo(() => filePath.split('.').pop()?.toLowerCase(), [filePath]);
  const filename = useMemo(() => filePath.split('/').pop() || filePath, [filePath]);

  // Fetch file as blob for PDF and DOCX
  const { data: fileData, isLoading, error: fetchError } = useFileContentQuery(sandboxId, filePath, {
    contentType: 'blob',
    enabled: !!sandboxId && !!filePath,
  });

  // Handle Blob URL creation and Cleanup
  useEffect(() => {
    if (fileData instanceof Blob) {
      const url = URL.createObjectURL(fileData);
      setBlobUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [fileData]);

  // Handle DOCX Rendering
  useEffect(() => {
    if (extension === 'docx' && fileData instanceof Blob && containerRef.current) {
      setIsRendering(true);
      setError(null);
      
      const renderDocx = async () => {
        try {
          if (containerRef.current) {
            containerRef.current.innerHTML = ''; // Clear previous content
            await renderAsync(fileData, containerRef.current, undefined, {
              className: "docx-viewer",
              inWrapper: true,
              ignoreLastRenderedPageBreak: false,
            });
          }
        } catch (err) {
          console.error('Error rendering DOCX:', err);
          setError('Failed to render DOCX file.');
        } finally {
          setIsRendering(false);
        }
      };

      renderDocx();
    }
  }, [extension, fileData]);

  const handleDownload = () => {
    if (blobUrl) {
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-white dark:bg-zinc-900 rounded-2xl border">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-sm text-muted-foreground">Loading file...</p>
      </div>
    );
  }

  if (fetchError || error) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-white dark:bg-zinc-900 rounded-2xl border p-8 text-center">
        <FileWarning className="w-12 h-12 text-destructive mb-4 opacity-50" />
        <h3 className="text-lg font-semibold mb-2">Error Displaying File</h3>
        <p className="text-sm text-muted-foreground mb-6">
          {fetchError?.message || error || 'Something went wrong while loading the file.'}
        </p>
        <Button onClick={onClose} variant="outline">Close Panel</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#f8f8f7] dark:bg-[#1a1a1b] rounded-2xl border overflow-hidden shadow-lg">
      <AdaptiveHeader
        filename={filename}
        currentPage={currentPage}
        totalPages={totalPages}
        zoom={zoom}
        onDownload={handleDownload}
        onClose={onClose}
      />

      <div className="flex-1 overflow-hidden relative bg-zinc-100/50 dark:bg-zinc-900/50 p-4">
        {extension === 'pdf' && blobUrl ? (
          <iframe
            src={`/pdfjs/web/viewer.html?file=${encodeURIComponent(blobUrl)}`}
            className="w-full h-full border rounded-xl shadow-inner bg-white"
            title="PDF Viewer"
          />
        ) : (extension === 'docx' || extension === 'doc') ? (
          <div className="w-full h-full overflow-auto bg-white rounded-xl shadow-inner p-8 custom-docx-container">
            {isRendering && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10 transition-opacity">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            )}
            <div ref={containerRef} />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Preview not available for this file type ({extension}).
            </p>
            <Button onClick={handleDownload} variant="secondary" size="sm">
              Download {filename}
            </Button>
          </div>
        )}
      </div>
      
      <style jsx global>{`
        .custom-docx-container .docx-viewer {
          background: white !important;
          padding: 0 !important;
          margin: 0 auto !important;
          box-shadow: none !important;
        }
        .custom-docx-container section.docx {
          background: white !important;
          box-shadow: 0 0 10px rgba(0,0,0,0.05) !important;
          margin-bottom: 2rem !important;
        }
      `}</style>
    </div>
  );
};
