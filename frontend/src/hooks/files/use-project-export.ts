import { useState, useCallback } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { listSandboxFiles, getSandboxFileContent } from '@/lib/api/sandbox';
import { toast } from 'sonner';

export function useProjectExport(sandboxId: string | undefined) {
  const [isExporting, setIsExporting] = useState(false);

  const exportAsZip = useCallback(async (projectName: string = 'project') => {
    if (!sandboxId) {
      toast.error('No sandbox available for export');
      return;
    }

    setIsExporting(true);
    const zip = new JSZip();

    try {
      toast.info('Preparing your files for download...');

      // Recursive function to add folder contents to ZIP
      const addFolderToZip = async (path: string, currentZip: JSZip) => {
        const files = await listSandboxFiles(sandboxId, path);
        
        for (const file of files) {
          if (file.is_dir) {
            const folderZip = currentZip.folder(file.name);
            if (folderZip) {
              await addFolderToZip(file.path, folderZip);
            }
          } else {
            // Ignore common node_modules and other large/unnecessary artifacts if they exist
            if (file.path.includes('node_modules') || file.path.includes('.next')) continue;
            
            try {
              const content = await getSandboxFileContent(sandboxId, file.path);
              if (content instanceof Blob) {
                currentZip.file(file.name, content);
              } else if (typeof content === 'string') {
                currentZip.file(file.name, content);
              } else {
                currentZip.file(file.name, JSON.stringify(content, null, 2));
              }
            } catch (err) {
              console.error(`Failed to download file ${file.path}:`, err);
            }
          }
        }
      };

      // Start from root
      await addFolderToZip('', zip);

      const blob = await zip.generateAsync({ type: 'blob' });
      saveAs(blob, `${projectName}.zip`);
      toast.success('Project downloaded successfully!');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export project');
    } finally {
      setIsExporting(false);
    }
  }, [sandboxId]);

  return { exportAsZip, isExporting };
}
