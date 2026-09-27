import React from 'react';
import {
  createShapeId,
  Editor,
  HTMLContainer,
  RecordProps,
  Rectangle2d,
  ShapeUtil,
  T,
  TLBaseShape,
} from 'tldraw';

export type TaskPriority = 'P0' | 'P1' | 'P2' | 'P3';

export type TaskShapeProps = {
  w: number;
  h: number;
  title: string;
  completed: boolean;
  priority: TaskPriority;
};

export type ITaskShape = TLBaseShape<'task', TaskShapeProps>;

export class TaskShapeUtil extends ShapeUtil<any> {
  static override type = 'task' as const;

  static override props: RecordProps<any> = {
    w: T.number,
    h: T.number,
    title: T.string,
    completed: T.boolean,
    priority: T.string,
  };

  getDefaultProps(): TaskShapeProps {
    return {
      w: 320,
      h: 110,
      title: 'New developer task',
      completed: false,
      priority: 'P1',
    };
  }

  getGeometry(shape: ITaskShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    });
  }

  getIndicatorPath(shape: ITaskShape) {
    if (typeof Path2D !== 'undefined') {
      const path = new Path2D();
      if (typeof path.roundRect === 'function') {
        path.roundRect(0, 0, shape.props.w, shape.props.h, 12);
      } else {
        path.rect(0, 0, shape.props.w, shape.props.h);
      }
      return path;
    }
    return undefined;
  }

  component(shape: ITaskShape) {
    const { title, completed, priority, w, h } = shape.props;

    const toggleCompleted = (e: React.MouseEvent | React.PointerEvent) => {
      e.stopPropagation();
      this.editor.updateShape({
        id: shape.id,
        type: 'task',
        props: {
          completed: !completed,
        },
      } as any);
    };

    const cyclePriority = (e: React.MouseEvent | React.PointerEvent) => {
      e.stopPropagation();
      const priorities: TaskPriority[] = ['P0', 'P1', 'P2', 'P3'];
      const nextIndex = (priorities.indexOf(priority) + 1) % priorities.length;
      this.editor.updateShape({
        id: shape.id,
        type: 'task',
        props: {
          priority: priorities[nextIndex],
        },
      } as any);
    };

    const priorityColors: Record<TaskPriority, { text: string; bg: string; border: string }> = {
      P0: { text: 'text-red-400', bg: 'bg-red-950/70', border: 'border-red-800' },
      P1: { text: 'text-amber-400', bg: 'bg-amber-950/70', border: 'border-amber-800' },
      P2: { text: 'text-blue-400', bg: 'bg-blue-950/70', border: 'border-blue-800' },
      P3: { text: 'text-zinc-400', bg: 'bg-zinc-800/80', border: 'border-zinc-700' },
    };

    const currentPriority = priorityColors[priority] || priorityColors.P1;

    return (
      <HTMLContainer
        id={shape.id}
        style={{
          width: w,
          height: h,
          pointerEvents: 'all',
        }}
      >
        <div
          className={`w-full h-full rounded-xl bg-zinc-900 border transition-all duration-150 select-none flex flex-col justify-between p-4 shadow-xl ${
            completed
              ? 'border-zinc-800/80 bg-zinc-950/90 opacity-75'
              : 'border-zinc-700 hover:border-zinc-500 shadow-black/60'
          }`}
        >
          {/* Top Row: Checkbox + Title */}
          <div className="flex items-start gap-3">
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={toggleCompleted}
              aria-label={completed ? 'Mark task as incomplete' : 'Mark task as complete'}
              className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors cursor-pointer ${
                completed
                  ? 'bg-emerald-600 border-emerald-500 text-white'
                  : 'bg-zinc-800 border-zinc-600 hover:border-zinc-400'
              }`}
            >
              {completed && (
                <svg
                  className="w-3 h-3 stroke-current stroke-[2.5]"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>

            <span
              className={`text-sm font-medium leading-snug transition-colors line-clamp-2 ${
                completed ? 'text-zinc-500 line-through' : 'text-zinc-100'
              }`}
            >
              {title}
            </span>
          </div>

          {/* Bottom Row: Priority & Meta */}
          <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80 mt-1">
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={cyclePriority}
              title="Click to cycle priority (P0-P3)"
              className={`px-2 py-0.5 text-xs font-mono font-semibold rounded border cursor-pointer transition-transform hover:scale-105 ${currentPriority.text} ${currentPriority.bg} ${currentPriority.border}`}
            >
              {priority}
            </button>

            <span className="text-[11px] font-mono text-zinc-500 tracking-wider">
              {completed ? 'DONE' : 'OPEN'}
            </span>
          </div>
        </div>
      </HTMLContainer>
    );
  }
}

export const INITIAL_MOCK_TASKS: Array<{
  id: string;
  x: number;
  y: number;
  title: string;
  priority: TaskPriority;
  completed: boolean;
}> = [
  {
    id: 'task-1',
    x: 80,
    y: 80,
    title: 'Setup Render Web Service & build pipeline',
    priority: 'P0',
    completed: false,
  },
  {
    id: 'task-2',
    x: 440,
    y: 80,
    title: 'Configure TypeScript strict paths & tsconfig aliases',
    priority: 'P1',
    completed: true,
  },
  {
    id: 'task-3',
    x: 800,
    y: 80,
    title: 'Implement infinite canvas spatial viewport coordinates',
    priority: 'P0',
    completed: false,
  },
  {
    id: 'task-4',
    x: 260,
    y: 230,
    title: 'Optimize shape bounding box collision & hit-testing',
    priority: 'P2',
    completed: false,
  },
  {
    id: 'task-5',
    x: 620,
    y: 230,
    title: 'Refactor developer hotkeys & quick action palette',
    priority: 'P3',
    completed: false,
  },
];

export function seedMockTasks(editor: Editor) {
  const existingTaskShapes = editor
    .getCurrentPageShapes()
    .filter((s) => (s as any).type === 'task');

  if (existingTaskShapes.length === 0) {
    const shapesToCreate = INITIAL_MOCK_TASKS.map((task) => ({
      id: createShapeId(task.id),
      type: 'task' as const,
      x: task.x,
      y: task.y,
      props: {
        w: 320,
        h: 110,
        title: task.title,
        completed: task.completed,
        priority: task.priority,
      },
    }));

    (editor.createShapes as any)(shapesToCreate);
    editor.zoomToFit({ animation: { duration: 200 } });
  }
}

export interface ParsedMarkdownTask {
  title: string;
  completed: boolean;
}

export function parseTasksMarkdown(markdown: string): ParsedMarkdownTask[] {
  const lines = markdown.split(/\r?\n/);
  const tasks: ParsedMarkdownTask[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Detect tasks in format "- [ ]" or "- [x]" or "- [X]" (and support "* [ ]" lists)
    const match = trimmed.match(/^[-*]\s*\[([ xX])\]\s*(.+)$/);
    if (match) {
      const isCompleted = match[1].toLowerCase() === 'x';
      const title = match[2].trim();
      if (title.length > 0) {
        tasks.push({
          title,
          completed: isCompleted,
        });
      }
    }
  }

  return tasks;
}

export function loadTasksFromMarkdown(editor: Editor, markdown: string): number {
  const parsedTasks = parseTasksMarkdown(markdown);
  if (parsedTasks.length === 0) return 0;

  // Clear existing task shapes on canvas
  const existingShapes = editor
    .getCurrentPageShapes()
    .filter((s) => (s as any).type === 'task');

  if (existingShapes.length > 0) {
    editor.deleteShapes(existingShapes.map((s) => s.id));
  }

  const cols = 3;
  const cardWidth = 320;
  const cardHeight = 110;
  const gapX = 40;
  const gapY = 30;

  const shapesToCreate = parsedTasks.map((task, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    return {
      id: createShapeId(),
      type: 'task' as const,
      x: 80 + col * (cardWidth + gapX),
      y: 80 + row * (cardHeight + gapY),
      props: {
        w: cardWidth,
        h: cardHeight,
        title: task.title,
        completed: task.completed,
        priority: 'P1' as const,
      },
    };
  });

  (editor.createShapes as any)(shapesToCreate);
  editor.zoomToFit({ animation: { duration: 250 } });
  return parsedTasks.length;
}
