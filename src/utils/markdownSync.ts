import { TaskPriority } from '../shapes/TaskShapeUtil';

export interface TaskUpdatePayload {
  title?: string;
  completed?: boolean;
  priority?: TaskPriority;
  status?: string;
  tags?: string[];
  blockedBy?: string;
}

export interface TaskBlockInfo {
  taskLineIndex: number;
  endLineIndex: number;
  rawTaskLine: string;
  detectedId?: string;
  temporaryId: string;
  detectedTitle: string;
  detectedPriority?: TaskPriority;
  rawPriority?: string;
  detectedBlockedBy?: string;
  detectedStatus?: string;
  detectedTags?: string[];
  detectedSubtasks?: { total: number; completed: number };
  unknownMetadata: Array<{ key: string; rawLine: string }>;
  groupTitle: string;
  isOutsideHeading: boolean;
  indentation: string;
}

export type MarkdownIssueSeverity = 'warning' | 'error' | 'info';

export type MarkdownIssueType =
  | 'missing_id'
  | 'duplicate_id'
  | 'unresolved_blocker'
  | 'invalid_priority'
  | 'unknown_metadata'
  | 'task_outside_heading'
  | 'empty_heading';

export interface MarkdownIssue {
  id: string;
  type: MarkdownIssueType;
  severity: MarkdownIssueSeverity;
  message: string;
  taskId?: string;
  taskTitle?: string;
  groupTitle?: string;
  lineIndex?: number;
  details?: string;
}

export interface MarkdownValidationReport {
  issues: MarkdownIssue[];
  hasErrors: boolean;
  hasWarnings: boolean;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  duplicateIds: Set<string>;
  missingIdTaskIds: Set<string>;
  unresolvedBlockerMap: Map<string, string[]>; // taskId -> missing blocker IDs
}

/**
 * Parses all task blocks and their associated groups from a Markdown string,
 * detecting unknown metadata, headings, and lines without modifying the document.
 */
