import type { ChangeWithDetails } from "./types";
import { formatChangeIdShort } from "./utils";
import { relativeTime } from "./relative-time";

/**
 * The only commands the blame hover's MarkdownString may execute.
 * Pass this as `isTrusted: { enabledCommands: BLAME_HOVER_COMMANDS }`.
 */
export const BLAME_HOVER_COMMANDS = [
  "jj.blameShowDiff",
  "jj.blameOpenFileAtRevision",
  "jj.blameCopyText",
  "jj.blameCopyCommitUrl",
];

const absoluteTimeFormatter = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

/**
 * Escapes commit-controlled text so it renders literally: without this, a commit
 * description containing e.g. `[x](command:...)` would become a clickable link
 * in the trusted hover markdown.
 */
export function escapeMarkdown(text: string): string {
  return text.replace(/[\\`*_{}[\]()<>#+\-.!|~]/g, "\\$&").replaceAll("\n", "  \n");
}

function commandLink(label: string, command: string, args: unknown[], tooltip: string): string {
  return `[${label}](command:${command}?${encodeURIComponent(JSON.stringify(args))} "${tooltip}")`;
}

/**
 * Builds the markdown shown when hovering the inline blame annotation.
 * Pure function (no vscode imports) so it stays unit-testable; the caller wraps
 * the result in a MarkdownString with the commands above enabled.
 */
export function buildBlameHoverMarkdown(change: ChangeWithDetails, documentUri: string): string {
  const changeIdFull = change.changeId.changeId;
  const changeIdShort = formatChangeIdShort(change.changeId);
  const commitIdShort = change.commitId.substring(0, 8);

  const authoredDate = new Date(change.authoredDate);
  const when = `${relativeTime(change.authoredDate)} (${absoluteTimeFormatter.format(authoredDate)})`;
  const author = `**${escapeMarkdown(change.author.name)}** (${escapeMarkdown(change.author.email)})`;

  const trimmedDescription = change.description.trim();
  const description = trimmedDescription ? escapeMarkdown(trimmedDescription) : "*(no description)*";

  const badges = [
    ...(change.divergent ? ["divergent"] : []),
    ...(change.isConflict ? ["conflict"] : []),
    ...(change.isEmpty ? ["empty"] : []),
  ];
  const badgeText = badges.length > 0 ? ` *(${badges.join(", ")})*` : "";

  const actions = [
    commandLink("Show Diff", "jj.blameShowDiff", [documentUri, changeIdFull], "Compare this change against its parent"),
    commandLink(
      "Open File",
      "jj.blameOpenFileAtRevision",
      [documentUri, changeIdFull, changeIdShort],
      `Open the file as it was at ${changeIdShort}`,
    ),
    commandLink("Copy Change ID", "jj.blameCopyText", [changeIdFull], "Copy the full change ID"),
    commandLink("Copy Commit ID", "jj.blameCopyText", [change.commitId], "Copy the full commit ID"),
    commandLink("Copy Web URL", "jj.blameCopyCommitUrl", [documentUri, changeIdFull], "Copy a link to this commit"),
  ];

  return [
    `${author}, ${when}`,
    description,
    "---",
    `\`${changeIdShort}\` • \`${commitIdShort}\`${badgeText}`,
    actions.join(" | "),
  ].join("\n\n");
}
