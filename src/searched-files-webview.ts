import * as vscode from "vscode";
import * as fs from "fs";
import { joinRepositoryPath, toWorkspaceUri } from "./workspace-paths";
import { AsyncFzf, asyncExtendedMatch } from "fzf";
import type { JJGraphWebview } from "./graph-webview";
import type { FileSearchExtensionToWebviewMessage, FileSearchWebviewToExtensionMessage } from "./file-search-protocol";
import { logger } from "./logger";

const MAX_RESULTS = 50;

/**
 * The "JJ File Search" view: a fuzzy file finder over the tracked files whose
 * picks drive the graph highlight. The matching runs here in the extension
 * host with fzf (extended match: space-separated terms are ANDed) and the
 * match positions are sent to the webview, which renders them Quick Open
 * style — something the native quick pick cannot do for custom matchers.
 */
export class SearchedFilesWebview implements vscode.WebviewViewProvider {
  subscriptions: {
    dispose(): unknown;
  }[] = [];
  private panel?: vscode.WebviewView;
  private fzf: AsyncFzf<string[]> | undefined;
  private fzfRepoRoot: string | undefined;
  private fzfStale = true;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly graphWebview: JJGraphWebview,
    context: vscode.ExtensionContext,
  ) {
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider("jjSearchedFiles", this, {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
      }),
    );
    this.subscriptions.push(
      graphWebview.onDidChangeSearchedFiles(() => {
        this.postSearchedFiles();
        this.updateBadge();
      }),
    );
  }

  /** Marks the tracked-file list as outdated so the next search re-reads it. */
  invalidateFileList() {
    this.fzfStale = true;
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.panel = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };
    webviewView.webview.html = this.getWebviewContent(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (message: FileSearchWebviewToExtensionMessage) => {
      switch (message.command) {
        case "webviewReady":
          this.postSearchedFiles();
          this.updateBadge();
          break;
        case "search":
          await this.handleSearch(message.query, message.requestId);
          break;
        case "toggleFile": {
          const searched = this.graphWebview.getSearchedFiles().some((f) => f.path === message.path);
          if (searched) {
            this.graphWebview.removeSearchedFile(message.path);
          } else {
            this.graphWebview.addSearchedFiles([message.path]);
          }
          break;
        }
        case "removeFile":
          this.graphWebview.removeSearchedFile(message.path);
          break;
        case "clearFiles":
          this.graphWebview.clearSearchedFiles();
          break;
        case "openFile": {
          const repoRoot = this.graphWebview.repository?.repositoryRoot;
          if (repoRoot) {
            void vscode.commands.executeCommand(
              "vscode.open",
              toWorkspaceUri(joinRepositoryPath(repoRoot, message.path)),
            );
          }
          break;
        }
      }
    });
  }

  private async handleSearch(query: string, requestId: number): Promise<void> {
    if (!query) {
      this.postMessage({ command: "searchResults", requestId, results: [] });
      return;
    }
    let fzf: AsyncFzf<string[]>;
    try {
      fzf = await this.getFzf();
    } catch (error) {
      logger.warn(
        `File search failed to list tracked files: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.postMessage({ command: "searchResults", requestId, results: [] });
      return;
    }
    try {
      const matches = await fzf.find(query);
      this.postMessage({
        command: "searchResults",
        requestId,
        results: matches.map((m) => ({ path: m.item, positions: Array.from(m.positions).sort((a, b) => a - b) })),
      });
    } catch {
      // Superseded by a newer query.
    }
  }

  private async getFzf(): Promise<AsyncFzf<string[]>> {
    const repo = this.graphWebview.repository;
    if (!repo) {
      throw new Error("No repository selected");
    }
    if (!this.fzf || this.fzfStale || this.fzfRepoRoot !== repo.repositoryRoot) {
      const paths = (await repo.fileList()).map((f) => f.replace(/\\/g, "/"));
      this.fzf = new AsyncFzf(paths, {
        limit: MAX_RESULTS,
        // The v1 matcher scales linearly with the pattern length and keeps
        // large repositories responsive; v2 gives slightly better positions.
        fuzzy: paths.length > 20000 ? "v1" : "v2",
        match: asyncExtendedMatch,
      });
      this.fzfRepoRoot = repo.repositoryRoot;
      this.fzfStale = false;
    }
    return this.fzf;
  }

  private postSearchedFiles() {
    this.postMessage({
      command: "searchedFiles",
      paths: this.graphWebview.getSearchedFiles().map((f) => f.path),
    });
  }

  private updateBadge() {
    if (!this.panel) {
      return;
    }
    const count = this.graphWebview.getSearchedFiles().length;
    this.panel.badge =
      count > 0 ? { value: count, tooltip: `${count} searched file${count === 1 ? "" : "s"}` } : undefined;
  }

  private postMessage(message: FileSearchExtensionToWebviewMessage) {
    void this.panel?.webview.postMessage(message);
  }

  private getWebviewContent(webview: vscode.Webview) {
    const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "dist", "webview", "file-search.css"));
    const codiconUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "dist", "codicons", "codicon.css"));
    const jsUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "dist", "webview", "file-search.js"));

    const htmlPath = vscode.Uri.joinPath(this.extensionUri, "dist", "webview", "file-search.html");
    let html = fs.readFileSync(htmlPath.fsPath, "utf8");
    html = html.replace("${cssUri}", cssUri.toString());
    html = html.replace("${codiconUri}", codiconUri.toString());
    html = html.replace("${fileSearchJsUri}", jsUri.toString());
    return html;
  }

  dispose() {
    this.subscriptions.forEach((s) => s.dispose());
  }
}
