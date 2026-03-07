import { useState } from "react";

export function LoginPage({ onAuth, apiUrl }) {
  const [mode, setMode]       = useState("login");   // "login" | "register"
  const [username, setUsername] = useState("");
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const reset = () => { setError(""); };

  const doRegister = async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch(`${apiUrl}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.detail === "string" ? data.detail : Array.isArray(data.detail) ? data.detail.map(e => e.msg || JSON.stringify(e)).join("; ") : "Erreur lors de l'inscription.");
        setLoading(false); return;
      }
      // Auto-login after register
      await doLogin(true);
    } catch (_) {
      setError("Impossible de joindre le serveur WASI.");
      setLoading(false);
    }
  };

  const doLogin = async (fromRegister = false) => {
    if (!fromRegister) { setLoading(true); setError(""); }
    try {
      const res = await fetch(`${apiUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `username=${encodeURIComponent(username.trim())}&password=${encodeURIComponent(password)}`,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.detail === "string" ? data.detail : Array.isArray(data.detail) ? data.detail.map(e => e.msg || JSON.stringify(e)).join("; ") : "Identifiants incorrects.");
        setLoading(false); return;
      }
      const token = data.access_token;
      // Fetch user profile
      const meRes = await fetch(`${apiUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const userInfo = meRes.ok ? await meRes.json() : { username: username.trim() };
      sessionStorage.setItem("wasi_token", token);
      sessionStorage.setItem("wasi_token_ts", Date.now().toString());
      onAuth(token, userInfo);
    } catch (_) {
      setError("Impossible de joindre le serveur WASI.");
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!username.trim() || !password) { setError("Champs obligatoires manquants."); return; }
    if (mode === "register") {
      if (!email.trim()) { setError("L'email est obligatoire pour l'inscription."); return; }
      if (password.length < 8) { setError("Le mot de passe doit contenir au moins 8 caractères."); return; }
      doRegister();
    } else {
      doLogin();
    }
  };

  const inp = {
    width: "100%", background: "rgba(15,42,69,0.6)", border: "1px solid #1e3a5f",
    borderRadius: 4, padding: "14px 18px", color: "#e2e8f0", fontSize: 15,
    fontFamily: "'Space Mono', monospace", outline: "none", boxSizing: "border-box",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#030d1a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Space Mono', monospace", position: "relative", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Bebas+Neue&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { background: #f0b429; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes fadeUp { from{transform:translateY(16px);opacity:0} to{transform:translateY(0);opacity:1} }
        .auth-input:focus { border-color: #f0b429 !important; }
        .auth-btn:hover:not(:disabled) { background: #f0b429 !important; color: #030d1a !important; }
        .tab-btn:hover { color: #f0b429 !important; }
      `}</style>

      {/* Background grid */}
      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(#0f2a4511 1px, transparent 1px), linear-gradient(90deg, #0f2a4511 1px, transparent 1px)", backgroundSize: "40px 40px", pointerEvents: "none" }} />

      {/* Card */}
      <div style={{ position: "relative", width: "100%", maxWidth: 480, animation: "fadeUp 0.4s ease" }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 64, letterSpacing: 10, color: "#f0b429", lineHeight: 1 }}>WASI</div>
          <div style={{ fontSize: 13, color: "#94a3b8", letterSpacing: 4, marginTop: 4 }}>INTELLIGENCE ÉCONOMIQUE · CEDEAO · 16 NATIONS</div>
        </div>

        <div style={{ background: "rgba(7,25,46,0.95)", border: "1px solid #0f2a45", borderRadius: 8, padding: "40px 44px", backdropFilter: "blur(12px)" }}>

          {/* Mode tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid #0f2a45", marginBottom: 28 }}>
            {[["login", "CONNEXION"], ["register", "INSCRIPTION"]].map(([m, label]) => (
              <button key={m} className="tab-btn" onClick={() => { setMode(m); reset(); }} style={{
                flex: 1, background: "none", border: "none", cursor: "pointer",
                padding: "10px 0", fontSize: 14, letterSpacing: 2,
                fontFamily: "'Space Mono', monospace",
                color: mode === m ? "#f0b429" : "#64748b",
                borderBottom: mode === m ? "2px solid #f0b429" : "2px solid transparent",
                marginBottom: -1, transition: "color 0.2s",
              }}>{label}</button>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Username */}
            <div>
              <div style={{ fontSize: 13, color: "#64748b", letterSpacing: 2, marginBottom: 6 }}>IDENTIFIANT</div>
              <input className="auth-input" style={inp} type="text" placeholder="ex: trader_wasi" value={username}
                onChange={e => setUsername(e.target.value)} autoComplete="username" />
            </div>

            {/* Email — register only */}
            {mode === "register" && (
              <div>
                <div style={{ fontSize: 13, color: "#64748b", letterSpacing: 2, marginBottom: 6 }}>ADRESSE EMAIL</div>
                <input className="auth-input" style={inp} type="email" placeholder="vous@exemple.com" value={email}
                  onChange={e => setEmail(e.target.value)} autoComplete="email" />
              </div>
            )}

            {/* Password */}
            <div>
              <div style={{ fontSize: 13, color: "#64748b", letterSpacing: 2, marginBottom: 6 }}>MOT DE PASSE {mode === "register" && <span style={{ color: "#475569" }}>(min. 8 caractères)</span>}</div>
              <div style={{ position: "relative" }}>
                <input className="auth-input" style={{ ...inp, paddingRight: 42 }} type={showPwd ? "text" : "password"}
                  placeholder={mode === "register" ? "Au moins 8 caractères" : "••••••••"} value={password}
                  onChange={e => setPassword(e.target.value)} autoComplete={mode === "register" ? "new-password" : "current-password"} />
                <button type="button" onClick={() => setShowPwd(p => !p)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 15 }}>
                  {showPwd ? "🙈" : "👁"}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{ padding: "14px 16px", background: "rgba(239,68,68,0.08)", border: "1px solid #ef444444", borderRadius: 4, fontSize: 14, color: "#ef4444", lineHeight: 1.6 }}>
                âš  {typeof error === "string" ? error : JSON.stringify(error)}
              </div>
            )}

            {/* Submit */}
            <button type="submit" className="auth-btn" disabled={loading} style={{
              marginTop: 6, padding: "13px", background: "transparent",
              border: "1px solid #f0b429", color: "#f0b429", borderRadius: 4,
              cursor: loading ? "not-allowed" : "pointer", fontSize: 15,
              fontFamily: "'Space Mono', monospace", fontWeight: 700, letterSpacing: 2,
              transition: "all 0.2s", opacity: loading ? 0.6 : 1,
            }}>
              {loading ? "CONNEXION EN COURS…" : mode === "login" ? "ACCÉDER À LA PLATEFORME →" : "CRÉER MON COMPTE →"}
            </button>
          </form>

          {/* Switch mode link */}
          <div style={{ marginTop: 20, textAlign: "center", fontSize: 14, color: "#64748b" }}>
            {mode === "login" ? (
              <>Pas encore de compte ?{" "}
                <span onClick={() => { setMode("register"); reset(); }} style={{ color: "#f0b429", cursor: "pointer", textDecoration: "underline" }}>
                  S'inscrire gratuitement
                </span>
              </>
            ) : (
              <>Déjà inscrit ?{" "}
                <span onClick={() => { setMode("login"); reset(); }} style={{ color: "#f0b429", cursor: "pointer", textDecoration: "underline" }}>
                  Se connecter
                </span>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", marginTop: 20, fontSize: 12, color: "#1e3a5f", letterSpacing: 2 }}>
          WASI INTELLIGENCE PLATFORM v3.0 · © 2025–2026 · DONNÉES ECOWAS TEMPS RÉEL
        </div>
      </div>
    </div>
  );
}

