import { TaskPriority } from '../shapes/TaskShapeUtil';

export interface TaskUpdatePayload {
  title?: string;
  completed?: boolean;
  priority?: TaskPriority;
}

export interface TaskBlockInfo {
  taskLineIndex: number;
  endLineIndex: number;
  rawTaskLine: string;
  detectedId?: string;
  detectedTitle: string;
  detectedPriority?: TaskPriority;
  detectedBlockedBy?: string;
  groupTitle: string;
  indentation: string;
}

/**
 * Parses all task blocks and their associated groups from a Markdown string.
 */
export function scanTaskBlocks(markdown: string): {
  taskBlocks: TaskBlockInfo[];
  groupHeadings: Array<{ title: string; lineIndex: number }>;
} {
  const lines = markdown.split(/\r?\n/);
  const taskBlocks: TaskBlockInfo[] = [];
  const groupHeadings: Array<{ title: string; lineIndex: number }> = [];

  let currentGroup = 'General';
  let currentBlock: TaskBlockInfo | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check for "## Heading"
    const headingMatch = trimmed.match(/^##\s+(.+)$/);
    if (headingMatch) {
      if (currentBlock) {
        currentBlock.endLineIndex = i - 1;
        taskBlocks.push(currentBlock);
        currentBlock = null;
      }
      currentGroup = headingMatch[1].trim();
      groupHeadings.push({ title: currentGroup, lineIndex: i });
      continue;
    }

    // Check for task item: "- [ ] Title" or "- [x] Title"
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
        detectedTitle: taskMatch[4].trim(),
        groupTitle: currentGroup,
        indentation: taskMatch[1].match(/^\s*/)?.[0] || '',
      };
      continue;
    }

    // Inside a task block: detect metadata
    if (currentBlock) {
      const idMatch = trimmed.match(/^(?:[-*]\s*)?ID\s*:\s*(.+)$/i);
      if (idMatch) {
        currentBlock.detectedId = idMatch[1].trim();
      }

      const priorityMatch = trimmed.match(/^(?:[-*]\s*)?Priority\s*:\s*(P[0-3])$/i);
      if (priorityMatch) {
        currentBlock.detectedPriority = priorityMatch[1].toUpperCase() as TaskPriority;
      }

      const blockedByMatch = trimmed.match(/^(?:[-*]\s*)?Blocked\s*(?:by|-by)?\s*:\s*(.+)$/i);
      if (blockedByMatch) {
        currentBlock.detectedBlockedBy = blockedByMatch[1].trim();
      }

      currentBlock.endLineIndex = i;
    }
  }

  if (currentBlock) {
    taskBlocks.push(currentBlock);
  }

  return { taskBlocks, groupHeadings };
}

/**
 * Generates a clean, stable slug identifier from a task title.
 */
export function slugify(text: string): string {
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-_]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'task';
}

/**
 * Generates a unique task ID given the title and current markdown document.
 */
export function generateUniqueTaskId(title: string, markdown: string): string {
  const { taskBlocks } = scanTaskBlocks(markdown);
  const existingIds = new Set(
    taskBlocks.map((b) => (b.detectedId || '').toLowerCase()).filter(Boolean)
  );

  const baseSlug = slugify(title);
  let candidate = baseSlug;
  let counter = 2;

  while (existingIds.has(candidate.toLowerCase())) {
    candidate = `${baseSlug}-${counter}`;
    counter++;
  }

  return candidate;
}

/**
 * Finds tasks that list `targetTaskId` in their "Blocked by" field.
 */
export function findDependentTasks(
  markdown: string,
  targetTaskId: string
): Array<{ taskId: string; title: string; groupTitle: string }> {
  const { taskBlocks } = scanTaskBlocks(markdown);
  const normalizedTargetId = targetTaskId.trim().toLowerCase();

  const dependents: Array<{ taskId: string; title: string; groupTitle: string }> = [];

  for (const block of taskBlocks) {
    if (block.detectedBlockedBy) {
      const blockers = block.detectedBlockedBy
        .split(',')
        .map((b) => b.trim().toLowerCase());

      if (blockers.includes(normalizedTargetId)) {
        dependents.push({
          taskId: block.detectedId || `line-${block.taskLineIndex + 1}`,
          title: block.detectedTitle,
          groupTitle: block.groupTitle,
        });
      }
    }
  }

  return dependents;
}

/**
 * Updates a specific task's title, completed status, or priority in a markdown string.
 */
export function updateTaskInMarkdown(
  markdown: string,
  taskId: string,
  updates: TaskUpdatePayload
): string {
  const lines = markdown.split(/\r?\n/);
  const normalizedTargetId = taskId.trim().toLowerCase();
  const { taskBlocks } = scanTaskBlocks(markdown);

  const targetBlock = taskBlocks.find(
    (b) => b.detectedId && b.detectedId.toLowerCase() === normalizedTargetId
  );

  if (!targetBlock) {
    return markdown;
  }

  const resultLines = [...lines];

  // 1. Update task line (status / title)
  const taskLine = resultLines[targetBlock.taskLineIndex];
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

  // 2. Update priority line
  if (updates.priority !== undefined) {
    let foundPriority = false;
    for (let i = targetBlock.taskLineIndex + 1; i <= targetBlock.endLineIndex; i++) {
      if (resultLines[i].match(/^(?:[-*]\s*)?Priority\s*:\s*(P[0-3])/i)) {
        resultLines[i] = resultLines[i].replace(
          /(Priority\s*:\s*)(P[0-3])/i,
          `$1${updates.priority}`
        );
        foundPriority = true;
        break;
      }
    }

    if (!foundPriority) {
      const baseIndent = targetBlock.indentation ? `${targetBlock.indentation}  ` : '  ';
      const newPriorityLine = `${baseIndent}- Priority: ${updates.priority}`;
      resultLines.splice(targetBlock.taskLineIndex + 1, 0, newPriorityLine);
    }
  }

  return resultLines.join('\n');
}

