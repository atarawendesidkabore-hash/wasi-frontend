import React, { useEffect, useState } from "react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: 40,
            background: "#030d1a",
            color: "#ef4444",
            fontFamily: "monospace",
            minHeight: "100vh",
          }}
        >
          <h2 style={{ color: "#f0b429", marginBottom: 16 }}>WASI - Render Error</h2>
          <pre style={{ whiteSpace: "pre-wrap", color: "#ef4444" }}>
            {this.state.error.message}
            {"\n\n"}
            {this.state.error.stack || ""}
          </pre>
          <button
            onClick={() => {
              sessionStorage.clear();
              window.location.reload();
            }}
            style={{
              marginTop: 20,
              padding: "10px 20px",
              background: "#f0b429",
              color: "#030d1a",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              fontFamily: "monospace",
              fontWeight: 700,
            }}
          >
            Clear Session & Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export function WASIAppShell({ apiUrl, AgentComponent, LoginComponent }) {
  const [token, setToken] = useState(() => {
    const storedToken = sessionStorage.getItem("wasi_token");
    if (!storedToken) return null;

    const tokenTimestamp = parseInt(sessionStorage.getItem("wasi_token_ts") || "0", 10);
    if (Date.now() - tokenTimestamp > 12 * 60 * 60 * 1000) {
      sessionStorage.removeItem("wasi_token");
      sessionStorage.removeItem("wasi_token_ts");
      return null;
    }

    return storedToken;
  });
  const [userInfo, setUserInfo] = useState(null);

  useEffect(() => {
    if (!token) return undefined;

    let cancelled = false;

    async function validateToken() {
      try {
        const response = await fetch(`${apiUrl}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) throw new Error("Invalid token");

        const data = await response.json();
        if (!cancelled) setUserInfo(data);
      } catch (_) {
        if (cancelled) return;
        sessionStorage.removeItem("wasi_token");
        sessionStorage.removeItem("wasi_token_ts");
        setToken(null);
      }
    }

    void validateToken();

    return () => {
      cancelled = true;
    };
  }, [token, apiUrl]);

  const handleAuth = (nextToken, user) => {
    setToken(nextToken);
    setUserInfo(user);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("wasi_token");
    sessionStorage.removeItem("wasi_token_ts");
    setToken(null);
    setUserInfo(null);
  };

  if (!token) {
    return (
      <ErrorBoundary>
        <LoginComponent onAuth={handleAuth} apiUrl={apiUrl} />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <AgentComponent authToken={token} userInfo={userInfo} onLogout={handleLogout} />
    </ErrorBoundary>
  );
}
