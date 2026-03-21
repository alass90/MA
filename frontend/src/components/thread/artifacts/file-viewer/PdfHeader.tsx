import React from 'react';
import { FileText, Minus, Plus, Download, X, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PdfHeaderProps {
  filename: string;
  currentPage: number;
  totalPages: number;
  zoom?: number;
  onPageChange?: (page: number) => void;
  onZoomChange?: (zoom: number) => void;
  onDownload?: () => void;
  onClose?: () => void;
}

export const PdfHeader: React.FC<PdfHeaderProps> = ({
  filename,
  currentPage,
  totalPages,
  zoom = 100,
  onDownload,
  onClose,
}) => {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white border-b shadow-sm rounded-t-2xl">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 bg-red-500 rounded-xl">
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
          <span>/</span>
          <span>{totalPages}</span>
        </div>

        <div className="h-4 w-[1px] bg-zinc-200" />

        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500">
            <Minus className="h-4 w-4" />
          </Button>
          <span className="text-xs font-semibold text-zinc-500 min-w-[36px] text-center">
            {zoom}%
          </span>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2 ml-2">
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
