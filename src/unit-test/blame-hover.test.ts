/* eslint-disable @typescript-eslint/no-floating-promises */
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { buildBlameHoverMarkdown, escapeMarkdown, BLAME_HOVER_COMMANDS } from "../blame-hover";
import type { ChangeWithDetails } from "../types";
import { fullChangeIdFromString } from "../utils";

const NOW = new Date("2025-06-15T12:00:00Z").getTime();
let originalDateNow: typeof Date.now;

beforeEach(() => {
  originalDateNow = Date.now;
  Date.now = () => NOW;
});

afterEach(() => {
  Date.now = originalDateNow;
});

const DOCUMENT_URI = "file:///repo/src/foo.ts";

function makeChange(overrides: Partial<ChangeWithDetails> = {}): ChangeWithDetails {
  return {
    changeId: {
      changeId: fullChangeIdFromString("qpvuntsmwlqtpsluzzzzzzzzzzzzzzzz"),
      changeIdPrefix: "qpvu",
      changeIdSuffix: "ntsm",
      changeOffset: null,
    },
    commitId: "1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b",
    description: "Fix null pointer in payment processor",
    isEmpty: false,
    isConflict: false,
    author: { name: "Test Author", email: "author@example.com" },
    authoredDate: "2025-06-12T09:30:00Z",
    ...overrides,
  };
}

describe("escapeMarkdown", () => {
  it("escapes markdown punctuation", () => {
    assert.equal(escapeMarkdown("[link](url)"), "\\[link\\]\\(url\\)");
    assert.equal(escapeMarkdown("*bold* `code`"), "\\*bold\\* \\`code\\`");
  });

  it("turns newlines into hard line breaks", () => {
    assert.equal(escapeMarkdown("a\nb"), "a  \nb");
  });
});

describe("buildBlameHoverMarkdown", () => {
  it("shows author, relative time, and description", () => {
    const markdown = buildBlameHoverMarkdown(makeChange(), DOCUMENT_URI);
    assert.match(markdown, /\*\*Test Author\*\* \(author@example\\\.com\), 3 days ago \(/);
    assert.ok(markdown.includes("Fix null pointer in payment processor"));
  });

  it("shows the short change ID and short commit ID", () => {
    const markdown = buildBlameHoverMarkdown(makeChange(), DOCUMENT_URI);
    assert.ok(markdown.includes("`qpvuntsm`"));
    assert.ok(markdown.includes("`1a2b3c4d`"));
  });

  it("falls back to (no description)", () => {
    const markdown = buildBlameHoverMarkdown(makeChange({ description: "" }), DOCUMENT_URI);
    assert.ok(markdown.includes("(no description)"));
  });

  it("links every enabled command with JSON-encoded arguments", () => {
    const markdown = buildBlameHoverMarkdown(makeChange(), DOCUMENT_URI);
    for (const command of BLAME_HOVER_COMMANDS) {
      assert.ok(markdown.includes(`](command:${command}?`), `missing link for ${command}`);
    }
    const showDiffArgs = encodeURIComponent(JSON.stringify([DOCUMENT_URI, "qpvuntsmwlqtpsluzzzzzzzzzzzzzzzz"]));
    assert.ok(markdown.includes(`command:jj.blameShowDiff?${showDiffArgs}`));
    const copyCommitArgs = encodeURIComponent(JSON.stringify(["1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b"]));
    assert.ok(markdown.includes(`command:jj.blameCopyText?${copyCommitArgs}`));
  });

  it("does not let commit descriptions inject command links", () => {
    const markdown = buildBlameHoverMarkdown(
      makeChange({ description: "[click me](command:workbench.action.terminal.new)" }),
      DOCUMENT_URI,
    );
    assert.ok(!markdown.includes("](command:workbench"));
  });

  it("keeps multi-line descriptions as hard line breaks", () => {
    const markdown = buildBlameHoverMarkdown(makeChange({ description: "First line\n\nBody line" }), DOCUMENT_URI);
    assert.ok(markdown.includes("First line  \n  \nBody line"));
  });

  it("shows divergent, conflict, and empty badges", () => {
    const markdown = buildBlameHoverMarkdown(
      makeChange({ divergent: true, isConflict: true, isEmpty: true }),
      DOCUMENT_URI,
    );
    assert.ok(markdown.includes("*(divergent, conflict, empty)*"));
  });

  it("appends the divergence offset to the displayed change ID", () => {
    const markdown = buildBlameHoverMarkdown(
      makeChange({
        changeId: {
          changeId: fullChangeIdFromString("qpvuntsmwlqtpsluzzzzzzzzzzzzzzzz/2"),
          changeIdPrefix: "qpvu",
          changeIdSuffix: "ntsm",
          changeOffset: "2",
        },
      }),
      DOCUMENT_URI,
    );
    assert.ok(markdown.includes("`qpvuntsm/2`"));
  });
});
