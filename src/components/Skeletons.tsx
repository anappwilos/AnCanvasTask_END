import React from 'react';

export const SkeletonTaskCard: React.FC = () => {
  return (
    <div id="div-skeletons-1" className="rounded bg-[var(--surface-container-high)]/60 border border-[var(--outline)]/50 p-2.5 flex flex-col gap-2 animate-pulse">
      <div id="div-skeletons-2" className="flex items-start justify-between gap-2">
        <div id="div-skeletons-3" className="flex items-center gap-2 flex-1">
          <div id="div-skeletons-4" className="w-3.5 h-3.5 rounded bg-[var(--outline)]" />
          <div id="div-skeletons-5" className="h-3 bg-[var(--outline)] rounded w-3/4" />
        </div>
        <div id="div-skeletons-6" className="w-8 h-3.5 bg-[var(--outline)] rounded shrink-0" />
      </div>
      <div id="div-skeletons-7" className="flex items-center justify-between pt-1.5 border-t border-[var(--outline)]/40 mt-0.5">
        <div id="div-skeletons-8" className="w-12 h-2.5 bg-[var(--outline)] rounded" />
        <div id="div-skeletons-9" className="w-8 h-2.5 bg-[var(--outline)] rounded" />
      </div>
    </div>
  );
};

export const SkeletonKanbanColumn: React.FC<{ title?: string }> = ({ title = 'Cargando...' }) => {
  return (
    <div id="div-skeletons-10" className="w-72 sm:w-80 flex-shrink-0 flex flex-col rounded-lg bg-[var(--surface-container)] border border-[var(--outline)] overflow-hidden">
      <div id="div-skeletons-11" className="px-3 py-2 border-b border-[var(--outline)] flex items-center justify-between">
        <div id="div-skeletons-12" className="flex items-center gap-2">
          <div id="div-skeletons-13" className="w-2 h-2 rounded bg-[var(--outline)] animate-pulse" />
          <span className="text-xs font-medium text-[var(--on-surface-variant)]">{title}</span>
        </div>
        <div id="div-skeletons-14" className="w-5 h-3.5 bg-[var(--outline)] rounded animate-pulse" />
      </div>
      <div id="div-skeletons-15" className="flex-1 p-2 flex flex-col gap-2">
        <SkeletonTaskCard />
        <SkeletonTaskCard />
        <SkeletonTaskCard />
      </div>
    </div>
  );
};

export const SkeletonDetailsPanel: React.FC = () => {
  return (
    <div id="div-skeletons-16" className="w-80 sm:w-96 bg-[var(--surface-container)] border-l border-[var(--outline)] flex flex-col p-4 gap-3 animate-pulse">
      <div id="div-skeletons-17" className="flex items-center justify-between border-b border-[var(--outline)] pb-2.5">
        <div id="div-skeletons-18" className="w-20 h-3.5 bg-[var(--outline)] rounded" />
        <div id="div-skeletons-19" className="w-5 h-5 bg-[var(--outline)] rounded" />
      </div>
      <div id="div-skeletons-20" className="w-3/4 h-4 bg-[var(--outline)] rounded" />
      <div id="div-skeletons-21" className="flex gap-2">
        <div id="div-skeletons-22" className="w-14 h-5 bg-[var(--outline)] rounded" />
        <div id="div-skeletons-23" className="w-16 h-5 bg-[var(--outline)] rounded" />
      </div>
      <div id="div-skeletons-24" className="h-20 bg-[var(--outline)] rounded mt-3" />
    </div>
  );
};
