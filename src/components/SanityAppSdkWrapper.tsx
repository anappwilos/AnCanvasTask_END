import React, { Suspense, useState, useMemo } from 'react';
import {
  SanityApp,
  useDocuments,
  useQuery,
  useDocument,
  useCreateDocument,
  useEditDocument,
  useDocumentSyncStatus,
  useDocumentEvent,
} from '@sanity/sdk-react';
import { getSanityConfig, SanityConfig } from '../services/sanityService';

// Error Boundary to safely catch any SDK errors (e.g., CORS, invalid credentials)
interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback: (error: Error, reset: () => void) => React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class SdkErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.warn('Sanity App SDK Error:', error, errorInfo);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      return this.props.fallback(this.state.error, this.reset);
    }
    return this.props.children;
  }
}
