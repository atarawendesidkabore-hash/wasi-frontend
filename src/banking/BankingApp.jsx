import React, { useEffect, useState } from "react";
import AfriTradeApp from "./AfriTradeApp";
import { navigateToApp } from "../platform/AppSwitcher";
import {
  approveBankingApproval,
  clearBankingSession,
  fetchBankingApprovals,
  fetchBankingAudit,
  fetchCurrentBankingUser,
  fetchMyBankingApprovals,
  loginBanking,
  rejectBankingApproval,
  syncWasiTerminalSession,
} from "./bankingApi";

const ROLE_TELLER = "TELLER";
const ROLE_MANAGER = "MANAGER";
const ROLE_CLIENT = "CLIENT";
const OFFLINE_DEMO_SESSION_KEY = "WASI_BANKING_OFFLINE_DEMO_USER";

const DEMO_BANKING_PROFILES = [
  {
    username: "client_demo",
    password: "WasiClient2026!",
    role: ROLE_CLIENT,
    label: "Client",
    description: "Vue portefeuille, transferts et operations personnelles.",
  },
  {
    username: "teller_demo",
    password: "WasiTeller2026!",
    role: ROLE_TELLER,
    label: "Teller",
    description: "Vue operations, suivi et traitement en front office.",
  },
  {
    username: "manager_demo",
    password: "WasiManager2026!",
    role: ROLE_MANAGER,
    label: "Manager",
    description: "Vue controle, validations et audit.",
  },
];

const shellStyle = {
  minHeight: "100vh",
  background: "#020617",
  color: "#e2e8f0",
  padding: 12,
};

const panelStyle = {
  maxWidth: 1280,
  margin: "0 auto",
  border: "1px solid #1e3a8a",
  borderRadius: 12,
  overflow: "hidden",
  background: "#000814",
};

const buttonStyle = {
  background: "#fbbf24",
  color: "#111827",
  border: "1px solid #f59e0b",
  borderRadius: 8,
  padding: "8px 12px",
  fontWeight: 700,
  cursor: "pointer",
};

const loginShellStyle = {
  minHeight: "100vh",
  background:
    "radial-gradient(circle at top, rgba(30,64,175,0.45), transparent 42%), linear-gradient(180deg, #020617 0%, #0f172a 100%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
};

const loginCardStyle = {
  width: "100%",
  maxWidth: 460,
  background: "rgba(15,23,42,0.96)",
  border: "1px solid rgba(59,130,246,0.35)",
  borderRadius: 24,
  padding: 28,
  boxShadow: "0 20px 80px rgba(2,6,23,0.45)",
};

const inputStyle = {
  width: "100%",
  borderRadius: 14,
  border: "1px solid rgba(148,163,184,0.28)",
  background: "#0f172a",
  color: "#e2e8f0",
  padding: "14px 16px",
  outline: "none",
};

const primaryButtonStyle = {
  width: "100%",
  borderRadius: 14,
  border: "1px solid #16a34a",
  background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
  color: "#f8fafc",
  padding: "14px 16px",
  fontWeight: 800,
  cursor: "pointer",
};

const isNetworkError = (error) => {
  const message = error instanceof Error ? error.message : "";
  return /failed to fetch|networkerror|load failed|fetch/i.test(message);
};

const sanitizeErrorMessage = (error) => {
  if (isNetworkError(error)) {
    return "API bancaire indisponible. Utilisez un profil demo local ou demarrez le backend bancaire.";
  }

  if (error instanceof Error && error.message === "HTTP 401") {
    return "Identifiants invalides.";
  }

  return error instanceof Error
    ? error.message
    : "Une erreur inattendue est survenue.";
};

const buildOfflineDemoUser = (profile) => ({
  id: `demo-${String(profile.role || "client").toLowerCase()}`,
  username: profile.username,
  displayName: `${profile.label} demo`,
  email: `${profile.username}@wasi.demo`,
  role: profile.role,
  demoMode: "LOCAL",
});

