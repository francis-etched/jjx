import * as vscode from "vscode";
import path from "path";
import type { JJGraphWebview } from "./graph-webview";

/**
 * The "JJ File Search" view: lists the files whose touching commits are
 * highlighted in the graph. Entries come from clicking files in the SCM view
 * (which replaces the list) or from the view's Add File action; each entry can
 * be removed individually and the whole list can be cleared.
 */
export class SearchedFilesManager {
  subscriptions: {
    dispose(): unknown;
  }[] = [];
  treeView: vscode.TreeView<SearchedFileTreeItem>;

  constructor(private graphWebview: JJGraphWebview) {
    const treeDataProvider = new SearchedFilesTreeDataProvider(graphWebview);
    this.treeView = vscode.window.createTreeView<SearchedFileTreeItem>("jjSearchedFiles", {
      treeDataProvider,
    });
    this.subscriptions.push(this.treeView);
    this.subscriptions.push(
      graphWebview.onDidChangeSearchedFiles(() => {
        treeDataProvider.refresh();
        this.updateBadge();
      }),
    );
    this.updateBadge();
  }

  private updateBadge() {
    const count = this.graphWebview.getSearchedFiles().length;
    this.treeView.badge =
      count > 0 ? { value: count, tooltip: `${count} searched file${count === 1 ? "" : "s"}` } : undefined;
  }

  dispose() {
    this.subscriptions.forEach((s) => s.dispose());
  }
}

export class SearchedFileTreeItem extends vscode.TreeItem {
  constructor(
    public readonly relPath: string,
    repositoryRoot: string,
  ) {
    super(vscode.Uri.file(path.join(repositoryRoot, relPath)));
    this.id = relPath;
    this.description = path.dirname(relPath) === "." ? undefined : path.dirname(relPath);
    this.tooltip = relPath;
    this.contextValue = "searchedFile";
    this.command = {
      title: "Open File",
      command: "vscode.open",
      arguments: [this.resourceUri],
    };
  }
}

class SearchedFilesTreeDataProvider implements vscode.TreeDataProvider<SearchedFileTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  onDidChangeTreeData: vscode.Event<void> = this._onDidChangeTreeData.event;

  constructor(private graphWebview: JJGraphWebview) {}

  getTreeItem(element: SearchedFileTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): SearchedFileTreeItem[] {
    const repositoryRoot = this.graphWebview.repository?.repositoryRoot;
    if (!repositoryRoot) {
      return [];
    }
    return this.graphWebview.getSearchedFiles().map((f) => new SearchedFileTreeItem(f.path, repositoryRoot));
  }

  refresh() {
    this._onDidChangeTreeData.fire();
  }
}