export function scanTaskBlocks(markdown: string): {
  taskBlocks: TaskBlockInfo[];
  groupHeadings: Array<{ title: string; lineIndex: number }>;
} {
  const lines = markdown.split(/\r?\n/);
  const taskBlocks: TaskBlockInfo[] = [];
  const groupHeadings: Array<{ title: string; lineIndex: number }> = [];

  let currentGroup = '';
  let currentBlock: TaskBlockInfo | null = null;
  let taskCounter = 0;

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
      taskCounter++;
      currentBlock = {
        taskLineIndex: i,
        endLineIndex: i,
        rawTaskLine: line,
        temporaryId: `temp-task-${taskCounter}`,
        detectedTitle: taskMatch[4].trim(),
        unknownMetadata: [],
        groupTitle: currentGroup || 'General',
        isOutsideHeading: !currentGroup,
        indentation: taskMatch[1].match(/^\s*/)?.[0] || '',
      };
      continue;
    }

    // Inside a task block: detect metadata or unknown metadata lines
    if (currentBlock) {
      // Sub-bullet or key-value metadata under task
      const isSubLine =
        line.startsWith(' ') ||
        line.startsWith('\t') ||
        trimmed.startsWith('-') ||
        trimmed.startsWith('*');

      if (isSubLine && trimmed.length > 0) {
        const idMatch = trimmed.match(/^(?:[-*]\s*)?ID\s*:\s*(.+)$/i);
        if (idMatch) {
          currentBlock.detectedId = idMatch[1].trim();
          currentBlock.endLineIndex = i;
          continue;
        }

        const priorityMatch = trimmed.match(/^(?:[-*]\s*)?Priority\s*:\s*(.+)$/i);
        if (priorityMatch) {
          const rawP = priorityMatch[1].trim();
          currentBlock.rawPriority = rawP;
          const upperP = rawP.toUpperCase();
          if (['P0', 'P1', 'P2', 'P3'].includes(upperP)) {
            currentBlock.detectedPriority = upperP as TaskPriority;
          }
          currentBlock.endLineIndex = i;
          continue;
        }

        const blockedByMatch = trimmed.match(/^(?:[-*]\s*)?Blocked\s*(?:by|-by)?\s*:\s*(.+)$/i);
        if (blockedByMatch) {
          currentBlock.detectedBlockedBy = blockedByMatch[1].trim();
          currentBlock.endLineIndex = i;
          continue;
        }

        const statusMatch = trimmed.match(/^(?:[-*]\s*)?Status\s*:\s*(.+)$/i);
        if (statusMatch) {
          currentBlock.detectedStatus = statusMatch[1].trim().toLowerCase().replace(/\s+/g, '_');
          currentBlock.endLineIndex = i;
          continue;
        }

        const tagsMatch = trimmed.match(/^(?:[-*]\s*)?(?:Tags|Labels)\s*:\s*(.+)$/i);
        if (tagsMatch) {
          currentBlock.detectedTags = tagsMatch[1]
            .split(',')
            .map((t) => t.trim().replace(/^#/, ''))
            .filter(Boolean);
          currentBlock.endLineIndex = i;
          continue;
        }

        const progressMatch = trimmed.match(/^(?:[-*]\s*)?(?:Progress|Subtasks)\s*:\s*(\d+)\s*\/\s*(\d+)$/i);
        if (progressMatch) {
          const completed = parseInt(progressMatch[1], 10);
          const total = parseInt(progressMatch[2], 10);
          if (!isNaN(completed) && !isNaN(total) && total > 0) {
            currentBlock.detectedSubtasks = { completed, total };
          }
          currentBlock.endLineIndex = i;
          continue;
        }

        // Subtask bullet line: "- [ ] Subtask title" or "- [x] Subtask title"
        const subtaskMatch = trimmed.match(/^[-*]\s*\[([ xX])\]\s*(.+)$/);
        if (subtaskMatch) {
          if (!currentBlock.detectedSubtasks) {
            currentBlock.detectedSubtasks = { completed: 0, total: 0 };
          }
          currentBlock.detectedSubtasks.total += 1;
          if (subtaskMatch[1].toLowerCase() === 'x') {
            currentBlock.detectedSubtasks.completed += 1;
          }
          currentBlock.endLineIndex = i;
          continue;
        }

        // Unknown metadata line (e.g. "Owner: Nicolas", "Estimate: 2h")
        const genericMetaMatch = trimmed.match(/^(?:[-*]\s*)?([a-zA-Z0-9_-]+)\s*:\s*(.+)$/);
        if (genericMetaMatch) {
          currentBlock.unknownMetadata.push({
            key: genericMetaMatch[1],
            rawLine: line,
          });
          currentBlock.endLineIndex = i;
          continue;
        }
      }

      if (trimmed.length > 0 && !trimmed.startsWith('#')) {
        currentBlock.endLineIndex = i;
      }
    }
  }

  if (currentBlock) {
    taskBlocks.push(currentBlock);
  }

  return { taskBlocks, groupHeadings };
}

/**
 * Validates a Markdown document for errors and warnings:
 * - Tasks without ID
 * - Duplicate IDs
 * - Blocked by pointing to nonexistent IDs
 * - Invalid priorities
 * - Unknown metadata
 * - Tasks outside headings
 * - Empty headings
 */
