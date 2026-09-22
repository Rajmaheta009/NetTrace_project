import React from 'react';
import { AlertOctagon, RotateCcw, Copy, Check } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, copied: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('NetTrace UI Incident Intercepted:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleCopy = () => {
    if (this.state.error) {
      navigator.clipboard.writeText(String(this.state.error?.stack || this.state.error?.message || this.state.error));
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 font-sans">
          <div className="max-w-xl w-full bg-slate-900/90 border border-rose-500/30 rounded-3xl p-8 shadow-2xl space-y-6 relative overflow-hidden backdrop-blur-xl">
            <div className="absolute -top-24 -right-24 w-60 h-60 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex items-center space-x-3 text-rose-400">
              <div className="p-3 bg-rose-500/20 border border-rose-500/40 rounded-2xl">
                <AlertOctagon className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-lg font-black tracking-wide text-white uppercase font-mono">
                  UI Incident Intercepted
                </h2>
                <p className="text-xs text-rose-400/90 font-mono">
                  NetTrace Safety Protocol Activated
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              A client-side execution anomaly was captured. Graph memory and backend investigation dossiers remain secure and intact.
            </p>

            {this.state.error && (
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-[11px] text-rose-300/90 overflow-x-auto max-h-40">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <div className="flex items-center space-x-3 pt-2">
              <button
                onClick={this.handleReload}
                className="flex-1 flex items-center justify-center space-x-2 py-3 px-5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/20 transition cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reload Workspace</span>
              </button>
              <button
                onClick={this.handleCopy}
                className="flex items-center space-x-1.5 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition cursor-pointer"
              >
                {this.state.copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{this.state.copied ? 'Copied' : 'Copy Log'}</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
