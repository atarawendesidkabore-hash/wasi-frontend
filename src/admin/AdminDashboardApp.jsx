import React, { useEffect, useState, useCallback } from "react";
import {
  WASI_THEME,
  getAppShellStyle,
  getPanelStyle,
  sharedPrimaryButtonStyle,
  sharedSecondaryButtonStyle,
  sharedInputStyle,
} from "../platform/wasiTheme";
import {
  loginAdmin,
  clearAdminSession,
  fetchCurrentUser,
  fetchAuditSummary,
  fetchUsers,
  fetchAlerts,
  fetchPlatformHealth,
  updateUserRole,
  updateUserStatus,
  acknowledgeAlert,
  searchAuditLogs,
  exportTransactionsCsv,
} from "./adminApi";

const TABS = ["overview", "users", "audit", "alerts"];

const StatCard = ({ label, value, color }) => (
  <div style={{ ...getPanelStyle(), flex: 1, minWidth: 180 }}>
    <div style={{ color: WASI_THEME.textMuted, fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
    <div style={{ color: color || WASI_THEME.textPrimary, fontSize: 28, fontWeight: 700, marginTop: 4 }}>{value ?? "—"}</div>
  </div>
);

const Badge = ({ text, color }) => (
  <span style={{
    display: "inline-block", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600,
    background: `${color}22`, color, border: `1px solid ${color}44`,
  }}>{text}</span>
);

/* ── Login Screen ──────────────────────────────────────── */
const LoginScreen = ({ onLogin }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await loginAdmin(username, password);
      if (user.role !== "MANAGER") {
        clearAdminSession();
        setError("Acces reserve aux managers.");
        return;
      }
      onLogin(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ ...getAppShellStyle(), display: "flex", alignItems: "center", justifyContent: "center" }}>
      <form onSubmit={handleSubmit} style={{ ...getPanelStyle(), width: 380, display: "grid", gap: 14 }}>
        <h2 style={{ color: WASI_THEME.accent, margin: 0 }}>Admin Console</h2>
        <p style={{ color: WASI_THEME.textMuted, fontSize: 13, margin: 0 }}>Connexion manager requise</p>
        <input style={sharedInputStyle} placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
        <input style={sharedInputStyle} placeholder="Mot de passe" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <div style={{ color: WASI_THEME.danger, fontSize: 13 }}>{error}</div>}
        <button type="submit" disabled={loading} style={{ ...sharedPrimaryButtonStyle, opacity: loading ? 0.6 : 1 }}>
          {loading ? "Connexion..." : "Se connecter"}
        </button>
      </form>
    </main>
  );
};

