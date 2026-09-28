import { TaskPriority } from '../shapes/TaskShapeUtil';

export interface TaskUpdatePayload {
  title?: string;
  completed?: boolean;
  priority?: TaskPriority;
}

/**
 * Updates a specific task's title, completed status, or priority in a markdown string
 * while preserving formatting, unknown metadata, IDs, Blocked by, and surrounding document structure.
 */
export function updateTaskInMarkdown(
  markdown: string,
  taskId: string,
  updates: TaskUpdatePayload
): string {
  const lines = markdown.split(/\r?\n/);
  const normalizedTargetId = taskId.trim().toLowerCase();

  // 1. Identify all task blocks and map their line ranges and task IDs
  interface TaskBlock {
    taskLineIndex: number;
    endLineIndex: number;
    rawTaskLine: string;
    detectedId?: string;
    priorityLineIndex?: number;
    indentation: string;
  }

  const taskBlocks: TaskBlock[] = [];
  let currentBlock: TaskBlock | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check for a task line: "- [ ] Title" or "- [x] Title"
    const taskMatch = line.match(/^(\s*[-*]\s*\[)([ xX])(\]\s*)(.*)$/);
    if (taskMatch) {
      if (currentBlock) {
        currentBlock.endLineIndex = i - 1;
        taskBlocks.push(currentBlock);
      }
      currentBlock = {
        taskLineIndex: i,
        endLineIndex: i,
        rawTaskLine: line,
        indentation: taskMatch[1].match(/^\s*/)?.[0] || '',
      };
      continue;
    }

    // Check for "## Heading" which ends any current task block
    if (trimmed.startsWith('##')) {
      if (currentBlock) {
        currentBlock.endLineIndex = i - 1;
        taskBlocks.push(currentBlock);
        currentBlock = null;
      }
      continue;
    }

    // If inside a task block, check metadata lines
    if (currentBlock) {
      const idMatch = trimmed.match(/^(?:[-*]\s*)?ID\s*:\s*(.+)$/i);
      if (idMatch) {
        currentBlock.detectedId = idMatch[1].trim();
      }

      const priorityMatch = trimmed.match(/^(?:[-*]\s*)?Priority\s*:\s*(P[0-3])$/i);
      if (priorityMatch) {
        currentBlock.priorityLineIndex = i;
      }

      currentBlock.endLineIndex = i;
    }
  }

  if (currentBlock) {
    taskBlocks.push(currentBlock);
  }

  // 2. Find matching task block by ID (or fallback)
  const targetBlock = taskBlocks.find(
    (b) => b.detectedId && b.detectedId.toLowerCase() === normalizedTargetId
  );

  if (!targetBlock) {
    return markdown;
  }

  const resultLines = [...lines];

  // 3. Apply updates to the task line (completed status & title)
  let taskLine = resultLines[targetBlock.taskLineIndex];
  const taskLineMatch = taskLine.match(/^(\s*[-*]\s*\[)([ xX])(\]\s*)(.*)$/);

  if (taskLineMatch) {
    const prefix = taskLineMatch[1];
    let checkChar = taskLineMatch[2];
    const suffix = taskLineMatch[3];
    let titleContent = taskLineMatch[4];

    if (updates.completed !== undefined) {
      checkChar = updates.completed ? 'x' : ' ';
    }

    if (updates.title !== undefined) {
      titleContent = updates.title;
    }

    resultLines[targetBlock.taskLineIndex] = `${prefix}${checkChar}${suffix}${titleContent}`;
  }

  // 4. Apply updates to priority line
  if (updates.priority !== undefined) {
    if (targetBlock.priorityLineIndex !== undefined) {
      const existingPriorityLine = resultLines[targetBlock.priorityLineIndex];
      // Replace only the priority value preserving leading whitespace and bullet
      resultLines[targetBlock.priorityLineIndex] = existingPriorityLine.replace(
        /(Priority\s*:\s*)(P[0-3])/i,
        `$1${updates.priority}`
      );
    } else {
      // Priority line didn't exist in metadata, insert it after the task line
      const baseIndent = targetBlock.indentation ? `${targetBlock.indentation}  ` : '  ';
      const newPriorityLine = `${baseIndent}- Priority: ${updates.priority}`;
      resultLines.splice(targetBlock.taskLineIndex + 1, 0, newPriorityLine);
    }
  }

  return resultLines.join('\n');
}
