import React from 'react';
import { File, Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DefaultHeaderProps {
  filename: string;
  onDownload?: () => void;
  onClose?: () => void;
}

export const DefaultHeader: React.FC<DefaultHeaderProps> = ({
  filename,
  onDownload,
  onClose,
}) => {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white border-b shadow-sm rounded-t-2xl">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
          <File className="w-6 h-6 text-zinc-500" />
        </div>
        <span className="text-sm font-semibold text-zinc-900 truncate max-w-[250px]">
          {filename}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 text-zinc-500"
          onClick={onDownload}
        >
          <Download className="h-4 w-4" />
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 text-zinc-500"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
