import React, { useEffect, useState } from 'react';

export type ToastType = 'success' | 'info' | 'warning' | 'error';

export interface ToastItem {
  id: string;
  message: string;
  type?: ToastType;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-16 sm:bottom-6 right-3 sm:right-6 z-50 flex flex-col gap-2 max-w-[95vw] sm:max-w-md pointer-events-none"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={() => onDismiss(toast.id)} />
      ))}
    </div>
  );
};

const ToastCard: React.FC<{ toast: ToastItem; onDismiss: () => void }> = ({ toast, onDismiss }) => {
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    const duration = toast.duration || (toast.action ? 6000 : 3500);
    const timer = setTimeout(() => {
      setIsClosing(true);
      setTimeout(onDismiss, 200);
    }, duration);

    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  const handleManualDismiss = () => {
    setIsClosing(true);
    setTimeout(onDismiss, 200);
  };

  const typeConfig: Record<
    ToastType,
    { icon: string; dotClass: string; borderClass: string; bgClass: string; textClass: string }
  > = {
    success: {
      icon: 'check_circle',
      dotClass: 'bg-emerald-400',
      borderClass: 'border-emerald-800/60',
      bgClass: 'bg-[var(--surface-container-high)]/95',
      textClass: 'text-emerald-300',
    },
    error: {
      icon: 'error',
      dotClass: 'bg-rose-400',
      borderClass: 'border-rose-800/80',
      bgClass: 'bg-rose-950/95',
      textClass: 'text-rose-200',
    },
    warning: {
      icon: 'warning',
      dotClass: 'bg-amber-400',
      borderClass: 'border-amber-800/80',
      bgClass: 'bg-amber-950/95',
      textClass: 'text-amber-200',
    },
    info: {
      icon: 'info',
      dotClass: 'bg-sky-400',
      borderClass: 'border-sky-800/60',
      bgClass: 'bg-[var(--surface-container-high)]/95',
      textClass: 'text-sky-300',
    },
  };

  const config = typeConfig[toast.type || 'info'];

  return (
    <div
      role={toast.type === 'error' ? 'alert' : 'status'}
      className={`pointer-events-auto flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-2xl border ${config.borderClass} ${config.bgClass} backdrop-blur-md shadow-2xl text-xs font-sans text-[var(--on-surface)] transition-all duration-200 ${
        isClosing ? 'opacity-0 translate-y-2 scale-95' : 'animate-slide-up opacity-100 translate-y-0'
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className={`material-symbols-outlined text-[18px] ${config.textClass} shrink-0`}>
          {config.icon}
        </span>
        <span className="truncate max-w-[240px] sm:max-w-xs font-medium leading-tight">
          {toast.message}
        </span>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {toast.action && (
          <button
            type="button"
            onClick={() => {
              toast.action?.onClick();
              handleManualDismiss();
            }}
            className="px-2.5 py-1 rounded-lg bg-[var(--primary)] text-[var(--on-primary)] font-semibold text-[11px] hover:brightness-110 active:scale-95 transition-all cursor-pointer shadow-xs"
          >
            {toast.action.label}
          </button>
        )}

        <button
          type="button"
          onClick={handleManualDismiss}
          className="p-1 rounded-full text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-container-highest)] cursor-pointer transition-colors"
          aria-label="Cerrar notificación"
        >
          <span className="material-symbols-outlined text-[15px]">close</span>
        </button>
      </div>
    </div>
  );
};
