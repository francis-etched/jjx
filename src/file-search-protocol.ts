/** One fuzzy match: the file path and the character indices matched by the query. */
export interface FileSearchResult {
  path: string;
  positions: number[];
}

export type FileSearchWebviewToExtensionMessage =
  | { command: "webviewReady" }
  | { command: "search"; query: string; requestId: number }
  | { command: "toggleFile"; path: string }
  | { command: "removeFile"; path: string }
  | { command: "clearFiles" }
  | { command: "openFile"; path: string };

export type FileSearchExtensionToWebviewMessage =
  | { command: "searchResults"; requestId: number; results: FileSearchResult[] }
  | { command: "searchedFiles"; paths: string[] };
