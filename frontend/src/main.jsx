import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./auth/AuthContext.jsx";
import "./index.css";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="flex h-screen flex-col items-center justify-center bg-neutral-950 px-5 font-sans text-neutral-100 [height:100dvh]">
          <div className="w-full max-w-md text-center">
            <h1 className="text-2xl font-bold text-red-600">页面出错了</h1>
            <p className="mt-3 text-sm text-neutral-400">
              请刷新重试；若持续出现，把下方错误信息发给我。
            </p>
            <pre className="mt-4 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-none border border-neutral-800 bg-neutral-900 p-3 text-left text-xs text-red-400">
              {String(this.state.error?.message || this.state.error)}
            </pre>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 w-full rounded-none bg-red-600 px-4 py-3 text-sm font-medium text-white"
            >
              刷新
            </button>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  </React.StrictMode>
);