/* ── Overview Tab ──────────────────────────────────────── */
const OverviewTab = ({ health, audit }) => (
  <div style={{ display: "grid", gap: 16 }}>
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      <StatCard label="Statut" value={health?.status === "healthy" ? "OK" : "ERR"} color={health?.status === "healthy" ? WASI_THEME.success : WASI_THEME.danger} />
      <StatCard label="Uptime" value={health?.uptime ? `${Math.floor(health.uptime / 60)}m` : "—"} />
      <StatCard label="Utilisateurs" value={health?.counts?.users} color={WASI_THEME.info} />
      <StatCard label="Comptes" value={health?.counts?.accounts} color={WASI_THEME.accent} />
      <StatCard label="Transactions" value={health?.counts?.transactions} color={WASI_THEME.success} />
      <StatCard label="Alertes" value={health?.unacknowledgedAlerts} color={health?.unacknowledgedAlerts > 0 ? WASI_THEME.danger : WASI_THEME.success} />
    </div>
    {audit && (
      <div style={{ ...getPanelStyle() }}>
        <h3 style={{ color: WASI_THEME.accent, margin: "0 0 12px" }}>Audit — Dernieres 24h</h3>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: 14 }}>
          <div><span style={{ color: WASI_THEME.textMuted }}>Total: </span>{audit.totalEntries}</div>
          <div><span style={{ color: WASI_THEME.textMuted }}>24h: </span>{audit.last24h}</div>
          <div><span style={{ color: WASI_THEME.textMuted }}>Echecs: </span><span style={{ color: audit.failureCount > 0 ? WASI_THEME.danger : WASI_THEME.success }}>{audit.failureCount}</span></div>
        </div>
        {audit.recentFailures?.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ color: WASI_THEME.danger, fontSize: 12, marginBottom: 6 }}>Echecs recents</div>
            <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
              <thead><tr style={{ color: WASI_THEME.textMuted, textAlign: "left" }}>
                <th style={{ padding: "4px 8px" }}>Action</th><th style={{ padding: "4px 8px" }}>Utilisateur</th><th style={{ padding: "4px 8px" }}>Date</th>
              </tr></thead>
              <tbody>
                {audit.recentFailures.slice(0, 8).map((f, i) => (
                  <tr key={i} style={{ borderTop: `1px solid ${WASI_THEME.border}` }}>
                    <td style={{ padding: "4px 8px" }}>{f.action}</td>
                    <td style={{ padding: "4px 8px" }}>{f.actor_username || f.actor_user_id}</td>
                    <td style={{ padding: "4px 8px", color: WASI_THEME.textMuted }}>{f.created_at_utc?.slice(0, 19)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )}
    <button onClick={() => exportTransactionsCsv().catch(alert)} style={sharedSecondaryButtonStyle}>
      Exporter transactions CSV
    </button>
  </div>
);

/* ── Users Tab ─────────────────────────────────────────── */
const UsersTab = ({ users, onRefresh }) => {
  const [updating, setUpdating] = useState(null);

  const handleRoleChange = async (userId, newRole) => {
    setUpdating(userId);
    try {
      await updateUserRole(userId, newRole);
      onRefresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setUpdating(null);
    }
  };

  const handleToggleActive = async (user) => {
    setUpdating(user.id);
    try {
      await updateUserStatus(user.id, !user.is_active);
      onRefresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div style={{ ...getPanelStyle(), overflowX: "auto" }}>
      <h3 style={{ color: WASI_THEME.accent, margin: "0 0 12px" }}>Utilisateurs ({users.length})</h3>
      <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
        <thead><tr style={{ color: WASI_THEME.textMuted, textAlign: "left" }}>
          <th style={{ padding: "6px 8px" }}>Username</th>
          <th style={{ padding: "6px 8px" }}>Email</th>
          <th style={{ padding: "6px 8px" }}>Role</th>
          <th style={{ padding: "6px 8px" }}>Statut</th>
          <th style={{ padding: "6px 8px" }}>Actions</th>
        </tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} style={{ borderTop: `1px solid ${WASI_THEME.border}`, opacity: updating === u.id ? 0.5 : 1 }}>
              <td style={{ padding: "6px 8px" }}>{u.username}</td>
              <td style={{ padding: "6px 8px", color: WASI_THEME.textMuted }}>{u.email}</td>
              <td style={{ padding: "6px 8px" }}>
                <select
                  value={u.role}
                  onChange={(e) => handleRoleChange(u.id, e.target.value)}
                  disabled={updating === u.id}
                  style={{ background: WASI_THEME.panelBackgroundSoft, color: WASI_THEME.textPrimary, border: `1px solid ${WASI_THEME.border}`, borderRadius: 4, padding: "2px 6px", fontSize: 12 }}
                >
                  <option value="CLIENT">CLIENT</option>
                  <option value="TELLER">TELLER</option>
                  <option value="MANAGER">MANAGER</option>
                </select>
              </td>
              <td style={{ padding: "6px 8px" }}>
                <Badge text={u.is_active ? "Actif" : "Inactif"} color={u.is_active ? WASI_THEME.success : WASI_THEME.danger} />
              </td>
              <td style={{ padding: "6px 8px" }}>
                <button
                  onClick={() => handleToggleActive(u)}
                  disabled={updating === u.id}
                  style={{ ...sharedSecondaryButtonStyle, padding: "3px 10px", fontSize: 11 }}
                >
                  {u.is_active ? "Desactiver" : "Activer"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/* ── Audit Tab ─────────────────────────────────────────── */
const AuditTab = ({ audit }) => {
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState({ action: "", status: "" });

  const doSearch = useCallback(async () => {
    try {
      const params = {};
      if (filter.action) params.action = filter.action;
      if (filter.status) params.status = filter.status;
      params.limit = 50;
      const data = await searchAuditLogs(params);
      setLogs(data.entries || []);
    } catch { /* ignore */ }
  }, [filter]);

  useEffect(() => { doSearch(); }, [doSearch]);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input style={{ ...sharedInputStyle, width: 180 }} placeholder="Action (ex: TRANSFER)" value={filter.action} onChange={(e) => setFilter({ ...filter, action: e.target.value })} />
        <select style={{ ...sharedInputStyle, width: 140 }} value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}>
          <option value="">Tous</option>
          <option value="SUCCESS">SUCCESS</option>
          <option value="FAILURE">FAILURE</option>
        </select>
      </div>
      <div style={{ ...getPanelStyle(), overflowX: "auto" }}>
        <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
          <thead><tr style={{ color: WASI_THEME.textMuted, textAlign: "left" }}>
            <th style={{ padding: "4px 6px" }}>Date</th><th style={{ padding: "4px 6px" }}>Action</th><th style={{ padding: "4px 6px" }}>Utilisateur</th><th style={{ padding: "4px 6px" }}>Statut</th><th style={{ padding: "4px 6px" }}>Detail</th>
          </tr></thead>
          <tbody>
            {logs.map((entry, i) => (
              <tr key={i} style={{ borderTop: `1px solid ${WASI_THEME.border}` }}>
                <td style={{ padding: "4px 6px", color: WASI_THEME.textMuted, whiteSpace: "nowrap" }}>{entry.created_at_utc?.slice(0, 19)}</td>
                <td style={{ padding: "4px 6px" }}>{entry.action}</td>
                <td style={{ padding: "4px 6px" }}>{entry.actor_username || "—"}</td>
                <td style={{ padding: "4px 6px" }}>
                  <Badge text={entry.status} color={entry.status === "SUCCESS" ? WASI_THEME.success : WASI_THEME.danger} />
                </td>
                <td style={{ padding: "4px 6px", color: WASI_THEME.textMuted, maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {entry.detail_json ? JSON.stringify(JSON.parse(entry.detail_json)).slice(0, 80) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length === 0 && <div style={{ padding: 12, color: WASI_THEME.textMuted, textAlign: "center" }}>Aucun resultat</div>}
      </div>
    </div>
  );
};

/* ── Alerts Tab ────────────────────────────────────────── */
const AlertsTab = ({ alerts, onRefresh }) => {
  const handleAck = async (alertId) => {
    try {
      await acknowledgeAlert(alertId);
      onRefresh();
    } catch (err) {
      alert(err.message);
    }
  };

  const severityColor = (s) => s === "CRITICAL" ? WASI_THEME.danger : s === "WARNING" ? WASI_THEME.warning : WASI_THEME.info;

  return (
    <div style={{ ...getPanelStyle() }}>
      <h3 style={{ color: WASI_THEME.accent, margin: "0 0 12px" }}>Alertes de securite ({alerts.length})</h3>
      {alerts.length === 0 && <div style={{ color: WASI_THEME.textMuted }}>Aucune alerte</div>}
      {alerts.map((a) => (
        <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: `1px solid ${WASI_THEME.border}`, gap: 12 }}>
          <div style={{ flex: 1 }}>
            <Badge text={a.severity} color={severityColor(a.severity)} />
            <span style={{ marginLeft: 8, fontSize: 13 }}>{a.message}</span>
            <div style={{ fontSize: 11, color: WASI_THEME.textMuted, marginTop: 2 }}>{a.created_at_utc?.slice(0, 19)} — {a.alert_type}</div>
          </div>
          {!a.acknowledged && (
            <button onClick={() => handleAck(a.id)} style={{ ...sharedSecondaryButtonStyle, padding: "3px 10px", fontSize: 11 }}>
              Acquitter
            </button>
          )}
          {!!a.acknowledged && <Badge text="Acquitte" color={WASI_THEME.textMuted} />}
        </div>
      ))}
    </div>
  );
};

/* ── Main App ──────────────────────────────────────────── */
export const AdminDashboardApp = () => {
  const [user, setUser] = useState(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [tab, setTab] = useState("overview");
  const [health, setHealth] = useState(null);
  const [audit, setAudit] = useState(null);
  const [users, setUsers] = useState([]);
  const [alerts, setAlerts] = useState([]);

  const loadData = useCallback(async () => {
    try {
      const [h, a, u, al] = await Promise.allSettled([
        fetchPlatformHealth(),
        fetchAuditSummary(),
        fetchUsers(),
        fetchAlerts(50),
      ]);
      if (h.status === "fulfilled") setHealth(h.value);
      if (a.status === "fulfilled") setAudit(a.value);
      if (u.status === "fulfilled") setUsers(u.value?.users || []);
      if (al.status === "fulfilled") setAlerts(al.value?.alerts || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const me = await fetchCurrentUser();
        if (me?.role === "MANAGER") setUser(me);
      } catch { /* not logged in */ }
      setBootstrapping(false);
    })();
  }, []);

  useEffect(() => {
    if (user) loadData();
  }, [user, loadData]);

  // Auto-refresh every 30s
  useEffect(() => {
    if (!user) return;
    const id = setInterval(loadData, 30000);
    return () => clearInterval(id);
  }, [user, loadData]);

  if (bootstrapping) return <div style={{ ...getAppShellStyle(), display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ color: WASI_THEME.accent }}>Chargement...</span></div>;
  if (!user) return <LoginScreen onLogin={setUser} />;

  const tabStyle = (t) => ({
    ...sharedSecondaryButtonStyle,
    padding: "6px 14px",
    fontSize: 12,
    background: tab === t ? WASI_THEME.accent : WASI_THEME.buttonSecondary,
    color: tab === t ? WASI_THEME.buttonPrimaryText : WASI_THEME.textPrimary,
    borderRadius: 6,
  });

  return (
    <main style={{ ...getAppShellStyle(), maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ color: WASI_THEME.accent, margin: 0, fontSize: 22 }}>Admin Dashboard</h1>
          <span style={{ color: WASI_THEME.textMuted, fontSize: 12 }}>Connecte: {user.username} ({user.role})</span>
        </div>
        <button onClick={() => { clearAdminSession(); setUser(null); }} style={sharedSecondaryButtonStyle}>Deconnexion</button>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} style={tabStyle(t)}>
            {t === "overview" ? "Vue generale" : t === "users" ? "Utilisateurs" : t === "audit" ? "Audit" : "Alertes"}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab health={health} audit={audit} />}
      {tab === "users" && <UsersTab users={users} onRefresh={loadData} />}
      {tab === "audit" && <AuditTab audit={audit} />}
      {tab === "alerts" && <AlertsTab alerts={alerts} onRefresh={loadData} />}
    </main>
  );
};