const persistOfflineDemoSession = (user) => {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(
    OFFLINE_DEMO_SESSION_KEY,
    JSON.stringify(user)
  );
};

const readOfflineDemoSession = () => {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.sessionStorage.getItem(OFFLINE_DEMO_SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    window.sessionStorage.removeItem(OFFLINE_DEMO_SESSION_KEY);
    return null;
  }
};

const clearOfflineDemoSession = () => {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(OFFLINE_DEMO_SESSION_KEY);
};

const isOfflineDemoUser = (user) => Boolean(user?.demoMode === "LOCAL");

const resolveRequestedDemoProfile = () => {
  if (typeof window === "undefined") {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const rawProfile = String(params.get("bankingProfile") || "")
    .trim()
    .toLowerCase();

  if (!rawProfile) {
    return null;
  }

  return (
    DEMO_BANKING_PROFILES.find((profile) => {
      const role = String(profile.role || "").trim().toLowerCase();
      const username = String(profile.username || "").trim().toLowerCase();
      const label = String(profile.label || "").trim().toLowerCase();
      return [role, username, label].includes(rawProfile);
    }) || null
  );
};

const BankingLoginScreen = ({
  credentials,
  onChange,
  onSubmit,
  loginPending,
  loginError,
  onQuickFill,
}) => (
  <main style={loginShellStyle}>
    <section style={loginCardStyle}>
      <div style={{ marginBottom: 22 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            borderRadius: 999,
            background: "rgba(30,41,59,0.9)",
            border: "1px solid rgba(148,163,184,0.18)",
            padding: "6px 12px",
            color: "#93c5fd",
            fontWeight: 700,
            fontSize: 12,
            letterSpacing: 0.6,
          }}
        >
          CONTROLE BANCAIRE
        </div>
        <h1 style={{ margin: "16px 0 6px", fontSize: 30, lineHeight: 1.1 }}>
          Acces Banque par role
        </h1>
        <p style={{ color: "#94a3b8", margin: 0 }}>
          Choisissez un profil client, teller ou manager pour ouvrir
          l'interface qui correspond a votre usage.
        </p>
      </div>

      <div style={{ display: "grid", gap: 10, marginBottom: 18 }}>
        <div
          style={{
            color: "#94a3b8",
            fontSize: 12,
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          Choisir une interface
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          {DEMO_BANKING_PROFILES.map((profile) => (
            <button
              key={profile.username}
              type="button"
              onClick={() => onQuickFill?.(profile)}
              style={{
                textAlign: "left",
                borderRadius: 14,
                border:
                  credentials.username === profile.username
                    ? "1px solid rgba(96,165,250,0.65)"
                    : "1px solid rgba(148,163,184,0.18)",
                background:
                  credentials.username === profile.username
                    ? "rgba(30,64,175,0.18)"
                    : "rgba(15,23,42,0.6)",
                color: "#e2e8f0",
                padding: "12px 14px",
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                <strong>{profile.label}</strong>
                <span
                  style={{
                    borderRadius: 999,
                    border: "1px solid rgba(148,163,184,0.18)",
                    padding: "4px 8px",
                    fontSize: 11,
                    letterSpacing: 1,
                    color: "#93c5fd",
                  }}
                >
                  {profile.role}
                </span>
              </div>
              <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 6 }}>
                {profile.description}
              </div>
              <div style={{ color: "#cbd5e1", fontSize: 12, marginTop: 8 }}>
                {profile.username} / {profile.password}
              </div>
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 14 }}>
        <label style={{ display: "grid", gap: 8 }}>
          <span style={{ fontSize: 13, color: "#cbd5e1", fontWeight: 700 }}>
            Nom d'utilisateur
          </span>
          <input
            type="text"
            name="username"
            value={credentials.username}
            onChange={onChange}
            style={inputStyle}
            autoComplete="username"
            placeholder="client_demo"
          />
        </label>

        <label style={{ display: "grid", gap: 8 }}>
          <span style={{ fontSize: 13, color: "#cbd5e1", fontWeight: 700 }}>
            Mot de passe
          </span>
          <input
            type="password"
            name="password"
            value={credentials.password}
            onChange={onChange}
            style={inputStyle}
            autoComplete="current-password"
            placeholder="Votre mot de passe"
          />
        </label>

        {loginError ? (
          <div
            style={{
              borderRadius: 12,
              border: "1px solid rgba(251,113,133,0.28)",
              background: "rgba(136,19,55,0.18)",
              color: "#fecdd3",
              padding: "10px 12px",
              fontSize: 14,
            }}
          >
            {loginError}
          </div>
        ) : null}

        <button type="submit" disabled={loginPending} style={primaryButtonStyle}>
          {loginPending ? "Connexion en cours..." : "Se connecter"}
        </button>
      </form>

      <div style={{ marginTop: 18, color: "#94a3b8", fontSize: 13 }}>
        Les profils de demonstration ci-dessus permettent de comparer
        directement les interfaces client, teller et manager.
      </div>
    </section>
  </main>
);

export const BankingApp = () => {
  const [showEmbeddedTerminal, setShowEmbeddedTerminal] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [bankingUser, setBankingUser] = useState(null);
  const [credentials, setCredentials] = useState({
    username: "manager_demo",
    password: "",
  });
  const [loginPending, setLoginPending] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [approvalStatus, setApprovalStatus] = useState("PENDING");
  const [userApprovalStatus, setUserApprovalStatus] = useState("PENDING");
  const [userApprovals, setUserApprovals] = useState([]);
  const [userApprovalsLoading, setUserApprovalsLoading] = useState(false);
  const [userApprovalsError, setUserApprovalsError] = useState("");
  const [managerApprovals, setManagerApprovals] = useState([]);
  const [managerApprovalsLoading, setManagerApprovalsLoading] = useState(false);
  const [managerApprovalsError, setManagerApprovalsError] = useState("");
  const [managerActionApprovalId, setManagerActionApprovalId] = useState(null);
  const [managerAuditEntries, setManagerAuditEntries] = useState([]);
  const [managerAuditLoading, setManagerAuditLoading] = useState(false);
  const [managerAuditError, setManagerAuditError] = useState("");
  const [lastAutoProfileKey, setLastAutoProfileKey] = useState("");

  const openEmbeddedTerminal = () => {
    setShowEmbeddedTerminal(true);
  };

  const openModule = (target) => {
    navigateToApp(target);
  };

  const resetManagerConsole = () => {
    setManagerApprovals([]);
    setManagerApprovalsError("");
    setManagerActionApprovalId(null);
    setManagerAuditEntries([]);
    setManagerAuditError("");
  };

  const resetTellerConsole = () => {
    setUserApprovals([]);
    setUserApprovalsError("");
  };

  const loadManagerApprovals = async (status = approvalStatus, user = bankingUser) => {
    if (user?.role !== ROLE_MANAGER || isOfflineDemoUser(user)) {
      resetManagerConsole();
      return;
    }

    setManagerApprovalsLoading(true);
    setManagerApprovalsError("");
    try {
      const approvals = await fetchBankingApprovals({ status, limit: 100 });
      setManagerApprovals(approvals);
    } catch (error) {
      setManagerApprovalsError(sanitizeErrorMessage(error));
    } finally {
      setManagerApprovalsLoading(false);
    }
  };

  const loadUserApprovals = async (
    status = userApprovalStatus,
    user = bankingUser
  ) => {
    if (user?.role !== ROLE_TELLER || isOfflineDemoUser(user)) {
      resetTellerConsole();
      return;
    }

    setUserApprovalsLoading(true);
    setUserApprovalsError("");
    try {
      const approvals = await fetchMyBankingApprovals({ status, limit: 100 });
      setUserApprovals(approvals);
    } catch (error) {
      setUserApprovalsError(sanitizeErrorMessage(error));
    } finally {
      setUserApprovalsLoading(false);
    }
  };

  const loadManagerAudit = async (user = bankingUser) => {
    if (user?.role !== ROLE_MANAGER || isOfflineDemoUser(user)) {
      setManagerAuditEntries([]);
      setManagerAuditError("");
      return;
    }

    setManagerAuditLoading(true);
    setManagerAuditError("");
    try {
      const entries = await fetchBankingAudit({ limit: 100 });
      setManagerAuditEntries(entries);
    } catch (error) {
      setManagerAuditError(sanitizeErrorMessage(error));
    } finally {
      setManagerAuditLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      try {
        const user = await fetchCurrentBankingUser();
        if (!isMounted) return;
        clearOfflineDemoSession();
        setBankingUser(user);
        syncWasiTerminalSession();
      } catch {
        if (!isMounted) return;
        clearBankingSession();
        const offlineUser = readOfflineDemoSession();
        setBankingUser(offlineUser || null);
      } finally {
        if (isMounted) {
          setBootstrapping(false);
        }
      }
    };

    bootstrap();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (bootstrapping) {
      return;
    }

    const requestedProfile = resolveRequestedDemoProfile();
    if (!requestedProfile) {
      return;
    }

    const profileKey = `${requestedProfile.username}:${requestedProfile.password}`;
    if (lastAutoProfileKey === profileKey) {
      return;
    }

    setCredentials({
      username: requestedProfile.username,
      password: requestedProfile.password,
    });
    setLastAutoProfileKey(profileKey);
  }, [bootstrapping, lastAutoProfileKey]);

  useEffect(() => {
    if (bankingUser?.role === ROLE_MANAGER) {
      loadManagerApprovals(approvalStatus, bankingUser);
      loadManagerAudit(bankingUser);
      return;
    }
    resetManagerConsole();
  }, [approvalStatus, bankingUser]);

  useEffect(() => {
    if (bankingUser?.role === ROLE_TELLER) {
      loadUserApprovals(userApprovalStatus, bankingUser);
      return;
    }
    resetTellerConsole();
  }, [userApprovalStatus, bankingUser]);

  const handleLoginFieldChange = (event) => {
    const { name, value } = event.target;
    setCredentials((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleLoginSubmit = async (event) => {
    event.preventDefault();
    setLoginPending(true);
    setLoginError("");

    const normalizedUsername = String(credentials.username || "")
      .trim()
      .toLowerCase();
    const matchedDemoProfile =
      DEMO_BANKING_PROFILES.find(
        (profile) =>
          profile.username === normalizedUsername &&
          profile.password === credentials.password
      ) || null;

    try {
      const user = await loginBanking(credentials);
      clearOfflineDemoSession();
      syncWasiTerminalSession();
      setBankingUser(user);
      setShowEmbeddedTerminal(false);
    } catch (error) {
      if (matchedDemoProfile) {
        const demoUser = buildOfflineDemoUser(matchedDemoProfile);
        persistOfflineDemoSession(demoUser);
        clearBankingSession();
        setBankingUser(demoUser);
        setShowEmbeddedTerminal(false);
        return;
      }
      setLoginError(sanitizeErrorMessage(error));
    } finally {
      setLoginPending(false);
    }
  };

  const handleQuickFill = (profile) => {
    setCredentials({
      username: profile.username,
      password: profile.password,
    });
    setLoginError("");
  };

  const handleLogout = () => {
    clearOfflineDemoSession();
    clearBankingSession();
    setBankingUser(null);
    setShowEmbeddedTerminal(false);
    resetManagerConsole();
    resetTellerConsole();
  };

  const handleApprovalDecision = async (approvalId, decisionNote, decision) => {
    if (isOfflineDemoUser(bankingUser)) {
      setManagerApprovalsError(
        "Mode demonstration local actif. Les validations manager ne sont pas synchronisees."
      );
      return;
    }

    setManagerActionApprovalId(approvalId);
    setManagerApprovalsError("");
    try {
      if (decision === "approve") {
        await approveBankingApproval({ approvalId, decisionNote });
      } else {
        await rejectBankingApproval({ approvalId, decisionNote });
      }
      await loadManagerApprovals(approvalStatus, bankingUser);
      await loadManagerAudit(bankingUser);
    } catch (error) {
      setManagerApprovalsError(sanitizeErrorMessage(error));
    } finally {
      setManagerActionApprovalId(null);
    }
  };

  if (bootstrapping) {
    return (
      <main style={loginShellStyle}>
        <section style={{ ...loginCardStyle, textAlign: "center" }}>
          <h1 style={{ marginTop: 0 }}>Chargement de la session Banking...</h1>
          <p style={{ color: "#94a3b8", marginBottom: 0 }}>
            Nous reconnectons votre profil pour restaurer la console manager.
          </p>
        </section>
      </main>
    );
  }

  if (!bankingUser) {
    return (
      <BankingLoginScreen
        credentials={credentials}
        onChange={handleLoginFieldChange}
        onSubmit={handleLoginSubmit}
        loginPending={loginPending}
        loginError={loginError}
        onQuickFill={handleQuickFill}
      />
    );
  }

  if (showEmbeddedTerminal) {
    return (
      <main style={shellStyle}>
        <section style={panelStyle}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: 10,
              borderBottom: "1px solid #1e3a8a",
            }}
          >
            <strong>Terminal WASI integre a la banque</strong>
            <button
              type="button"
              style={buttonStyle}
              onClick={() => setShowEmbeddedTerminal(false)}
            >
              Retour banque
            </button>
          </div>
          <iframe
            title="WASI Terminal Embedded"
            src="?app=wasi"
            style={{
              display: "block",
              width: "100%",
              height: "calc(100vh - 90px)",
              border: "none",
              background: "#020617",
            }}
          />
        </section>
      </main>
    );
  }

  return (
    <AfriTradeApp
      initialScreen="main"
      authUser={bankingUser}
      onLogout={handleLogout}
      userApprovals={userApprovals}
      userApprovalStatus={userApprovalStatus}
      onUserApprovalStatusChange={setUserApprovalStatus}
      userApprovalsLoading={userApprovalsLoading}
      userApprovalsError={userApprovalsError}
      onRefreshUserApprovals={() => loadUserApprovals(userApprovalStatus, bankingUser)}
      managerApprovals={managerApprovals}
      managerApprovalStatus={approvalStatus}
      onManagerApprovalStatusChange={setApprovalStatus}
      managerApprovalsLoading={managerApprovalsLoading}
      managerApprovalsError={managerApprovalsError}
      managerActionApprovalId={managerActionApprovalId}
      onRefreshManagerApprovals={() => loadManagerApprovals(approvalStatus, bankingUser)}
      onApproveManagerApproval={(approvalId, decisionNote) =>
        handleApprovalDecision(approvalId, decisionNote, "approve")
      }
      onRejectManagerApproval={(approvalId, decisionNote) =>
        handleApprovalDecision(approvalId, decisionNote, "reject")
      }
      managerAuditEntries={managerAuditEntries}
      managerAuditLoading={managerAuditLoading}
      managerAuditError={managerAuditError}
      onRefreshManagerAudit={() => loadManagerAudit(bankingUser)}
      onOpenWasiTerminal={openEmbeddedTerminal}
      onOpenDex={() => openModule("dex")}
      onOpenAfriTax={() => openModule("afritax")}
      onOpenOhadaCompta={() => openModule("compta")}
      onExitAfriTrade={() => {
        setShowEmbeddedTerminal(false);
      }}
    />
  );
};
