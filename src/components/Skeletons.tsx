import React from 'react';

export const SkeletonTaskCard: React.FC = () => {
  return (
    <div className="rounded-xl bg-[var(--surface-container-high)]/60 border border-[var(--outline)]/50 p-3 flex flex-col gap-2.5 animate-pulse">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-1">
          <div className="w-4 h-4 rounded-md bg-[var(--outline)]" />
          <div className="h-3.5 bg-[var(--outline)] rounded-md w-3/4" />
        </div>
        <div className="w-10 h-4 bg-[var(--outline)] rounded-full shrink-0" />
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-[var(--outline)]/40 mt-1">
        <div className="w-14 h-3 bg-[var(--outline)] rounded" />
        <div className="w-10 h-3 bg-[var(--outline)] rounded" />
      </div>
    </div>
  );
};

export const SkeletonKanbanColumn: React.FC<{ title?: string }> = ({ title = 'Cargando...' }) => {
  return (
    <div className="w-72 sm:w-80 flex-shrink-0 flex flex-col rounded-2xl bg-[var(--surface-container)] border border-[var(--outline)] overflow-hidden">
      <div className="px-3.5 py-3 border-b border-[var(--outline)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--outline)] animate-pulse" />
          <span className="text-xs font-semibold text-[var(--on-surface-variant)]">{title}</span>
        </div>
        <div className="w-5 h-4 bg-[var(--outline)] rounded-full animate-pulse" />
      </div>
      <div className="flex-1 p-2.5 flex flex-col gap-2.5">
        <SkeletonTaskCard />
        <SkeletonTaskCard />
        <SkeletonTaskCard />
      </div>
    </div>
  );
};

export const SkeletonDetailsPanel: React.FC = () => {
  return (
    <div className="w-80 sm:w-96 bg-[var(--surface-container)] border-l border-[var(--outline)] flex flex-col p-4 gap-4 animate-pulse">
      <div className="flex items-center justify-between border-b border-[var(--outline)] pb-3">
        <div className="w-20 h-4 bg-[var(--outline)] rounded" />
        <div className="w-6 h-6 bg-[var(--outline)] rounded-full" />
      </div>
      <div className="w-3/4 h-5 bg-[var(--outline)] rounded" />
      <div className="flex gap-2">
        <div className="w-16 h-6 bg-[var(--outline)] rounded-full" />
        <div className="w-20 h-6 bg-[var(--outline)] rounded-full" />
      </div>
      <div className="h-24 bg-[var(--outline)] rounded-xl mt-4" />
    </div>
  );
};