export function validateMarkdownDocument(markdown: string): MarkdownValidationReport {
  const { taskBlocks, groupHeadings } = scanTaskBlocks(markdown);
  const issues: MarkdownIssue[] = [];

  const duplicateIds = new Set<string>();
  const missingIdTaskIds = new Set<string>();
  const unresolvedBlockerMap = new Map<string, string[]>();

  const idCounts = new Map<string, TaskBlockInfo[]>();
  const allKnownIds = new Set<string>();

  // 1. Index all detected IDs and check for missing IDs
  taskBlocks.forEach((block, idx) => {
    if (!block.detectedId) {
      const tempId = block.temporaryId || `temp-${idx + 1}`;
      missingIdTaskIds.add(tempId);
      issues.push({
        id: `missing-id-${idx}`,
        type: 'missing_id',
        severity: 'warning',
        message: `Tarea sin ID: "${block.detectedTitle || 'Sin título'}"`,
        taskId: tempId,
        taskTitle: block.detectedTitle,
        groupTitle: block.groupTitle,
        lineIndex: block.taskLineIndex,
        details: 'Se generó un ID temporal en el canvas. Edita la tarea para asignarle un ID permanente.',
      });
    } else {
      const normalized = block.detectedId.toLowerCase();
      allKnownIds.add(normalized);
      if (!idCounts.has(normalized)) {
        idCounts.set(normalized, []);
      }
      idCounts.get(normalized)!.push(block);
    }
  });

  // 2. Check for Duplicate IDs
  idCounts.forEach((blocks, id) => {
    if (blocks.length > 1) {
      duplicateIds.add(id);
      blocks.forEach((block, i) => {
        issues.push({
          id: `dup-id-${id}-${i}`,
          type: 'duplicate_id',
          severity: 'error',
          message: `ID duplicado #${id} en "${block.detectedTitle}"`,
          taskId: block.detectedId,
          taskTitle: block.detectedTitle,
          groupTitle: block.groupTitle,
          lineIndex: block.taskLineIndex,
          details: `Hay ${blocks.length} tareas con el mismo ID #${id}. Cambia uno de los IDs para evitar conflictos.`,
        });
      });
    }
  });

  // 3. Check for Unresolved Blockers (Blocked by pointing to nonexistent ID)
  taskBlocks.forEach((block, idx) => {
    if (block.detectedBlockedBy) {
      const blockerIds = block.detectedBlockedBy
        .split(',')
        .map((b) => b.trim().toLowerCase())
        .filter(Boolean);

      const missingForThisTask: string[] = [];

      blockerIds.forEach((bId) => {
        if (!allKnownIds.has(bId)) {
          missingForThisTask.push(bId);
          issues.push({
            id: `unresolved-blocker-${block.detectedId || idx}-${bId}`,
            type: 'unresolved_blocker',
            severity: 'warning',
            message: `"${block.detectedTitle}" depende de un ID inexistente: #${bId}`,
            taskId: block.detectedId || block.temporaryId,
            taskTitle: block.detectedTitle,
            groupTitle: block.groupTitle,
            lineIndex: block.taskLineIndex,
            details: `La tarea #${block.detectedId || 'sin-id'} tiene "Blocked by: ${bId}", pero no existe ninguna tarea con ese ID.`,
          });
        }
      });

      if (missingForThisTask.length > 0) {
        unresolvedBlockerMap.set(
          (block.detectedId || block.temporaryId).toLowerCase(),
          missingForThisTask
        );
      }
    }
  });

  // 4. Check for Invalid Priorities
  taskBlocks.forEach((block, idx) => {
    if (block.rawPriority && !block.detectedPriority) {
      issues.push({
        id: `invalid-prio-${block.detectedId || idx}`,
        type: 'invalid_priority',
        severity: 'warning',
        message: `Prioridad desconocida "${block.rawPriority}" en "${block.detectedTitle}"`,
        taskId: block.detectedId || block.temporaryId,
        taskTitle: block.detectedTitle,
        groupTitle: block.groupTitle,
        lineIndex: block.taskLineIndex,
        details: 'Valores válidos: P0 (crítica), P1 (alta), P2 (media), P3 (baja). Se usará P1 en el canvas.',
      });
    }
  });

  // 5. Check for Unknown Metadata (Preserved info)
  taskBlocks.forEach((block, idx) => {
    if (block.unknownMetadata.length > 0) {
      block.unknownMetadata.forEach((meta, mIdx) => {
        issues.push({
          id: `unknown-meta-${block.detectedId || idx}-${mIdx}`,
          type: 'unknown_metadata',
          severity: 'info',
          message: `Metadato no estándar en "${block.detectedTitle}": ${meta.key}`,
          taskId: block.detectedId || block.temporaryId,
          taskTitle: block.detectedTitle,
          groupTitle: block.groupTitle,
          lineIndex: block.taskLineIndex,
          details: `Línea preservada: "${meta.rawLine.trim()}"`,
        });
      });
    }
  });

  // 6. Check for Tasks outside headings
  taskBlocks.forEach((block, idx) => {
    if (block.isOutsideHeading) {
      issues.push({
        id: `outside-heading-${block.detectedId || idx}`,
        type: 'task_outside_heading',
        severity: 'info',
        message: `Tarea fuera de sección: "${block.detectedTitle}"`,
        taskId: block.detectedId || block.temporaryId,
        taskTitle: block.detectedTitle,
        groupTitle: 'General',
        lineIndex: block.taskLineIndex,
        details: 'Se ubicó visualmente en el grupo "General". Agrega un encabezado ## Sección para organizarla.',
      });
    }
  });

  // 7. Check for Empty Headings
  groupHeadings.forEach((gh, idx) => {
    const tasksInHeading = taskBlocks.filter(
      (b) => b.groupTitle.toLowerCase() === gh.title.toLowerCase()
    );
    if (tasksInHeading.length === 0) {
      issues.push({
        id: `empty-heading-${idx}`,
        type: 'empty_heading',
        severity: 'info',
        message: `Sección vacía: "## ${gh.title}"`,
        groupTitle: gh.title,
        lineIndex: gh.lineIndex,
        details: 'Esta sección no contiene tareas actualmente.',
      });
    }
  });

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;
  const infoCount = issues.filter((i) => i.severity === 'info').length;

  return {
    issues,
    hasErrors: errorCount > 0,
    hasWarnings: warningCount > 0,
    errorCount,
    warningCount,
    infoCount,
    duplicateIds,
    missingIdTaskIds,
    unresolvedBlockerMap,
  };
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
          taskId: block.detectedId || block.temporaryId,
          title: block.detectedTitle,
          groupTitle: block.groupTitle,
        });
      }
    }
  }

  return dependents;
}

