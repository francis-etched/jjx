import { currentChanges, dragFile, isDragging, dropTargetId, justFinishedDrag, tooltip, postMessage } from "../signals";
import { clearAllTooltipTimers } from "../signals";
import type { RegularChangeNode } from "../../../graph-protocol";
import { cx } from "../utils";
import styles from "./new-commit-drop-zone.module.css";

/** Sentinel stored in dropTargetId while the drop zone is hovered. */
const DROP_ZONE_ID = "__new-commit-drop-zone__";

/**
 * The strip of space above the first row of the graph. While a changed file is
 * being dragged it turns into a drop target that creates a new (empty,
 * undescribed) change on top of the topmost revision and moves the file there.
 */
export function NewCommitDropZone() {
  const active = isDragging.value && dragFile.value !== null;
  const over = dropTargetId.value === DROP_ZONE_ID;

  return (
    <div
      class={cx(styles.dropZone, active && styles.active, over && styles.over)}
      onDragOver={(e: DragEvent) => {
        if (!active) {
          return;
        }
        e.preventDefault();
        e.dataTransfer!.dropEffect = "move";
      }}
      onDragEnter={(e: DragEvent) => {
        if (!active) {
          return;
        }
        e.preventDefault();
        dropTargetId.value = DROP_ZONE_ID;
      }}
      onDragLeave={(e: DragEvent) => {
        const relatedTarget = e.relatedTarget as HTMLElement | null;
        const currentTarget = e.currentTarget as HTMLElement;
        if (relatedTarget && currentTarget.contains(relatedTarget)) {
          return;
        }
        if (dropTargetId.value === DROP_ZONE_ID) {
          dropTargetId.value = null;
        }
      }}
      onDrop={(e: DragEvent) => {
        e.preventDefault();
        const file = dragFile.value;
        const topmost = currentChanges.value.find((c): c is RegularChangeNode => c.branchType !== "~");
        clearAllTooltipTimers();
        tooltip.value = null;
        isDragging.value = false;
        dragFile.value = null;
        dropTargetId.value = null;
        justFinishedDrag.value = true;
        setTimeout(() => {
          justFinishedDrag.value = false;
        }, 100);
        if (!file || !topmost) {
          return;
        }
        postMessage({
          command: "newChangeWithFile",
          changeId: file.changeId,
          parentChangeId: topmost.id.changeId,
          path: file.path,
          ...(file.renamedFrom ? { renamedFrom: file.renamedFrom } : {}),
        });
      }}
    >
      {active && "Create new commit"}
    </div>
  );
}
