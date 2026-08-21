/* eslint-disable @typescript-eslint/no-floating-promises */
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { buildBlameHoverBody, buildBlameHoverActions, escapeMarkdown, BLAME_HOVER_COMMANDS } from "../blame-hover";
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

describe("buildBlameHoverBody", () => {
  it("shows author, relative time, and description", () => {
    const body = buildBlameHoverBody(makeChange());
    assert.match(body, /\*\*Test Author\*\* \(author@example\\\.com\), 3 days ago \(/);
    assert.ok(body.includes("Fix null pointer in payment processor"));
  });

  it("escapes markdown in the author name", () => {
    const body = buildBlameHoverBody(makeChange({ author: { name: "*Evil*", email: "e@example.com" } }));
    assert.ok(body.includes("**\\*Evil\\***"));
  });

  it("keeps the description as verbatim markdown", () => {
    const description = "Refactor activate() into:\n\n- extensionState.ts: shared state\n- commands.ts: registrations";
    const body = buildBlameHoverBody(makeChange({ description }));
    assert.ok(body.includes(description));
  });

  it("does not build command links itself (it must be rendered untrusted)", () => {
    const body = buildBlameHoverBody(makeChange());
    assert.ok(!body.includes("command:"));
  });

  it("falls back to (no description)", () => {
    const body = buildBlameHoverBody(makeChange({ description: "" }));
    assert.ok(body.includes("*(no description)*"));
  });
});

describe("buildBlameHoverActions", () => {
  it("shows the short change ID and short commit ID", () => {
    const actions = buildBlameHoverActions(makeChange(), DOCUMENT_URI);
    assert.ok(actions.includes("`qpvuntsm`"));
    assert.ok(actions.includes("`1a2b3c4d`"));
  });

  it("links every enabled command with JSON-encoded arguments", () => {
    const actions = buildBlameHoverActions(makeChange(), DOCUMENT_URI);
    for (const command of BLAME_HOVER_COMMANDS) {
      assert.ok(actions.includes(`](command:${command}?`), `missing link for ${command}`);
    }
    const showDiffArgs = encodeURIComponent(JSON.stringify([DOCUMENT_URI, "qpvuntsmwlqtpsluzzzzzzzzzzzzzzzz"]));
    assert.ok(actions.includes(`command:jj.blameShowDiff?${showDiffArgs}`));
    const copyCommitArgs = encodeURIComponent(JSON.stringify(["1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b"]));
    assert.ok(actions.includes(`command:jj.blameCopyText?${copyCommitArgs}`));
  });

  it("shows divergent, conflict, and empty badges", () => {
    const actions = buildBlameHoverActions(
      makeChange({ divergent: true, isConflict: true, isEmpty: true }),
      DOCUMENT_URI,
    );
    assert.ok(actions.includes("*(divergent, conflict, empty)*"));
  });

  it("appends the divergence offset to the displayed change ID", () => {
    const actions = buildBlameHoverActions(
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
    assert.ok(actions.includes("`qpvuntsm/2`"));
  });
});
