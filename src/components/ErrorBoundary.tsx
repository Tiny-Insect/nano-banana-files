import React from "react";

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export default class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  constructor(props: React.PropsWithChildren) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.stack || error?.message || "Unknown runtime error",
    };
  }

  componentDidCatch(error: Error) {
    console.error("[ErrorBoundary] Runtime error:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background text-foreground p-6 flex items-start justify-center">
          <div className="w-full max-w-3xl rounded-xl border border-destructive/30 bg-card p-5 shadow-xl">
            <h1 className="text-lg font-semibold text-destructive mb-3">页面运行时出错</h1>
            <p className="text-sm text-muted-foreground mb-4">现在已经拦截到异常，不再是纯白屏。把下面这段报错发给我，我就能继续精确修。</p>
            <pre className="text-xs whitespace-pre-wrap break-all rounded-lg bg-muted/30 p-4 overflow-auto max-h-[70vh]">{this.state.errorMessage}</pre>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
