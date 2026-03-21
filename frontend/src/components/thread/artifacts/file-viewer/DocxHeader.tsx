import React from 'react';
import { FileText, Download, X, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DocxHeaderProps {
  filename: string;
  currentPage: number;
  totalPages: number;
  onDownload?: () => void;
  onClose?: () => void;
  onMail?: () => void;
}

export const DocxHeader: React.FC<DocxHeaderProps> = ({
  filename,
  currentPage,
  totalPages,
  onDownload,
  onClose,
  onMail,
}) => {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white border-b shadow-sm rounded-t-2xl">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 bg-blue-600 rounded-xl">
          <FileText className="w-6 h-6 text-white" />
        </div>
        <span className="text-sm font-semibold text-zinc-900 truncate max-w-[250px]">
          {filename}
        </span>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 text-[11px] font-bold text-zinc-400 tracking-wider">
          <span>PAGE</span>
          <span className="text-zinc-900">{currentPage}</span>
          <span>SUR</span>
          <span>{totalPages}</span>
        </div>

        <div className="h-4 w-[1px] bg-zinc-200" />

        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-zinc-500"
            onClick={onMail}
          >
            <Mail className="h-4 w-4" />
          </Button>
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
    </div>
  );
};
