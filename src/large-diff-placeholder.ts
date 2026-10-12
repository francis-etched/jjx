import path from "path";
import * as vscode from "vscode";
import { getParams, toJJUri, type JJUriParams } from "./uri";
import type { MultiDiffResource } from "./source-control";

export const OPEN_LARGE_DIFF_COMMAND = "jj.openLargeDiff";

const LINK_TEXT = "Open Diff in Its Own Editor";

type LargeDiffParams = Extract<JJUriParams, { largeDiffOriginal: string }>;

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

/**
 * Replaces both sides of a multi-diff entry whose diff is too large with identical placeholder
 * documents, so the file stays listed without VS Code computing its diff. The placeholders carry
 * the real sides, which the link in their text opens in a regular diff editor.
 */
export function toLargeDiffPlaceholder(resource: MultiDiffResource, title: string, bytes: number): MultiDiffResource {
  const [label, original, modified] = resource;
  const params = {
    largeDiffOriginal: original.toString(),
    largeDiffModified: modified.toString(),
    largeDiffTitle: `${path.basename(label.fsPath)} (${title})`,
    largeDiffBytes: bytes,
  };
  return [label, toJJUri(label, { ...params, side: "left" }), toJJUri(label, { ...params, side: "right" })];
}

export function getLargeDiffParams(uri: vscode.Uri): LargeDiffParams | undefined {
  if (uri.scheme !== "jj" || uri.query === "") {
    return undefined;
  }
  try {
    const params = getParams(uri);
    return "largeDiffOriginal" in params ? params : undefined;
  } catch {
    return undefined;
  }
}

export function largeDiffPlaceholderText(uri: vscode.Uri, params: LargeDiffParams): string {
  return [
    `The diff of ${path.basename(uri.fsPath)} (${formatSize(params.largeDiffBytes)}) is too large to show here.`,
    LINK_TEXT,
    "",
  ].join("\n");
}

/**
 * Turns the link line of a large-diff placeholder into a link that opens the real diff.
 */
export class LargeDiffLinkProvider implements vscode.DocumentLinkProvider {
  provideDocumentLinks(document: vscode.TextDocument): vscode.DocumentLink[] {
    if (!getLargeDiffParams(document.uri)) {
      return [];
    }
    for (let line = 0; line < document.lineCount; line++) {
      const column = document.lineAt(line).text.indexOf(LINK_TEXT);
      if (column !== -1) {
        const args = encodeURIComponent(JSON.stringify([document.uri.toString()]));
        const link = new vscode.DocumentLink(
          new vscode.Range(line, column, line, column + LINK_TEXT.length),
          vscode.Uri.parse(`command:${OPEN_LARGE_DIFF_COMMAND}?${args}`),
        );
        link.tooltip = "Open the full diff of this file";
        return [link];
      }
    }
    return [];
  }
}

export async function openLargeDiff(placeholderUri: string): Promise<void> {
  const params = getLargeDiffParams(vscode.Uri.parse(placeholderUri));
  if (!params) {
    return;
  }
  await vscode.commands.executeCommand(
    "vscode.diff",
    vscode.Uri.parse(params.largeDiffOriginal),
    vscode.Uri.parse(params.largeDiffModified),
    params.largeDiffTitle,
  );
}
