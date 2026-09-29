import React from 'react';

export const SkeletonTaskCard: React.FC = () => {
  return (
    <div className="rounded bg-[var(--surface-container-high)]/60 border border-[var(--outline)]/50 p-2.5 flex flex-col gap-2 animate-pulse">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-1">
          <div className="w-3.5 h-3.5 rounded bg-[var(--outline)]" />
          <div className="h-3 bg-[var(--outline)] rounded w-3/4" />
        </div>
        <div className="w-8 h-3.5 bg-[var(--outline)] rounded shrink-0" />
      </div>
      <div className="flex items-center justify-between pt-1.5 border-t border-[var(--outline)]/40 mt-0.5">
        <div className="w-12 h-2.5 bg-[var(--outline)] rounded" />
        <div className="w-8 h-2.5 bg-[var(--outline)] rounded" />
      </div>
    </div>
  );
};

export const SkeletonKanbanColumn: React.FC<{ title?: string }> = ({ title = 'Cargando...' }) => {
  return (
    <div className="w-72 sm:w-80 flex-shrink-0 flex flex-col rounded-lg bg-[var(--surface-container)] border border-[var(--outline)] overflow-hidden">
      <div className="px-3 py-2 border-b border-[var(--outline)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded bg-[var(--outline)] animate-pulse" />
          <span className="text-xs font-medium text-[var(--on-surface-variant)]">{title}</span>
        </div>
        <div className="w-5 h-3.5 bg-[var(--outline)] rounded animate-pulse" />
      </div>
      <div className="flex-1 p-2 flex flex-col gap-2">
        <SkeletonTaskCard />
        <SkeletonTaskCard />
        <SkeletonTaskCard />
      </div>
    </div>
  );
};

export const SkeletonDetailsPanel: React.FC = () => {
  return (
    <div className="w-80 sm:w-96 bg-[var(--surface-container)] border-l border-[var(--outline)] flex flex-col p-4 gap-3 animate-pulse">
      <div className="flex items-center justify-between border-b border-[var(--outline)] pb-2.5">
        <div className="w-20 h-3.5 bg-[var(--outline)] rounded" />
        <div className="w-5 h-5 bg-[var(--outline)] rounded" />
      </div>
      <div className="w-3/4 h-4 bg-[var(--outline)] rounded" />
      <div className="flex gap-2">
        <div className="w-14 h-5 bg-[var(--outline)] rounded" />
        <div className="w-16 h-5 bg-[var(--outline)] rounded" />
      </div>
      <div className="h-20 bg-[var(--outline)] rounded mt-3" />
    </div>
  );
};
