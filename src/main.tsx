import React, { Component, ErrorInfo, ReactNode, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { i18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { I18nProvider } from '@lingui/react';
import App from './App.tsx';
import './index.css';
import { initI18n } from './i18n';

// Ensure browser compatibility polyfills for libraries expecting Node/global conventions
if (typeof window !== 'undefined') {
  (window as unknown as { global: unknown }).global = window;
  (window as unknown as { process: unknown }).process =
    (window as unknown as { process: unknown }).process || { env: {} };

  // Clean up any stale service workers from previous apps on this origin (e.g. localhost)
  if ('serviceWorker' in navigator && import.meta.env.DEV) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister();
      }
    });
  }
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class RootErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled application error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleResetState = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // ignore storage access errors
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div id="root-error-boundary" className="min-h-screen w-full flex items-center justify-center p-6 bg-[#000000] text-[#f4f4f5] font-sans antialiased">
          <div id="root-error-card" className="max-w-md w-full bg-[#0a0a0a] border border-[#27272a] rounded-lg p-6 shadow-xl flex flex-col gap-4">
            <div id="root-error-header" className="flex items-center gap-3">
              <div id="root-error-icon-wrapper" className="w-10 h-10 rounded-md bg-red-950/80 border border-red-700/60 flex items-center justify-center text-red-400 shrink-0">
                <span className="material-symbols-outlined text-[22px]">warning</span>
              </div>
              <div id="root-error-header-text" className="min-w-0">
                <h2 className="text-sm font-semibold text-[#f4f4f5]">{i18n._(msg`Error de inicialización`)}</h2>
                <p className="text-xs text-[#8b949e]">{i18n._(msg`Se evitó una pantalla en blanco inesperada`)}</p>
              </div>
            </div>

            <div id="root-error-details" className="p-3 bg-[#000000] border border-[#27272a] rounded text-[11px] font-mono text-red-300 break-words max-h-36 overflow-y-auto">
              {this.state.error?.message || i18n._(msg`Error desconocido al cargar los componentes.`)}
            </div>

            <div id="root-error-actions" className="flex items-center gap-2 pt-2">
              <button
                id="btn-root-error-reload"
                type="button"
                onClick={this.handleReload}
                className="flex-1 py-1.5 px-3 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded text-xs font-medium transition cursor-pointer"
              >
                {i18n._(msg`Recargar página`)}
              </button>
              <button
                id="btn-root-error-reset"
                type="button"
                onClick={this.handleResetState}
                className="py-1.5 px-3 bg-[#141414] hover:bg-[#1f1f1f] border border-[#27272a] text-[#f4f4f5] rounded text-xs font-medium transition cursor-pointer"
                title={i18n._(msg`Limpia la memoria local guardada y reinicia la aplicación`)}
              >
                {i18n._(msg`Restablecer datos`)}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

async function renderApp() {
  await initI18n();
  const rootElement = document.getElementById('root');
  if (rootElement) {
    createRoot(rootElement).render(
      <StrictMode>
        <RootErrorBoundary>
          <I18nProvider i18n={i18n}>
            <App />
          </I18nProvider>
        </RootErrorBoundary>
      </StrictMode>,
    );
  }
}

renderApp();
