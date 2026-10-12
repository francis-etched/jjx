/* eslint-disable @typescript-eslint/no-floating-promises */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildFileTree, type FileTreeNode } from "../webview/graph/file-tree";
import type { ChangedFile } from "../graph-protocol";

function file(path: string): ChangedFile {
  return { type: "M", path, conflict: false };
}

type Shape = string | { folder: string; path: string; children: Shape[] };

function shape(nodes: FileTreeNode[]): Shape[] {
  return nodes.map((node) =>
    node.kind === "file" ? node.name : { folder: node.name, path: node.path, children: shape(node.children) },
  );
}

describe("buildFileTree", () => {
  it("keeps root-level files at the top level", () => {
    assert.deepEqual(shape(buildFileTree([file("b.txt"), file("a.txt")])), ["a.txt", "b.txt"]);
  });

  it("merges single-child folder chains", () => {
    const tree = buildFileTree([
      file("host/system_test/BUILD"),
      file("host/system_test/test_configs/suite_configs/rack/L11/L11_ready_to_serve.yaml"),
      file("host/system_test/test_configs/suite_configs/rack/L11/L11_tests.yaml"),
      file("host/system_test/tests/rack/L11/BUILD"),
      file("host/system_test/tests/rack/L11/host_identity_rack.py"),
    ]);
    assert.deepEqual(shape(tree), [
      {
        folder: "host/system_test",
        path: "host/system_test",
        children: [
          {
            folder: "test_configs/suite_configs/rack/L11",
            path: "host/system_test/test_configs/suite_configs/rack/L11",
            children: ["L11_ready_to_serve.yaml", "L11_tests.yaml"],
          },
          {
            folder: "tests/rack/L11",
            path: "host/system_test/tests/rack/L11",
            children: ["BUILD", "host_identity_rack.py"],
          },
          "BUILD",
        ],
      },
    ]);
  });

  it("does not merge a folder that also contains files", () => {
    const tree = buildFileTree([file("a/x.txt"), file("a/b/y.txt")]);
    assert.deepEqual(shape(tree), [
      { folder: "a", path: "a", children: [{ folder: "b", path: "a/b", children: ["y.txt"] }, "x.txt"] },
    ]);
  });

  it("sorts folders before files, each by name", () => {
    const tree = buildFileTree([file("z.txt"), file("b/1.txt"), file("a.txt"), file("a/2.txt")]);
    assert.deepEqual(shape(tree), [
      { folder: "a", path: "a", children: ["2.txt"] },
      { folder: "b", path: "b", children: ["1.txt"] },
      "a.txt",
      "z.txt",
    ]);
  });

  it("keeps the original file entry on each leaf", () => {
    const renamed: ChangedFile = { type: "R", path: "dir/new.txt", renamedFrom: "dir/old.txt", conflict: true };
    const [folder] = buildFileTree([renamed]);
    assert.equal(folder.kind, "folder");
    assert.equal(folder.kind === "folder" && folder.children[0].kind === "file" && folder.children[0].file, renamed);
  });
});
