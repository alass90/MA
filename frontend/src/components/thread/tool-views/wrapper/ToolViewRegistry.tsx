import React, { useMemo } from 'react';
import { ToolViewProps } from '../types';
import { GenericToolView } from '../GenericToolView';
import { BrowserToolView } from '../BrowserToolView';
import { CommandToolView } from '../command-tool/CommandToolView';
import { CheckCommandOutputToolView } from '../command-tool/CheckCommandOutputToolView';
import { FileOperationToolView } from '../file-operation/FileOperationToolView';
import { StrReplaceToolView } from '../str-replace/StrReplaceToolView';
import { WebCrawlToolView } from '../WebCrawlToolView';
import { WebScrapeToolView } from '../web-scrape-tool/WebScrapeToolView';
import { WebSearchToolView } from '../web-search-tool/WebSearchToolView';
import { PeopleSearchToolView } from '../people-search-tool/PeopleSearchToolView';
import { CompanySearchToolView } from '../company-search-tool/CompanySearchToolView';
import { DocumentParserToolView } from '../document-parser-tool/DocumentParserToolView';
import { SeeImageToolView } from '../see-image-tool/SeeImageToolView';
import { TaskListToolView } from '../task-list/TaskListToolView';
import { ListPresentationTemplatesToolView } from '../presentation-tools/ListPresentationTemplatesToolView';
import { PresentationViewer } from '../presentation-tools/PresentationViewer';
import { ListPresentationsToolView } from '../presentation-tools/ListPresentationsToolView';
import { DeleteSlideToolView } from '../presentation-tools/DeleteSlideToolView';
import { DeletePresentationToolView } from '../presentation-tools/DeletePresentationToolView';
// import { PresentationStylesToolView } from '../presentation-tools/PresentationStylesToolView';
import { ExportToPptxToolView, ExportToPdfToolView } from '../presentation-tools/ExportToolView';
import { SheetsToolView } from '../sheets-tools/sheets-tool-view';
import { GetProjectStructureView } from '../web-dev/GetProjectStructureView';
import { ImageEditGenerateToolView } from '../image-edit-generate-tool/ImageEditGenerateToolView';
import { UploadFileToolView } from '../UploadFileToolView';
import { DocsToolView, ListDocumentsToolView, DeleteDocumentToolView } from '../docs-tool';
import { createPresentationViewerToolContent, parsePresentationSlidePath } from '../utils/presentation-utils';
import { KbToolView } from '../KbToolView';


export type ToolViewComponent = React.ComponentType<ToolViewProps>;

type ToolViewRegistryType = Record<string, ToolViewComponent>;

const defaultRegistry: ToolViewRegistryType = {
  'browser-navigate-to': BrowserToolView,
  'browser-act': BrowserToolView,
  'browser-extract-content': BrowserToolView,
  'browser-screenshot': BrowserToolView,

  'execute-command': CommandToolView,
  'check-command-output': CheckCommandOutputToolView,
  'terminate-command': GenericToolView,
  'list-commands': GenericToolView,

  'create-file': FileOperationToolView,
  'delete-file': FileOperationToolView,
  'full-file-rewrite': FileOperationToolView,
  'read-file': FileOperationToolView,
  'edit-file': FileOperationToolView,

  'parse-document': DocumentParserToolView,

  'str-replace': StrReplaceToolView,

  'web-search': WebSearchToolView,
  'people-search': PeopleSearchToolView,
  'company-search': CompanySearchToolView,
  'crawl-webpage': WebCrawlToolView,
  'scrape-webpage': WebScrapeToolView,
  'image-search': WebSearchToolView,

  'execute-data-provider-call': GenericToolView,
  'get-data-provider-endpoints': GenericToolView,

  'search-mcp-servers': GenericToolView,
  'get-app-details': GenericToolView,
  'create-credential-profile': GenericToolView,
  'connect-credential-profile': GenericToolView,
  'check-profile-connection': GenericToolView,
  'configure-profile-for-agent': GenericToolView,
  'get-credential-profiles': GenericToolView,
  'get-current-agent-config': GenericToolView,
  'create-tasks': TaskListToolView,
  'view-tasks': TaskListToolView,
  'update-tasks': TaskListToolView,
  'delete-tasks': TaskListToolView,
  'clear-all': TaskListToolView,


  'expose-port': GenericToolView,

  'load-image': SeeImageToolView,
  'clear-images-from-context': SeeImageToolView,
  'image-edit-or-generate': ImageEditGenerateToolView,
  'designer-create-or-edit': GenericToolView,
  'designer_create_or_edit': GenericToolView,

  'wait': GenericToolView,
  'expand_message': GenericToolView,
  'expand-message': GenericToolView,


  'list-templates': ListPresentationTemplatesToolView,
  'load-template-design': ListPresentationTemplatesToolView,

  // New per-slide presentation tools
  'create-slide': PresentationViewer,
  'list-slides': PresentationViewer,
  'list-presentations': ListPresentationsToolView,
  'delete-slide': DeleteSlideToolView,
  'delete-presentation': DeletePresentationToolView,
  'validate-slide': PresentationViewer,
  // 'presentation-styles': PresentationStylesToolView,
  'export-to-pptx': ExportToPptxToolView,
  'export-to-pdf': ExportToPdfToolView,

  'create-sheet': SheetsToolView,
  'update-sheet': SheetsToolView,
  'view-sheet': SheetsToolView,
  'analyze-sheet': SheetsToolView,
  'visualize-sheet': SheetsToolView,
  'format-sheet': SheetsToolView,

  'get-project-structure': GetProjectStructureView,
  'list-web-projects': GenericToolView,

  'upload-file': UploadFileToolView,

  // Knowledge Base tools
  'init_kb': KbToolView,
  'init-kb': KbToolView,
  'search_files': KbToolView,
  'search-files': KbToolView,
  'ls_kb': KbToolView,
  'ls-kb': KbToolView,
  'cleanup_kb': KbToolView,
  'cleanup-kb': KbToolView,
  'global_kb_sync': KbToolView,
  'global-kb-sync': KbToolView,
  'global_kb_create_folder': KbToolView,
  'global-kb-create-folder': KbToolView,
  'global_kb_upload_file': KbToolView,
  'global-kb-upload-file': KbToolView,
  'global_kb_list_contents': KbToolView,
  'global-kb-list-contents': KbToolView,
  'global_kb_delete_item': KbToolView,
  'global-kb-delete-item': KbToolView,
  'global_kb_enable_item': KbToolView,
  'global-kb-enable-item': KbToolView,

  // Document operations - using specific views for different operations
  'create-document': DocsToolView,
  'update-document': DocsToolView,
  'read-document': DocsToolView,
  'list-documents': ListDocumentsToolView,
  'delete-document': DeleteDocumentToolView,
  'export-document': DocsToolView,
  'create_document': DocsToolView,
  'update_document': DocsToolView,
  'read_document': DocsToolView,
  'list_documents': ListDocumentsToolView,
  'delete_document': DeleteDocumentToolView,
  'export_document': DocsToolView,
  'get_tiptap_format_guide': DocsToolView,

  'default': GenericToolView,

  'create-new-agent': GenericToolView,
  'update-agent': GenericToolView,
  'search-mcp-servers-for-agent': GenericToolView,
  'create-credential-profile-for-agent': GenericToolView,
  'discover-mcp-tools-for-agent': GenericToolView,
  'discover-user-mcp-servers': GenericToolView,
  'list-app-event-triggers': GenericToolView,
  'create-event-trigger': GenericToolView,
  'configure-agent-integration': GenericToolView,
  'create-agent-scheduled-trigger': GenericToolView,

  'make_phone_call': GenericToolView,
  'make-phone-call': GenericToolView,
  'end_call': GenericToolView,
  'end-call': GenericToolView,
  'get_call_details': GenericToolView,
  'get-call-details': GenericToolView,
  'list_calls': GenericToolView,
  'list-calls': GenericToolView,
  'monitor_call': GenericToolView,
  'monitor-call': GenericToolView,
  'wait_for_call_completion': GenericToolView,
  'wait-for-call-completion': GenericToolView,
};

