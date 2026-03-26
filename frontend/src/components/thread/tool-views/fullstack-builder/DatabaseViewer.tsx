// DatabaseViewer fetches data via secure backend endpoints (service role)
import React, { useState, useCallback } from 'react';
import {
  Database,
  Table2,
  RefreshCw,
  Loader2,
  ChevronRight,
  ExternalLink,
  Columns,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { backendApi } from '@/lib/api-client';
import { useFullstackBuilderStore } from '@/stores/use-fullstack-builder-store';

interface TableColumn {
  column_name: string;
  data_type: string;
  is_nullable: string;
}

interface TableRow {
  [key: string]: any;
}

interface TableMeta {
  name: string;
  schema: string;
  rowcount?: number;
}

interface DatabaseViewerProps {
  projectId?: string;
}

// Fetch tables via backend (uses service role key or project-specific DB)
async function fetchTables(sandboxId?: string): Promise<TableMeta[]> {
  const url = sandboxId ? `/github/db/tables?sandbox_id=${sandboxId}` : '/github/db/tables';
  const res = await backendApi.get<{ tables: string[] }>(url, { showErrors: false });
  if (res.error || !res.data) throw new Error(res.error?.message || 'Failed to load tables');
  return res.data.tables.map(name => ({ name, schema: 'public' }));
}

// Fetch rows from a table via backend
async function fetchTableData(
  tableName: string,
  page = 0,
  pageSize = 50,
  sandboxId?: string
): Promise<{ rows: TableRow[]; columns: string[]; count: number }> {
  const base = `/github/db/table/${encodeURIComponent(tableName)}`;
  const params = new URLSearchParams({
    page: page.toString(),
    page_size: pageSize.toString(),
  });
  if (sandboxId) params.append('sandbox_id', sandboxId);
  
  const res = await backendApi.get<{ rows: TableRow[]; columns: string[]; count: number }>(
    `${base}?${params.toString()}`,
    { showErrors: false }
  );
  if (res.error || !res.data) throw new Error(res.error?.message || 'Failed to load table data');
  return res.data;
}

export function DatabaseViewer({ projectId }: DatabaseViewerProps) {
  const { setPendingChatMessage } = useFullstackBuilderStore();
  const [tables, setTables] = useState<TableMeta[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [rows, setRows] = useState<TableRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [isLoadingTables, setIsLoadingTables] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  const PAGE_SIZE = 50;

  const loadTables = useCallback(async () => {
    setIsLoadingTables(true);
    setError(null);
    try {
      const result = await fetchTables(projectId);
      setTables(result);
      setHasFetched(true);
    } catch (e: any) {
      setError(e.message || 'Failed to load tables');
      setHasFetched(true);
    } finally {
      setIsLoadingTables(false);
    }
  }, [projectId]);

  const loadTableData = useCallback(async (tableName: string, page = 0) => {
    setIsLoadingData(true);
    setError(null);
    try {
      const { rows: r, columns: c, count } = await fetchTableData(tableName, page, PAGE_SIZE, projectId);
      setRows(r);
      setColumns(c);
      setTotalCount(count);
      setCurrentPage(page);
    } catch (e: any) {
      setError(e.message || 'Failed to load table data');
    } finally {
      setIsLoadingData(false);
    }
  }, [projectId]);

  const handleSelectTable = (name: string) => {
    setSelectedTable(name);
    loadTableData(name, 0);
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Empty / not-yet-fetched state
  if (!hasFetched) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8 space-y-5">
        <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center border border-border/40">
          <Database className="w-8 h-8 text-muted-foreground" />
        </div>
        <div className="space-y-2 max-w-xs">
          <h3 className="text-base font-semibold">No database yet</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Ask the agent in the chat to create a database for your project, then come back here to explore your data.
          </p>
          <div className="bg-muted/50 border border-border/40 rounded-lg px-4 py-2.5 mt-3 text-left">
            <p className="text-xs font-mono text-muted-foreground leading-relaxed">
              💬 &ldquo;Add a Supabase database to my project with a <strong>users</strong> and <strong>posts</strong> table&rdquo;
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="mt-2 gap-2 border-border/50 text-foreground/80 hover:text-primary hover:border-primary/40 transition-colors"
          onClick={() => {
            setPendingChatMessage('Add a Supabase database to my project. Create a users table and any other tables that make sense for this project.');
          }}
        >
          <Database className="w-3.5 h-3.5" />
          Ask Agent to add a Database
        </Button>
        <div className="w-px h-3 bg-border/30" />
        <Button
          size="sm"
          variant="ghost"
          className="mt-0 gap-2 text-muted-foreground/60 text-xs"
          onClick={loadTables}
          disabled={isLoadingTables}
        >
          {isLoadingTables ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          Check for tables
        </Button>
      </div>
    );
  }

  if (hasFetched && tables.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8 space-y-4">
        <div className="w-14 h-14 bg-muted rounded-2xl flex items-center justify-center border border-border/40">
          <Table2 className="w-7 h-7 text-muted-foreground" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-sm font-semibold">No tables found</h3>
          <p className="text-xs text-muted-foreground max-w-xs">
            Ask the agent to create your database schema. Once tables exist, they&apos;ll appear here.
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="gap-2 text-muted-foreground text-xs"
          onClick={loadTables}
          disabled={isLoadingTables}
        >
          {isLoadingTables ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Refresh
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Left Sidebar: Table list */}
      <div className="w-48 shrink-0 border-r border-border/40 bg-muted/10 flex flex-col">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/30 shrink-0">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tables</span>
          <button
            onClick={loadTables}
            className="hover:text-primary transition-colors text-muted-foreground"
            title="Refresh tables"
          >
            <RefreshCw className={cn('w-3 h-3', isLoadingTables && 'animate-spin')} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {isLoadingTables ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            tables.map(t => (
              <button
                key={t.name}
                onClick={() => handleSelectTable(t.name)}
                className={cn(
                  'w-full text-left flex items-center gap-2 px-3 py-1.5 text-xs transition-colors',
                  selectedTable === t.name
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-foreground/80 hover:bg-muted/50'
                )}
              >
                <Table2 className="w-3 h-3 shrink-0" />
                <span className="truncate">{t.name}</span>
              </button>
            ))
          )}
        </div>
        <div className="px-3 py-2 border-t border-border/30">
          <a
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="w-2.5 h-2.5" />
            Open Supabase
          </a>
        </div>
      </div>

      {/* Right: Data Grid */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Table Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border/30 bg-muted/10 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{selectedTable || 'Select a table'}</span>
            {selectedTable && totalCount > 0 && (
              <Badge variant="outline" className="text-[9px] h-4 px-1.5 font-mono">
                {totalCount.toLocaleString()} rows
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {selectedTable && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[10px] gap-1 text-muted-foreground"
                onClick={() => loadTableData(selectedTable, currentPage)}
                disabled={isLoadingData}
              >
                <RefreshCw className={cn('w-2.5 h-2.5', isLoadingData && 'animate-spin')} />
                Refresh
              </Button>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border-b border-red-100 text-xs text-red-600">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {error}
          </div>
        )}

        {/* No table selected */}
        {!selectedTable ? (
          <div className="flex flex-col items-center justify-center h-full text-sm text-muted-foreground gap-2">
            <Columns className="w-6 h-6" />
            Select a table from the sidebar
          </div>
        ) : isLoadingData ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-sm text-muted-foreground gap-2">
            <Table2 className="w-5 h-5" />
            No rows in this table
          </div>
        ) : (
          <>
            {/* Data Table */}
            <div className="flex-1 overflow-auto">
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 bg-muted/60 backdrop-blur z-10">
                  <tr>
                    <th className="text-left px-3 py-1.5 font-semibold text-muted-foreground border-b border-border/30 w-10 text-center text-[10px]">#</th>
                    {columns.map(col => (
                      <th
                        key={col}
                        className="text-left px-3 py-1.5 font-semibold text-muted-foreground border-b border-border/30 whitespace-nowrap text-[10px] uppercase tracking-wide"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr
                      key={idx}
                      className="border-b border-border/20 hover:bg-muted/30 transition-colors group"
                    >
                      <td className="px-3 py-1.5 text-muted-foreground text-center text-[10px] font-mono">
                        {currentPage * PAGE_SIZE + idx + 1}
                      </td>
                      {columns.map(col => {
                        const val = row[col];
                        const display =
                          val === null ? 'NULL' :
                          val === undefined ? '' :
                          typeof val === 'object' ? JSON.stringify(val) :
                          String(val);
                        const isNull = val === null;
                        return (
                          <td
                            key={col}
                            className="px-3 py-1.5 max-w-[200px] truncate"
                            title={display}
                          >
                            <span className={cn(isNull && 'text-muted-foreground italic text-[10px]')}>
                              {display}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-2 border-t border-border/30 bg-muted/10 shrink-0">
              <span className="text-[10px] text-muted-foreground">
                Showing {currentPage * PAGE_SIZE + 1}–{Math.min((currentPage + 1) * PAGE_SIZE, totalCount)} of {totalCount.toLocaleString()} rows
              </span>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-5 px-2 text-[10px]"
                  disabled={currentPage === 0 || isLoadingData}
                  onClick={() => loadTableData(selectedTable, currentPage - 1)}
                >
                  Prev
                </Button>
                <span className="text-[10px] text-muted-foreground px-1">
                  {currentPage + 1} / {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-5 px-2 text-[10px]"
                  disabled={currentPage + 1 >= totalPages || isLoadingData}
                  onClick={() => loadTableData(selectedTable, currentPage + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