/**
 * Updates a specific task's title, completed status, or priority in a markdown string
 * while preserving unknown metadata, surrounding text, comments, and structure.
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
    (b) =>
      (b.detectedId && b.detectedId.toLowerCase() === normalizedTargetId) ||
      b.temporaryId.toLowerCase() === normalizedTargetId
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
    } else if (updates.status !== undefined) {
      checkChar = updates.status === 'done' ? 'x' : ' ';
    }

    if (updates.title !== undefined) {
      titleContent = updates.title;
    }

    resultLines[targetBlock.taskLineIndex] = `${prefix}${checkChar}${suffix}${titleContent}`;
  }

  // 2. Update priority line or add one if changed
  if (updates.priority !== undefined) {
    let foundPriority = false;
    for (let i = targetBlock.taskLineIndex + 1; i <= targetBlock.endLineIndex; i++) {
      if (resultLines[i].match(/^(?:[-*]\s*)?Priority\s*:\s*(.+)$/i)) {
        resultLines[i] = resultLines[i].replace(
          /(Priority\s*:\s*)(.+)$/i,
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

  // 3. Update status line if explicitly given
  if (updates.status !== undefined) {
    let foundStatus = false;
    for (let i = targetBlock.taskLineIndex + 1; i <= targetBlock.endLineIndex; i++) {
      if (resultLines[i].match(/^(?:[-*]\s*)?Status\s*:\s*(.+)$/i)) {
        resultLines[i] = resultLines[i].replace(
          /(Status\s*:\s*)(.+)$/i,
          `$1${updates.status}`
        );
        foundStatus = true;
        break;
      }
    }

    if (!foundStatus && !['todo', 'done'].includes(updates.status)) {
      const baseIndent = targetBlock.indentation ? `${targetBlock.indentation}  ` : '  ';
      const newStatusLine = `${baseIndent}- Status: ${updates.status}`;
      resultLines.splice(targetBlock.taskLineIndex + 1, 0, newStatusLine);
    }
  }

  // 4. Update tags line if given
  if (updates.tags !== undefined) {
    let foundTags = false;
    for (let i = targetBlock.taskLineIndex + 1; i <= targetBlock.endLineIndex; i++) {
      if (resultLines[i] && resultLines[i].match(/^(?:[-*]\s*)?(?:Tags|Labels)\s*:\s*(.+)$/i)) {
        if (updates.tags.length > 0) {
          resultLines[i] = resultLines[i].replace(
            /((?:Tags|Labels)\s*:\s*)(.+)$/i,
            `$1${updates.tags.join(', ')}`
          );
        } else {
          resultLines.splice(i, 1);
        }
        foundTags = true;
        break;
      }
    }

    if (!foundTags && updates.tags.length > 0) {
      const baseIndent = targetBlock.indentation ? `${targetBlock.indentation}  ` : '  ';
      const newTagsLine = `${baseIndent}- Tags: ${updates.tags.join(', ')}`;
      resultLines.splice(targetBlock.taskLineIndex + 1, 0, newTagsLine);
    }
  }

  // 5. Update blockedBy line if given
  if (updates.blockedBy !== undefined) {
    let foundBlockedBy = false;
    for (let i = targetBlock.taskLineIndex + 1; i <= targetBlock.endLineIndex; i++) {
      if (resultLines[i] && resultLines[i].match(/^(?:[-*]\s*)?Blocked\s*(?:by|-by)?\s*:\s*(.+)$/i)) {
        if (updates.blockedBy.trim().length > 0) {
          resultLines[i] = resultLines[i].replace(
            /(Blocked\s*(?:by|-by)?\s*:\s*)(.+)$/i,
            `$1${updates.blockedBy.trim()}`
          );
        } else {
          resultLines.splice(i, 1);
        }
        foundBlockedBy = true;
        break;
      }
    }

    if (!foundBlockedBy && updates.blockedBy.trim().length > 0) {
      const baseIndent = targetBlock.indentation ? `${targetBlock.indentation}  ` : '  ';
      const newBlockedLine = `${baseIndent}- Blocked by: ${updates.blockedBy.trim()}`;
      resultLines.splice(targetBlock.taskLineIndex + 1, 0, newBlockedLine);
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
    let insertLineIndex = lines.length;
    for (let i = existingGroupHeading.lineIndex + 1; i < lines.length; i++) {
      if (lines[i].trim().startsWith('## ')) {
        insertLineIndex = i;
        break;
      }
    }

    const beforeLines = lines.slice(0, insertLineIndex);
    const afterLines = lines.slice(insertLineIndex);

    const updatedLines = [...beforeLines, '', taskBlockText, ...afterLines];
    return {
      updatedMarkdown: updatedLines.join('\n').replace(/\n{3,}/g, '\n\n'),
      taskId: finalId,
    };
  } else {
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
    (b) =>
      (b.detectedId && b.detectedId.toLowerCase() === normalizedTargetId) ||
      b.temporaryId.toLowerCase() === normalizedTargetId
  );

  if (!targetBlock) {
    return markdown;
  }

  const countToRemove = targetBlock.endLineIndex - targetBlock.taskLineIndex + 1;
  lines.splice(targetBlock.taskLineIndex, countToRemove);

  return lines.join('\n').replace(/\n{3,}/g, '\n\n');
}

/**
 * Moves a task block from its current section to a target section in Markdown,
 * preserving all existing attributes and unknown metadata lines.
 */
export function moveTaskToGroupInMarkdown(
  markdown: string,
  taskId: string,
  targetGroupTitle: string
): string {
  const normalizedTargetId = taskId.trim().toLowerCase();
  const cleanTargetGroup = targetGroupTitle.trim();
  const { taskBlocks } = scanTaskBlocks(markdown);

  const targetBlock = taskBlocks.find(
    (b) =>
      (b.detectedId && b.detectedId.toLowerCase() === normalizedTargetId) ||
      b.temporaryId.toLowerCase() === normalizedTargetId
  );

  if (!targetBlock || targetBlock.groupTitle.toLowerCase() === cleanTargetGroup.toLowerCase()) {
    return markdown;
  }

  const lines = markdown.split(/\r?\n/);

  // Extract raw block lines
  const blockLines = lines.slice(
    targetBlock.taskLineIndex,
    targetBlock.endLineIndex + 1
  );

  // Delete from original position
  lines.splice(targetBlock.taskLineIndex, targetBlock.endLineIndex - targetBlock.taskLineIndex + 1);

  // Find target group
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
    lines.push('', `## ${cleanTargetGroup}`, '', ...blockLines);
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n');
}
