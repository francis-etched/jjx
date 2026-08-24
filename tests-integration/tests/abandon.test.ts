import { test, expect } from "./base-test";
import { getParents } from "../test-repo";
import { changeIdFromLogEntry, formatChangeIdShort, maxChangeIdPrefixLength } from "../../src/utils.js";

test("abandon single change via context menu", async ({ graphFrame, testRepo, workbox }) => {
  await testRepo.commitFile("a.txt", "content a", "A");
  await testRepo.commitFile("b.txt", "content b", "Second commit");
  await testRepo.commitFile("c.txt", "content c", "C");

  const entries = await testRepo.log();
  const changeB = entries.find((e) => e.description.trim() === "Second commit")!;
  const changeBShort = formatChangeIdShort(
    changeIdFromLogEntry(changeB, maxChangeIdPrefixLength(entries.map((e) => e.change_id_shortest))),
  );

  const nodes = graphFrame.locator("#nodes > div");
  await expect(nodes).toHaveCount(5);

  const commitB = nodes.nth(2);
  await commitB.click({ button: "right" });

  const abandonItem = graphFrame.locator('[data-action="abandon"]');
  await expect(abandonItem).toBeVisible();
  await abandonItem.click();

  const dialog = workbox.locator(".monaco-dialog-box");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(`Are you sure you want to abandon change "${changeBShort}"?`);
  await expect(dialog).toContainText("→ Second commit");

  await workbox.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();

  await expect(nodes).toHaveCount(5);

  await expect(async () => {
    const logEntries = await testRepo.log();
    expect(logEntries.find((e) => e.description.trim() === "Second commit")).toBeDefined();
    expect(getParents(logEntries, "C")).toEqual(["Second commit"]);
  }).toPass();

  await commitB.click({ button: "right" });
  await expect(abandonItem).toBeVisible();
  await abandonItem.click();
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(`Are you sure you want to abandon change "${changeBShort}"?`);
  await expect(dialog).toContainText("→ Second commit");

  await dialog.getByRole("button", { name: "Abandon" }).click();

  await expect(dialog).not.toBeVisible();

  await expect(nodes).toHaveCount(4);

  await expect(async () => {
    const logEntries = await testRepo.log();
    expect(logEntries.find((e) => e.description.trim() === "Second commit")).toBeUndefined();
    expect(getParents(logEntries, "C")).toEqual(["A"]);
  }).toPass();
});

test("abandon an empty, undescribed change without confirmation", async ({ graphFrame, testRepo, workbox }) => {
  await testRepo.commitFile("a.txt", "content a", "A");
  // An empty, undescribed change between A and C: nothing to lose, one parent,
  // one child, so abandoning it should not prompt.
  await testRepo.jjCommand(["new", "-m", ""]);
  await testRepo.commitFile("c.txt", "content c", "C");

  const nodes = graphFrame.locator("#nodes > div");
  await expect(nodes).toHaveCount(5);

  // Nodes are newest first: working copy, C, the empty change, A, root.
  const emptyChange = nodes.nth(2);
  await emptyChange.click({ button: "right" });

  const abandonItem = graphFrame.locator('[data-action="abandon"]');
  await expect(abandonItem).toBeVisible();
  await abandonItem.click();

  await expect(workbox.locator(".monaco-dialog-box")).not.toBeVisible();
  await expect(nodes).toHaveCount(4);

  await expect(async () => {
    expect(getParents(await testRepo.log(), "C")).toEqual(["A"]);
  }).toPass();
});

test("confirm before abandoning an empty change with several children", async ({ graphFrame, testRepo, workbox }) => {
  await testRepo.commitFile("a.txt", "content a", "A");
  // An empty, undescribed fork point with two children. `jj commit` would
  // extend the branch linearly, so build each child with an explicit parent.
  await testRepo.jjCommand(["new", "-m", ""]);
  const forkPoint = (await testRepo.log("@"))[0].change_id;
  await testRepo.jjCommand(["new", forkPoint, "-m", "B"]);
  await testRepo.writeFile("b.txt", "content b");
  await testRepo.jjCommand(["new", forkPoint, "-m", "C"]);
  await testRepo.writeFile("c.txt", "content c");
  expect(await testRepo.log(`children(${forkPoint})`)).toHaveLength(2);

  const nodes = graphFrame.locator("#nodes > div");
  // Wait for the graph to settle before interacting, so the working-copy
  // snapshot cannot re-render it mid-click.
  await expect(nodes).toHaveCount(6);

  const abandonItem = graphFrame.locator('[data-action="abandon"]');
  const dialog = workbox.locator(".monaco-dialog-box");

  // The fork point is empty and undescribed, but abandoning it rebases two
  // children, so the confirmation stays. Newest first: C, B, the fork point,
  // the change left behind by committing A, A, root.
  const forkNode = nodes.nth(2);
  await forkNode.click({ button: "right" });
  await expect(abandonItem).toBeVisible();
  await abandonItem.click();

  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("(no description set)");
});

test("abandon multiple selected changes via context menu", async ({ graphFrame, testRepo, workbox }) => {
  await testRepo.commitFile("a.txt", "content a", "A");
  await testRepo.commitFile("b.txt", "content b", "B");
  await testRepo.commitFile("c.txt", "content c", "C");

  const nodes = graphFrame.locator("#nodes > div");
  await expect(nodes).toHaveCount(5);

  const commitB = nodes.nth(2);
  const commitC = nodes.nth(1);

  await commitB.click({ modifiers: ["Shift"] });
  await commitC.click({ modifiers: ["Shift"] });

  await commitC.click({ button: "right" });

  const abandonSelected = graphFrame.locator('[data-action="abandonSelected"]');
  await expect(abandonSelected).toBeVisible();
  await abandonSelected.click();

  const dialog = workbox.locator(".monaco-dialog-box");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Are you sure you want to abandon 2 changes?");

  await dialog.getByRole("button", { name: "Abandon" }).click();

  await expect(nodes).toHaveCount(3);

  await expect(async () => {
    const logEntries = await testRepo.log();
    expect(logEntries.find((e) => e.description.trim() === "B")).toBeUndefined();
    expect(logEntries.find((e) => e.description.trim() === "C")).toBeUndefined();
    expect(getParents(logEntries, "@")).toEqual(["A"]);
  }).toPass();
});
