import React from 'react';
import { PdfHeader } from './PdfHeader';
import { DocxHeader } from './DocxHeader';
import { DefaultHeader } from './DefaultHeader';

interface AdaptiveHeaderProps {
  filename: string;
  currentPage: number;
  totalPages: number;
  zoom?: number;
  onDownload?: () => void;
  onClose?: () => void;
  onMail?: () => void;
}

export const AdaptiveHeader: React.FC<AdaptiveHeaderProps> = (props) => {
  const extension = props.filename.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'pdf':
      return <PdfHeader {...props} />;
    case 'docx':
    case 'doc':
      return <DocxHeader {...props} />;
    default:
      return <DefaultHeader {...props} />;
  }
};
