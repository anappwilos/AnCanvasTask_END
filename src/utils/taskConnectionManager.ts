import { createShapeId, Editor } from 'tldraw';
import { ITaskShape } from '../shapes/TaskShapeUtil';

export interface ConnectionPointAnchor {
  x: number;
  y: number;
  positionName: 'center' | 'top' | 'bottom' | 'left' | 'right';
}

export interface ActiveConnectionSource {
  shapeId: string;
  taskId: string;
  title: string;
  anchor: ConnectionPointAnchor;
}

type ConnectionListener = (source: ActiveConnectionSource | null) => void;

let currentSource: ActiveConnectionSource | null = null;
const listeners = new Set<ConnectionListener>();

export function getActiveConnectionSource(): ActiveConnectionSource | null {
  return currentSource;
}

export function setActiveConnectionSource(source: ActiveConnectionSource | null) {
  currentSource = source;
  listeners.forEach((fn) => {
    try {
      fn(source);
    } catch (e) {
      console.error('Error in connection listener', e);
    }
  });
}

export function subscribeToConnectionSource(listener: ConnectionListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Connects two task shapes via an arrow shape with bindings to the specified central anchors.
 * Returns the created arrow shape ID, or null if connection was not possible.
 */
export function connectTasksWithArrow(
  editor: Editor,
  source: ActiveConnectionSource,
  target: {
    shapeId: string;
    taskId?: string;
    anchor: ConnectionPointAnchor;
  },
  onDependencyCreated?: (blockerTaskId: string, blockedTaskId: string) => void
): string | null {
  if (source.shapeId === target.shapeId) {
    return null;
  }

  const sourceShape = editor.getShape(source.shapeId as any) as ITaskShape | undefined;
  const targetShape = editor.getShape(target.shapeId as any) as ITaskShape | undefined;

  if (!sourceShape || !targetShape) {
    return null;
  }

  // Create an arrow connecting the two tasks at their central points
  const arrowId = createShapeId();

  (editor.createShapes as any)([
    {
      id: arrowId,
      type: 'arrow',
      props: {
        color: 'grey',
        size: 's',
        arrowheadEnd: 'arrow',
        arrowheadStart: 'none',
        bend: 0,
      },
    },
  ]);

  (editor.createBindings as any)([
    {
      fromId: arrowId,
      toId: source.shapeId,
      type: 'arrow',
      props: {
        terminal: 'start',
        normalizedAnchor: { x: source.anchor.x, y: source.anchor.y },
        isExact: false,
        isPrecise: false,
      },
    },
    {
      fromId: arrowId,
      toId: target.shapeId,
      type: 'arrow',
      props: {
        terminal: 'end',
        normalizedAnchor: { x: target.anchor.x, y: target.anchor.y },
        isExact: false,
        isPrecise: false,
      },
    },
  ]);

  // Update target task's dependency (blockedBy)
  const blockerTaskId = source.taskId || sourceShape.props.taskId;
  const blockedTaskId = target.taskId || targetShape.props.taskId;

  if (blockerTaskId && blockedTaskId && blockerTaskId !== blockedTaskId) {
    const existingBlockedBy = targetShape.props.blockedBy || '';
    const currentList = existingBlockedBy
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    if (!currentList.includes(blockerTaskId.toLowerCase())) {
      const updatedBlockedBy = existingBlockedBy
        ? `${existingBlockedBy}, ${blockerTaskId}`
        : blockerTaskId;

      editor.updateShape({
        id: target.shapeId,
        type: 'task',
        props: {
          blockedBy: updatedBlockedBy,
          status: targetShape.props.status === 'done' ? 'done' : 'blocked',
        },
      } as any);

      if (onDependencyCreated) {
        onDependencyCreated(blockerTaskId, blockedTaskId);
      }
    }
  }

  return arrowId;
}
