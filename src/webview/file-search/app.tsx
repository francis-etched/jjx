import type { ComponentChildren } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { signal } from "@preact/signals";
import type {
  FileSearchExtensionToWebviewMessage,
  FileSearchWebviewToExtensionMessage,
  FileSearchResult,
} from "../../file-search-protocol";

interface VSCodeAPI {
  postMessage(message: unknown): void;
}

declare function acquireVsCodeApi(): VSCodeAPI;

let vscode: VSCodeAPI;

export function initVsCodeApi() {
  vscode = acquireVsCodeApi();
}

function postMessage(message: FileSearchWebviewToExtensionMessage): void {
  vscode.postMessage(message);
}

const query = signal("");
const results = signal<FileSearchResult[]>([]);
const searchedFiles = signal<string[]>([]);
const activeIndex = signal(0);

let latestRequestId = 0;

function sendSearch(value: string) {
  latestRequestId++;
  postMessage({ command: "search", query: value, requestId: latestRequestId });
}

/** Renders `text` with the fzf match positions (indices into the full path) highlighted. */
function highlighted(text: string, positions: Set<number>, offset: number): ComponentChildren[] {
  const parts: ComponentChildren[] = [];
  let run = "";
  let runHighlighted = false;
  const flush = () => {
    if (run) {
      parts.push(runHighlighted ? <span class="match">{run}</span> : run);
      run = "";
    }
  };
  for (let i = 0; i < text.length; i++) {
    const isHighlighted = positions.has(offset + i);
    if (isHighlighted !== runHighlighted) {
      flush();
      runHighlighted = isHighlighted;
    }
    run += text[i];
  }
  flush();
  return parts;
}

function FileLabel({ path, positions }: { path: string; positions: Set<number> }) {
  const slash = path.lastIndexOf("/");
  const dir = slash === -1 ? "" : path.slice(0, slash);
  const base = slash === -1 ? path : path.slice(slash + 1);
  return (
    <>
      <span class="codicon codicon-file file-icon"></span>
      <span class="file-name">{highlighted(base, positions, slash + 1)}</span>
      {dir && <span class="file-dir">{highlighted(dir, positions, 0)}</span>}
    </>
  );
}

const noPositions = new Set<number>();

export function App() {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    window.addEventListener("message", (event) => {
      const message = event.data as FileSearchExtensionToWebviewMessage;
      switch (message.command) {
        case "searchResults":
          if (message.requestId === latestRequestId) {
            results.value = message.results;
            activeIndex.value = 0;
          }
          break;
        case "searchedFiles":
          searchedFiles.value = message.paths;
          break;
      }
    });
    window.addEventListener("focus", () => inputRef.current?.focus());
    postMessage({ command: "webviewReady" });
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!query.value) {
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const count = results.value.length;
      if (count > 0) {
        const delta = e.key === "ArrowDown" ? 1 : -1;
        activeIndex.value = (activeIndex.value + delta + count) % count;
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      const active = results.value[activeIndex.value];
      if (active) {
        postMessage({ command: "toggleFile", path: active.path });
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      query.value = "";
      results.value = [];
    }
  };

  const searching = query.value.length > 0;
  const searchedSet = new Set(searchedFiles.value);

  return (
    <div class="file-search">
      <input
        ref={inputRef}
        type="text"
        placeholder="Search Files by Path"
        value={query.value}
        onInput={(e) => {
          const value = (e.target as HTMLInputElement).value;
          query.value = value;
          sendSearch(value);
        }}
        onKeyDown={handleKeyDown}
      />
      {searching ? (
        <div class="list">
          {results.value.map((result, index) => (
            <div
              key={result.path}
              class={`row${index === activeIndex.value ? " active" : ""}`}
              title={searchedSet.has(result.path) ? "Remove from Search" : "Add to Search"}
              onMouseMove={() => (activeIndex.value = index)}
              onClick={() => postMessage({ command: "toggleFile", path: result.path })}
            >
              <FileLabel path={result.path} positions={new Set(result.positions)} />
              {searchedSet.has(result.path) && <span class="codicon codicon-check row-check"></span>}
            </div>
          ))}
          {results.value.length === 0 && <div class="hint">No matching tracked files.</div>}
        </div>
      ) : (
        <div class="list">
          {searchedFiles.value.map((path) => (
            <div key={path} class="row" title="Open File" onClick={() => postMessage({ command: "openFile", path })}>
              <FileLabel path={path} positions={noPositions} />
              <span
                class="codicon codicon-close row-remove"
                title="Remove from Search"
                onClick={(e) => {
                  e.stopPropagation();
                  postMessage({ command: "removeFile", path });
                }}
              ></span>
            </div>
          ))}
          {searchedFiles.value.length === 0 && (
            <div class="hint">
              Commits touching the searched files are highlighted in the JJ Graph. Type above to search the tracked
              files, or right-click files in the Source Control view.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
