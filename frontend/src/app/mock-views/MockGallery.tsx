'use client';

import React from 'react';
import { toolViewRegistry } from '@/components/thread/tool-views/wrapper/ToolViewRegistry';
import { ToolCallData, ToolResultData } from '@/components/thread/tool-views/types';

const MOCK_DATA: Record<string, { call: ToolCallData; result: ToolResultData }> = {
  'browser-navigate-to': {
    call: { tool_call_id: '1', function_name: 'browser_navigate_to', arguments: { url: 'https://github.com/alass90/MA' }, source: 'native' },
    result: { success: true, output: 'Navigated successfully to https://github.com/alass90/MA' }
  },
  'execute-command': {
    call: { tool_call_id: '2', function_name: 'execute_command', arguments: { command: 'npm run build && npm run start' }, source: 'native' },
    result: { success: true, output: '> build\n> next build\n\ninfo  - Compiled successfully\ninfo  - Collecting page data  ..' }
  },
  'check-command-output': {
    call: { tool_call_id: '2b', function_name: 'check_command_output', arguments: { command_id: 'cmd_123' }, source: 'native' },
    result: { success: true, output: 'stdout: Server running on port 3000\nstderr: (none)' }
  },
  'terminate-command': {
    call: { tool_call_id: '2c', function_name: 'terminate_command', arguments: { command_id: 'cmd_123' }, source: 'native' },
    result: { success: true, output: 'Command cmd_123 terminated.' }
  },
  'create-file': {
    call: { tool_call_id: '3', function_name: 'create_file', arguments: { file_path: 'src/components/MyNewComponent.tsx', code_content: 'export default function MyNewComponent() {\n  return <div>Hello World</div>;\n}' }, source: 'native' },
    result: { success: true, output: 'File created successfully at src/components/MyNewComponent.tsx' }
  },
  'full-file-rewrite': {
    call: { tool_call_id: '3b', function_name: 'full_file_rewrite', arguments: { file_path: 'src/pages/index.tsx', new_content: 'export default function Home() { return <main>Rewritten!</main>; }' }, source: 'native' },
    result: { success: true, output: 'File src/pages/index.tsx rewritten successfully.' }
  },
  'read-file': {
    call: { tool_call_id: '3c', function_name: 'read_file', arguments: { file_path: 'src/lib/utils.ts' }, source: 'native' },
    result: { success: true, output: 'import { clsx } from "clsx";\nexport function cn(...inputs) { return clsx(inputs); }' }
  },
  'delete-file': {
    call: { tool_call_id: '3d', function_name: 'delete_file', arguments: { file_path: 'src/old/legacy.ts' }, source: 'native' },
    result: { success: true, output: 'File src/old/legacy.ts deleted successfully.' }
  },
  'str-replace': {
    call: { tool_call_id: '6', function_name: 'str_replace', arguments: { file_path: 'page.tsx', target_content: 'const a = 1;', replacement_content: 'const a = 42;' }, source: 'native' },
    result: { success: true, output: 'Replaced 1 occurrence(s) in page.tsx' }
  },
  'web-search': {
    call: { tool_call_id: '4', function_name: 'web_search', arguments: { query: 'Next.js 14 server actions best practices' }, source: 'native' },
    result: { success: true, output: JSON.stringify([
      { title: 'Next.js 14 Release Notes', url: 'https://nextjs.org/blog/next-14', snippet: 'Server Actions are now stable in Next.js 14...' },
      { title: 'How to use Server Actions', url: 'https://www.youtube.com/watch?v=abc', snippet: 'Learn the new features of Next.js 14 including server actions' },
      { title: 'Server Actions Deep Dive', url: 'https://dev.to/article', snippet: 'A comprehensive guide to using server actions with Next.js' }
    ]) }
  },
  'scrape-webpage': {
    call: { tool_call_id: '5', function_name: 'scrape_webpage', arguments: { url: 'https://news.ycombinator.com' }, source: 'native' },
    result: { success: true, output: '# Hacker News\n1. Show HN: Talos AI is launched (243 points)\n2. Ask HN: What are your favorite Next.js tools? (120 points)' }
  },
  'crawl-webpage': {
    call: { tool_call_id: '5b', function_name: 'crawl_webpage', arguments: { url: 'https://docs.example.com', max_depth: 2 }, source: 'native' },
    result: { success: true, output: 'Crawled 15 pages. Extracted 23,400 tokens of content.' }
  },
  'expose-port': {
    call: { tool_call_id: '8', function_name: 'expose_port', arguments: { port: 3000 }, source: 'native' },
    result: { success: true, output: 'Port 3000 exposed at https://sandbox-abc123.preview.talos.ai' }
  },
  'create-tasks': {
    call: { tool_call_id: '9', function_name: 'create_tasks', arguments: { tasks: [{ title: 'Setup DB', status: 'todo' }, { title: 'Build API', status: 'todo' }, { title: 'Create UI', status: 'todo' }] }, source: 'native' },
    result: { success: true, output: JSON.stringify({ tasks: [{ id: '1', title: 'Setup DB', status: 'todo' }, { id: '2', title: 'Build API', status: 'in_progress' }, { id: '3', title: 'Create UI', status: 'done' }] }) }
  },
  'wait': {
    call: { tool_call_id: '10', function_name: 'wait', arguments: { seconds: 5 }, source: 'native' },
    result: { success: true, output: 'Waited 5 seconds.' }
  },
  'load-image': {
    call: { tool_call_id: '11', function_name: 'load_image', arguments: { file_path: '/sandbox/screenshot.png' }, source: 'native' },
    result: { success: true, output: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' }
  },
  'execute-data-provider-call': {
    call: { tool_call_id: '12', function_name: 'execute_data_provider_call', arguments: { service_name: 'supabase', route: '/rest/v1/users' }, source: 'native' },
    result: { success: true, output: JSON.stringify([{ id: 1, email: 'user@example.com' }, { id: 2, email: 'admin@example.com' }]) }
  },
  'get-data-provider-endpoints': {
    call: { tool_call_id: '12b', function_name: 'get_data_provider_endpoints', arguments: { service_name: 'stripe' }, source: 'native' },
    result: { success: true, output: JSON.stringify([{ path: '/v1/charges', method: 'GET' }, { path: '/v1/customers', method: 'GET' }]) }
  },
  'make-phone-call': {
    call: { tool_call_id: '13', function_name: 'make_phone_call', arguments: { phone_number: '+1-555-123-4567', message: 'Hello! This is an automated call from Talos.' }, source: 'native' },
    result: { success: true, output: JSON.stringify({ call_id: 'call_abc123', status: 'initiated', duration: 0 }) }
  },
  'end-call': {
    call: { tool_call_id: '13b', function_name: 'end_call', arguments: { call_id: 'call_abc123' }, source: 'native' },
    result: { success: true, output: JSON.stringify({ call_id: 'call_abc123', status: 'ended', duration: 45 }) }
  },
  'get-call-details': {
    call: { tool_call_id: '13c', function_name: 'get_call_details', arguments: { call_id: 'call_abc123' }, source: 'native' },
    result: { success: true, output: JSON.stringify({ call_id: 'call_abc123', status: 'completed', duration: 45, transcript: 'Hello! This is a test call.' }) }
  },
  'list-calls': {
    call: { tool_call_id: '13d', function_name: 'list_calls', arguments: {}, source: 'native' },
    result: { success: true, output: JSON.stringify([{ call_id: 'call_abc123', status: 'completed', duration: 45 }, { call_id: 'call_def456', status: 'missed', duration: 0 }]) }
  },
  'upload-file': {
    call: { tool_call_id: '14', function_name: 'upload_file', arguments: { file_name: 'report.pdf', destination: '/uploads/reports/' }, source: 'native' },
    result: { success: true, output: 'File report.pdf uploaded to /uploads/reports/report.pdf' }
  },
  'create-sheet': {
    call: { tool_call_id: '15', function_name: 'create_sheet', arguments: { title: 'Revenue Q1 2025', columns: ['Month', 'Revenue', 'Expenses'] }, source: 'native' },
    result: { success: true, output: JSON.stringify({ sheet_id: 'sheet_xyz', title: 'Revenue Q1 2025', rows: [['January', '50000', '30000'], ['February', '62000', '28000']] }) }
  },
};

export function MockGallery() {
  const toolNames = toolViewRegistry.getToolNames();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-8 text-zinc-900 dark:text-zinc-100 font-sans">
      <div className="max-w-7xl mx-auto space-y-10">

        <header className="space-y-3">
          <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-600">
            ToolCallSidePanel — Galerie des Vues
          </h1>
          <p className="text-base text-zinc-500 dark:text-zinc-400 max-w-3xl">
            Aperçu de tous les composants enregistrés dans le <code className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-sm">ToolViewRegistry</code> avec des données simulées.
            Total : <strong>{toolNames.length} vues</strong>
          </p>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {toolNames.map((toolName) => {
            const ToolViewComponent = toolViewRegistry.get(toolName);

            const mockData = MOCK_DATA[toolName] || {
              call: {
                tool_call_id: `mock_${toolName}`,
                function_name: toolName.replace(/-/g, '_'),
                arguments: { query: 'example query', path: '/test/example.ts', param: 'sample value' },
                source: 'native' as const
              },
              result: {
                success: true,
                output: JSON.stringify({ 
                  message: `Mock output for tool: ${toolName}`, 
                  items: [], 
                  data: null,
                  presentations: [],
                  files: [],
                  tasks: [],
                  calls: [],
                  results: [],
                  templates: []
                })
              }
            };

            return (
              <div key={toolName} className="flex flex-col border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm bg-white dark:bg-zinc-900 hover:shadow-md transition-shadow">

                {/* Tool name label */}
                <div className="bg-zinc-100 dark:bg-zinc-800/80 border-b border-zinc-200 dark:border-zinc-700 px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                    <h3 className="font-mono font-bold text-sm text-zinc-700 dark:text-zinc-300 tracking-tight">
                      {toolName}
                    </h3>
                  </div>
                  <span className="text-xs text-zinc-400 dark:text-zinc-500 font-mono">
                    {'<ToolView />'}
                  </span>
                </div>

                {/* View container */}
                <div className="flex-1 overflow-hidden bg-zinc-50 dark:bg-zinc-950/50">
                  <div className="h-[320px] flex flex-col overflow-auto">
                    <ToolViewComponent
                      toolCall={mockData.call}
                      toolResult={mockData.result}
                      isSuccess={true}
                      isStreaming={false}
                      currentIndex={0}
                      totalCalls={1}
                      agentStatus="idle"
                    />
                  </div>
                </div>

              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
