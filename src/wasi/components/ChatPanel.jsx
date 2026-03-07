import { useEffect, useRef } from "react";

export function ChatPanel({
  showCapabilities,
  capabilities,
  suggestedQueries,
  onSuggestedQuery,
  messages,
  loading,
  renderMarkdown,
  selectedCountry,
  indices,
  onClearCountryFocus,
  input,
  onInputChange,
  onSend,
  liveSignalsCount,
}) {
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 28px" }}>
        {showCapabilities ? (
          <div style={{ marginBottom: 10, animation: "fadeUp 0.5s ease" }}>
            <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, color: "#f0b429", marginBottom: 2 }}>
              Intelligence Economique d'Afrique de l'Ouest
            </div>
            <div style={{ fontSize: 14, color: "#94a3b8", letterSpacing: 2, marginBottom: 8 }}>
              PROPULSE PAR WASI IA · INTELLIGENCE ECONOMIQUE EN TEMPS REEL
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 8 }}>
              {capabilities.map((capability, index) => (
                <div
                  key={index}
                  style={{
                    background: "rgba(15,42,69,0.5)",
                    border: "1px solid #0f2a45",
                    borderRadius: 4,
                    padding: "8px 12px",
                    fontSize: 13,
                    color: "#94a3b8",
                    lineHeight: 1.4,
                  }}
                >
                  {capability}
                </div>
              ))}
            </div>
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 6, letterSpacing: 2, textTransform: "uppercase" }}>
              Requetes suggerees
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {suggestedQueries.map((query, index) => (
                <button
                  key={index}
                  className="sugg-btn"
                  onClick={() => onSuggestedQuery(query)}
                  style={{
                    background: "transparent",
                    border: "1px solid #1e3a5f",
                    borderRadius: 4,
                    padding: "8px 14px",
                    textAlign: "left",
                    cursor: "pointer",
                    color: "#64748b",
                    fontSize: 13,
                    fontFamily: "'Space Mono', monospace",
                    transition: "all 0.2s",
                    lineHeight: 1.3,
                  }}
                >
                  {"-> "} {query}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {messages.map((message, index) => (
          <div
            key={index}
            className="msg-enter"
            style={{
              marginBottom: 16,
              display: "flex",
              gap: 10,
              flexDirection: message.role === "user" ? "row-reverse" : "row",
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: message.role === "user" ? "#1e3a5f" : "rgba(240,180,41,0.15)",
                border: `1px solid ${message.role === "user" ? "#2d5a8a" : "#f0b429"}`,
                fontSize: 12,
              }}
            >
              {message.role === "user" ? "U" : "AI"}
            </div>
            <div
              style={{
                maxWidth: "78%",
                background: message.role === "user" ? "rgba(30,58,95,0.6)" : "rgba(10,22,40,0.9)",
                border: `1px solid ${message.role === "user" ? "#2d5a8a" : "#0f2a45"}`,
                borderRadius: message.role === "user" ? "12px 4px 12px 12px" : "4px 12px 12px 12px",
                padding: "16px 18px",
                fontSize: 15,
                lineHeight: 1.8,
                color: "#cbd5e1",
              }}
            >
              {message.role === "assistant" ? (
                <div style={{ fontSize: 13, color: "#f0b429", letterSpacing: 2, marginBottom: 6, textTransform: "uppercase" }}>
                  Agent WASI Intelligence · {new Date().toLocaleDateString("fr-FR")}
                </div>
              ) : null}
              {message.role === "assistant" ? renderMarkdown(message.content) : message.content}
            </div>
          </div>
        ))}

        {loading ? (
          <div className="msg-enter" style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "rgba(240,180,41,0.15)",
                border: "1px solid #f0b429",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 15,
              }}
            >
              ...
            </div>
            <div style={{ background: "rgba(10,22,40,0.9)", border: "1px solid #0f2a45", borderRadius: "4px 12px 12px 12px", padding: "18px 24px" }}>
              <div style={{ display: "flex", gap: 8 }}>
                {[0, 1, 2].map((dotIndex) => (
                  <div key={dotIndex} style={{ width: 6, height: 6, borderRadius: "50%", background: "#f0b429", animation: `pulse 1.2s ${dotIndex * 0.2}s infinite` }} />
                ))}
              </div>
              <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 6, letterSpacing: 2 }}>
                ANALYSE EN COURS · MOTEUR WASI v3.0
              </div>
            </div>
          </div>
        ) : null}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ padding: "12px 20px", borderTop: "1px solid #0f2a45", background: "rgba(3,13,26,0.95)" }}>
        {selectedCountry ? (
          <div
            style={{
              marginBottom: 8,
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 10px",
              background: "rgba(240,180,41,0.08)",
              border: "1px solid #f0b42933",
              borderRadius: 4,
            }}
          >
            <span>{selectedCountry.flag}</span>
            <span style={{ fontSize: 14, color: "#f0b429", letterSpacing: 1 }}>
              FOCUS : {selectedCountry.name.toUpperCase()} · INDICE {Math.round(indices[selectedCountry.code])}/100
            </span>
            <button
              onClick={onClearCountryFocus}
              style={{ marginLeft: "auto", background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 15 }}
            >
              x
            </button>
          </div>
        ) : null}
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={input}
            onChange={(event) => onInputChange(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && !event.shiftKey && onSend()}
            placeholder="Interroger l'intelligence WASI... (16 nations CEDEAO, transport, banque, signaux)"
            style={{
              flex: 1,
              background: "rgba(15,42,69,0.5)",
              border: "1px solid #1e3a5f",
              borderRadius: 4,
              padding: "14px 18px",
              color: "#e2e8f0",
              fontSize: 15,
              fontFamily: "'Space Mono', monospace",
              outline: "none",
            }}
          />
          <button
            className="send-btn"
            onClick={() => onSend()}
            disabled={loading || !input.trim()}
            style={{
              background: "transparent",
              border: "1px solid #f0b429",
              color: "#f0b429",
              padding: "14px 24px",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 14,
              fontFamily: "'Space Mono', monospace",
              fontWeight: 700,
              letterSpacing: 2,
              transition: "all 0.2s",
              opacity: loading ? 0.5 : 1,
            }}
          >
            {loading ? "..." : "ENVOYER ->"}
          </button>
        </div>
        <div style={{ marginTop: 6, fontSize: 13, color: "#64748b", letterSpacing: 1, display: "flex", justifyContent: "space-between" }}>
          <span>WASI Intelligence · CEDEAO · Donnees portuaires, transport, bancaires en temps reel</span>
          <span>
            WASI Moteur de Donnees v3.0 · {new Date().toLocaleDateString("fr-FR")} ·{" "}
            {liveSignalsCount > 0 ? `${liveSignalsCount} signaux live actifs` : "Signaux RSS en attente"}
          </span>
        </div>
      </div>
    </div>
  );
}
