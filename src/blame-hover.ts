import type { ChangeWithDetails } from "./types";
import { formatChangeIdShort } from "./utils";
import { relativeTime } from "./relative-time";

/**
 * The only commands the blame hover's trusted MarkdownString may execute.
 * Pass this as `isTrusted: { enabledCommands: BLAME_HOVER_COMMANDS }`.
 */
export const BLAME_HOVER_COMMANDS = [
  "jj.blameShowDiff",
  "jj.blameOpenFileAtRevision",
  "jj.blameCopyText",
  "jj.blameCopyCommitUrl",
];

const absoluteTimeFormatter = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

/** Escapes text that should render literally rather than as markdown. */
export function escapeMarkdown(text: string): string {
  return text.replace(/[\\`*_{}[\]()<>#+\-.!|~]/g, "\\$&").replaceAll("\n", "  \n");
}

function commandLink(label: string, command: string, args: unknown[], tooltip: string): string {
  return `[${label}](command:${command}?${encodeURIComponent(JSON.stringify(args))} "${tooltip}")`;
}

/**
 * The author/date header plus the commit description. The description is
 * rendered as markdown (lists, links, emphasis), so the caller MUST wrap this
 * in a NON-trusted MarkdownString: in a trusted one, a description containing
 * `[label](command:...)` would become a clickable command link.
 */
export function buildBlameHoverBody(change: ChangeWithDetails): string {
  const authoredDate = new Date(change.authoredDate);
  const when = `${relativeTime(change.authoredDate)} (${absoluteTimeFormatter.format(authoredDate)})`;
  const author = `**${escapeMarkdown(change.author.name)}** (${escapeMarkdown(change.author.email)})`;

  const description = change.description.trim() || "*(no description)*";

  return `${author}, ${when}\n\n${description}`;
}

/**
 * The change/commit ID line and the action links. Belongs in a MarkdownString
 * with `isTrusted: { enabledCommands: BLAME_HOVER_COMMANDS }` so the links work.
 */
export function buildBlameHoverActions(change: ChangeWithDetails, documentUri: string): string {
  const changeIdFull = change.changeId.changeId;
  const changeIdShort = formatChangeIdShort(change.changeId);
  const commitIdShort = change.commitId.substring(0, 8);

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

  return `\`${changeIdShort}\` • \`${commitIdShort}\`${badgeText}\n\n${actions.join(" | ")}`;
}
