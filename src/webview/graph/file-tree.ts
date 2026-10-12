import type { ChangedFile } from "../../graph-protocol";

export interface FileTreeFolder {
  kind: "folder";
  /** Display name; merged single-child folder chains are joined with "/". */
  name: string;
  /** Repository-relative path of the deepest folder in the chain. */
  path: string;
  children: FileTreeNode[];
}

export interface FileTreeFile {
  kind: "file";
  name: string;
  file: ChangedFile;
}

export type FileTreeNode = FileTreeFolder | FileTreeFile;

interface MutableFolder {
  folders: Map<string, MutableFolder>;
  files: FileTreeFile[];
}

function compareNames(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function toNodes(folder: MutableFolder, parentPath: string): FileTreeNode[] {
  const folders: FileTreeFolder[] = [...folder.folders.entries()]
    .sort(([a], [b]) => compareNames(a, b))
    .map(([name, child]) => {
      let mergedName = name;
      let current = child;
      while (current.files.length === 0 && current.folders.size === 1) {
        const [nextName, next] = current.folders.entries().next().value!;
        mergedName = `${mergedName}/${nextName}`;
        current = next;
      }
      const path = parentPath ? `${parentPath}/${mergedName}` : mergedName;
      return { kind: "folder", name: mergedName, path, children: toNodes(current, path) };
    });
  const files = [...folder.files].sort((a, b) => compareNames(a.name, b.name));
  return [...folders, ...files];
}

/**
 * Groups changed files into a directory tree, merging chains of folders that contain only a
 * single subfolder (like VS Code's compact folders). Folders sort before files at each level.
 */
export function buildFileTree(files: ChangedFile[]): FileTreeNode[] {
  const root: MutableFolder = { folders: new Map(), files: [] };
  for (const file of files) {
    const segments = file.path.split("/");
    const name = segments.pop()!;
    let folder = root;
    for (const segment of segments) {
      let next = folder.folders.get(segment);
      if (!next) {
        next = { folders: new Map(), files: [] };
        folder.folders.set(segment, next);
      }
      folder = next;
    }
    folder.files.push({ kind: "file", name, file });
  }
  return toNodes(root, "");
}
