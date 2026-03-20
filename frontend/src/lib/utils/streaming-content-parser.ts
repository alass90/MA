/**
 * Robustly extracts partial string values from a streaming JSON string.
 */
export interface StreamingFileContent {
  filePath: string | null;
  fileContent: string | null;
  operation: 'create' | 'rewrite' | 'edit' | 'delete' | null;
}

export function parseStreamingFileContent(streamingText: string): StreamingFileContent {
  const result: StreamingFileContent = {
    filePath: null,
    fileContent: null,
    operation: null,
  };

  if (!streamingText) return result;

  try {
    // Try parsing as complete JSON first
    const parsed = JSON.parse(streamingText);
    
    // Detect operation
    if (parsed.file_contents || parsed.target_file) {
      result.operation = 'create';
      result.fileContent = parsed.file_contents || null;
    } else if (parsed.code_edit) {
      result.operation = 'edit';
      result.fileContent = parsed.code_edit || null;
    }

    result.filePath = parsed.file_path || parsed.target_file || parsed.path || null;
    
    return result;
  } catch (e) {
    // JSON incomplete - use regex-based extraction
    
    // 1. Extract file_path
    const pathMatch = streamingText.match(/"file_path"\s*:\s*"([^"]+)"/);
    const targetMatch = streamingText.match(/"target_file"\s*:\s*"([^"]+)"/);
    result.filePath = pathMatch ? pathMatch[1] : (targetMatch ? targetMatch[1] : null);

    // 2. Detect operation and extract content
    const createMatch = streamingText.match(/"file_contents"\s*:\s*"/);
    const editMatch = streamingText.match(/"code_edit"\s*:\s*"/);

    if (createMatch) {
      result.operation = 'create';
      result.fileContent = extractIncompleteString(streamingText, createMatch.index! + createMatch[0].length);
    } else if (editMatch) {
      result.operation = 'edit';
      result.fileContent = extractIncompleteString(streamingText, editMatch.index! + editMatch[0].length);
    }

    return result;
  }
}

/**
 * Extracts a string from the current position until an unescaped double quote or end of text.
 */
function extractIncompleteString(text: string, startIndex: number): string {
  let rawContent = text.substring(startIndex);

  // Find the end quote (ignoring escaped ones)
  const endQuoteMatch = rawContent.match(/(?<!\\)"/);
  if (endQuoteMatch) {
    rawContent = rawContent.substring(0, endQuoteMatch.index);
  }

  // Unescape common JSON sequences
  try {
    return JSON.parse('"' + rawContent + '"');
  } catch {
    return rawContent
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\r/g, '\r')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }
}
