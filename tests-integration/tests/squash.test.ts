import { test, expect, handleEditor } from "./base-test";

test("squash commit into another via drag and drop", async ({ graphFrame, testRepo, workbox }) => {
  await testRepo.commitFile("a.txt", "content a", "A");
  await testRepo.commitFile("b.txt", "content b", "B");

  const nodes = graphFrame.locator("#nodes > div");
  await expect(nodes).toHaveCount(4);

  const commitB = nodes.nth(1);
  const commitA = nodes.nth(2);

  await commitB.dragTo(commitA);

  const squashIntoItem = graphFrame.locator('[data-action="squashInto"]');
  await expect(squashIntoItem).toBeVisible();
  await squashIntoItem.click();

  await handleEditor(workbox, "", "squashed");

  await expect(nodes).toHaveCount(3);

  await expect(async () => {
    const logEntries = await testRepo.log();
    const commitBEntry = logEntries.find((e) => e.description.trim() === "B");
    expect(commitBEntry).toBeUndefined();

    const squashedEntry = logEntries.find((e) => e.description.trim() === "squashed");
    expect(squashedEntry).toBeDefined();
  }).toPass();

  const diffResult = await testRepo.jjCommand(["diff", "--name-only", "-r", "@-"]);
  expect(diffResult.stdout).toBe("a.txt\nb.txt\n");
});

test.describe("with showChangedFiles enabled", () => {
  test.use({ customSettings: { "jjx.showChangedFiles": true } });

  test("squash a single file into another commit via drag and drop", async ({ graphFrame, testRepo }) => {
    await testRepo.commitFile("a.txt", "content a", "A");
    await testRepo.writeFile("b.txt", "content b");
    await testRepo.writeFile("c.txt", "content c");
    await testRepo.commit("B");

    const nodes = graphFrame.locator("#nodes > div");
    await expect(nodes).toHaveCount(4);

    const bFile = graphFrame.locator('[data-role="changed-file"][data-path="b.txt"]');
    await expect(bFile).toBeVisible();

    const commitA = nodes.nth(2);
    await bFile.dragTo(commitA);

    // The file squash runs directly on drop; no rebase menu should open.
    await expect(graphFrame.locator('[data-action="squashInto"]')).toHaveCount(0);

    await expect(async () => {
      const logEntries = await testRepo.log();
      const commitAEntry = logEntries.find((e) => e.description.trim() === "A");
      const commitBEntry = logEntries.find((e) => e.description.trim() === "B");
      expect(commitAEntry).toBeDefined();
      expect(commitBEntry).toBeDefined();
      const diffA = await testRepo.jjCommand(["diff", "--name-only", "-r", commitAEntry!.change_id]);
      expect(diffA.stdout).toBe("a.txt\nb.txt\n");
      const diffB = await testRepo.jjCommand(["diff", "--name-only", "-r", commitBEntry!.change_id]);
      expect(diffB.stdout).toBe("c.txt\n");
    }).toPass();
  });
});