/**
 * Adds a new task into the specified group in Markdown.
 */
export function addTaskToMarkdown(
  markdown: string,
  payload: {
    title: string;
    priority?: TaskPriority;
    groupTitle: string;
    customId?: string;
  }
): { updatedMarkdown: string; taskId: string } {
  const cleanTitle = payload.title.trim();
  const cleanGroup = payload.groupTitle.trim() || 'General';
  const priority = payload.priority || 'P1';
  const finalId = payload.customId?.trim() || generateUniqueTaskId(cleanTitle, markdown);

  const lines = markdown.split(/\r?\n/);
  const { groupHeadings } = scanTaskBlocks(markdown);

  const taskBlockText = [
    `- [ ] ${cleanTitle}`,
    `  - ID: ${finalId}`,
    `  - Priority: ${priority}`,
  ].join('\n');

  // Check if target group heading exists
  const existingGroupHeading = groupHeadings.find(
    (g) => g.title.toLowerCase() === cleanGroup.toLowerCase()
  );

  if (existingGroupHeading) {
    // Find insertion point: before the next heading or at the end of the file
    let insertLineIndex = lines.length;
    for (let i = existingGroupHeading.lineIndex + 1; i < lines.length; i++) {
      if (lines[i].trim().startsWith('## ')) {
        insertLineIndex = i;
        break;
      }
    }

    // Insert task with empty line separation
    const beforeLines = lines.slice(0, insertLineIndex);
    const afterLines = lines.slice(insertLineIndex);

    // Ensure clean spacing
    const updatedLines = [...beforeLines, '', taskBlockText, ...afterLines];
    return {
      updatedMarkdown: updatedLines.join('\n').replace(/\n{3,}/g, '\n\n'),
      taskId: finalId,
    };
  } else {
    // Target group does not exist yet -> Append new section at end
    const newSection = `\n\n## ${cleanGroup}\n\n${taskBlockText}`;
    const updated = (markdown.trim() + newSection).trim();
    return {
      updatedMarkdown: updated,
      taskId: finalId,
    };
  }
}

/**
 * Deletes a task block from Markdown by its taskId.
 */
export function deleteTaskFromMarkdown(markdown: string, taskId: string): string {
  const lines = markdown.split(/\r?\n/);
  const normalizedTargetId = taskId.trim().toLowerCase();
  const { taskBlocks } = scanTaskBlocks(markdown);

  const targetBlock = taskBlocks.find(
    (b) => b.detectedId && b.detectedId.toLowerCase() === normalizedTargetId
  );

  if (!targetBlock) {
    return markdown;
  }

  // Remove lines from taskLineIndex to endLineIndex
  const countToRemove = targetBlock.endLineIndex - targetBlock.taskLineIndex + 1;
  lines.splice(targetBlock.taskLineIndex, countToRemove);

  // Clean up potential consecutive blank lines
  const cleaned = lines.join('\n').replace(/\n{3,}/g, '\n\n');
  return cleaned;
}

/**
 * Moves a task block from its current section to a target section in Markdown.
 */
export function moveTaskToGroupInMarkdown(
  markdown: string,
  taskId: string,
  targetGroupTitle: string
): string {
  const normalizedTargetId = taskId.trim().toLowerCase();
  const cleanTargetGroup = targetGroupTitle.trim();
  const { taskBlocks, groupHeadings } = scanTaskBlocks(markdown);

  const targetBlock = taskBlocks.find(
    (b) => b.detectedId && b.detectedId.toLowerCase() === normalizedTargetId
  );

  if (!targetBlock || targetBlock.groupTitle.toLowerCase() === cleanTargetGroup.toLowerCase()) {
    return markdown;
  }

  const lines = markdown.split(/\r?\n/);

  // 1. Extract the raw block lines
  const blockLines = lines.slice(
    targetBlock.taskLineIndex,
    targetBlock.endLineIndex + 1
  );

  // 2. Delete the block from original position
  lines.splice(targetBlock.taskLineIndex, targetBlock.endLineIndex - targetBlock.taskLineIndex + 1);

  // 3. Find target group insertion line
  const reScanned = scanTaskBlocks(lines.join('\n'));
  const targetHeading = reScanned.groupHeadings.find(
    (g) => g.title.toLowerCase() === cleanTargetGroup.toLowerCase()
  );

  if (targetHeading) {
    let insertLine = lines.length;
    for (let i = targetHeading.lineIndex + 1; i < lines.length; i++) {
      if (lines[i].trim().startsWith('## ')) {
        insertLine = i;
        break;
      }
    }

    lines.splice(insertLine, 0, '', ...blockLines);
  } else {
    // Append new section
    lines.push('', `## ${cleanTargetGroup}`, '', ...blockLines);
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n');
}