class ToolViewRegistry {
  private registry: ToolViewRegistryType;
  constructor(initialRegistry: Partial<ToolViewRegistryType> = {}) {
    this.registry = { ...defaultRegistry };
    Object.entries(initialRegistry).forEach(([key, value]) => {
      if (value !== undefined) {
        this.registry[key] = value;
      }
    });
  }

  register(toolName: string, component: ToolViewComponent): void {
    this.registry[toolName] = component;
  }

  registerMany(components: Partial<ToolViewRegistryType>): void {
    Object.assign(this.registry, components);
  }

  get(toolName: string): ToolViewComponent {
    return this.registry[toolName] || this.registry['default'];
  }

  has(toolName: string): boolean {
    return toolName in this.registry;
  }

  getToolNames(): string[] {
    return Object.keys(this.registry).filter(key => key !== 'default');
  }

  clear(): void {
    this.registry = { default: this.registry['default'] };
  }
}

export const toolViewRegistry = new ToolViewRegistry();

export function useToolView(toolName: string): ToolViewComponent {
  return useMemo(() => toolViewRegistry.get(toolName), [toolName]);
}



export function ToolView({ toolCall, toolResult, ...props }: ToolViewProps) {
  // Extract tool name from function_name (handle undefined case)
  const name = toolCall?.function_name?.replace(/_/g, '-').toLowerCase() || 'default';

  // Get file path directly from tool call arguments (from metadata)
  const filePath = toolCall?.arguments?.file_path || toolCall?.arguments?.target_file;

  // check if the file path is a presentation slide
  const { isValid: isPresentationSlide, presentationName, slideNumber } = parsePresentationSlidePath(filePath);

  // define presentation-related tools that shouldn't be transformed
  const presentationTools = [
    'create-slide',
    'list-slides',
    'delete-slide',
    'delete-presentation',
    'validate-slide',
    // 'presentation-styles',
  ]

  const isAlreadyPresentationTool = presentationTools.includes(name);

  // determine the effective tool name (must be computed before hook call)
  const effectiveToolName = (isPresentationSlide && !isAlreadyPresentationTool) ? 'create-slide' : name;

  // use the tool view component - hook must be called unconditionally
  const ToolViewComponent = useToolView(effectiveToolName);

  // Defensive check - ensure toolCall is defined
  if (!toolCall || !toolCall.function_name) {
    console.warn('ToolView: toolCall is undefined or missing function_name. Tool views should use structured props.');
    // Fallback to GenericToolView with error handling
    return <GenericToolView toolCall={toolCall} toolResult={toolResult} {...props} />;
  }

  // if the file path is a presentation slide, we need to modify the tool result to match the expected structure for PresentationViewer
  let modifiedToolResult = toolResult;
  if (isPresentationSlide && filePath && presentationName && slideNumber && !isAlreadyPresentationTool && toolResult) {
    const viewerContent = createPresentationViewerToolContent(presentationName, filePath, slideNumber);
    modifiedToolResult = {
      ...toolResult,
      output: viewerContent,
    };
  }

  return <ToolViewComponent toolCall={toolCall} toolResult={modifiedToolResult} {...props} />;
}