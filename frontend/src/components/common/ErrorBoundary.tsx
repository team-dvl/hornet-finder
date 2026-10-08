import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  /** Shown instead of `children` once one of them has thrown while rendering */
  fallback: ReactNode;
  /** The boundary resets when this changes (the route, say): navigating away leaves the error screen */
  resetKey?: string;
  children: ReactNode;
}

interface ErrorBoundaryState {
  failed: boolean;
}

/**
 * Catches what a child throws while rendering (an unexpected API answer, a
 * lazy chunk that cannot be fetched) so that the app shows `fallback` instead
 * of a white page. It does not catch errors of event handlers or of promises:
 * those stay with their own `try/catch`.
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Render error:', error, info.componentStack);
  }

  componentDidUpdate(previous: ErrorBoundaryProps): void {
    if (this.state.failed && previous.resetKey !== this.props.resetKey) {
      this.setState({ failed: false });
    }
  }

  render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
