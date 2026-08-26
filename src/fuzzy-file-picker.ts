import * as vscode from "vscode";
import { AsyncFzf, asyncExtendedMatch } from "fzf";

const MAX_RESULTS = 200;

/**
 * A multi-select file picker with fzf-style fuzzy matching over the full path,
 * approximating the built-in Quick Open (Cmd+P). The standard quick pick can't
 * provide this: its filter matches label and description separately, so a
 * query spanning a directory and a file name matches nothing. Here every item
 * sets alwaysShow to bypass that filter and the ranking is computed with fzf.
 * Picked files stay picked (and visible) while the query changes.
 */
export function pickFilesByPath(paths: string[]): Promise<string[] | undefined> {
  // Extended match enables fzf's query syntax: space-separated terms are ANDed
  // (e.g. "system_test BUILD"), plus 'exact, ^prefix, suffix$, and !negation.
  // The v1 matcher scales linearly with the pattern length and keeps large
  // repositories responsive; v2 gives slightly better match positions.
  const fzf = new AsyncFzf(paths, {
    limit: MAX_RESULTS,
    fuzzy: paths.length > 20000 ? "v1" : "v2",
    match: asyncExtendedMatch,
  });
  const quickPick = vscode.window.createQuickPick();
  quickPick.canSelectMany = true;
  quickPick.placeholder = "Search Files by Path";

  const pickedPaths = new Set<string>();
  let applyingItems = false;
  let queryGeneration = 0;

  const applyItems = (matches: string[]) => {
    const matchSet = new Set(matches);
    const pinned = [...pickedPaths].filter((p) => !matchSet.has(p));
    applyingItems = true;
    quickPick.items = [...pinned, ...matches].map((p) => ({ label: p, alwaysShow: true }));
    quickPick.selectedItems = quickPick.items.filter((item) => pickedPaths.has(item.label));
    applyingItems = false;
  };

  const updateForQuery = async (query: string) => {
    const generation = ++queryGeneration;
    let matches: string[];
    if (query) {
      try {
        matches = (await fzf.find(query)).map((result) => result.item);
      } catch {
        // Superseded by a newer query.
        return;
      }
    } else {
      matches = paths.slice(0, MAX_RESULTS);
    }
    if (generation === queryGeneration) {
      applyItems(matches);
    }
  };

  return new Promise<string[] | undefined>((resolve) => {
    quickPick.onDidChangeValue((value) => void updateForQuery(value));
    quickPick.onDidChangeSelection((selection) => {
      if (applyingItems) {
        return;
      }
      pickedPaths.clear();
      for (const item of selection) {
        pickedPaths.add(item.label);
      }
    });
    quickPick.onDidAccept(() => {
      // Enter with nothing checked picks the focused item, like Quick Open.
      const result = pickedPaths.size > 0 ? [...pickedPaths] : quickPick.activeItems.map((item) => item.label);
      quickPick.hide();
      resolve(result);
    });
    quickPick.onDidHide(() => {
      quickPick.dispose();
      resolve(undefined);
    });
    void updateForQuery("");
    quickPick.show();
  });
}
