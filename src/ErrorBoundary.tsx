import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Xbieha could not render the studio:', error, info.componentStack); }

  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="studio-recovery">
      <div className="studio-recovery-card">
        <img src="/logo.svg" width="64" height="64" alt="Xbieha"/>
        <span className="eyebrow">A LITTLE PAUSE</span>
        <h1>Let’s get you<br/><em>creating again.</em></h1>
        <p>The studio hit a snag, but your saved projects are still in this browser.</p>
        <button className="primary-button" onClick={() => location.reload()}>Reload the studio</button>
        <nav aria-label="Legal notices"><a href="/privacy.html">Privacy</a><a href="/terms.html">Terms & limitations</a></nav>
      </div>
    </main>;
  }
}
