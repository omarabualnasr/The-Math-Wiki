import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps { children: ReactNode }
interface ErrorBoundaryState { failed: boolean }

/** Keeps a single render-time component failure from leaving a blank application. */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // The console output is intended for local debugging; no user content is transmitted.
    console.error('Mathematics Wiki render error:', error, info.componentStack);
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="app-error-boundary" role="alert" aria-live="assertive">
          <div className="eyebrow">APPLICATION ERROR</div>
          <h1>This view could not be displayed.</h1>
          <p>Your locally saved drafts and annotations have not been intentionally cleared.</p>
          <button type="button" className="button button-primary" onClick={() => window.location.reload()}>
            Reload application
          </button>
        </main>
      );
    }
    return this.props.children;
  }
}
