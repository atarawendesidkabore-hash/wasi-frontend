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

const sanitizeErrorMessage = (error) =>
  error instanceof Error ? error.message : "Une erreur inattendue est survenue.";

const BankingLoginScreen = ({
  credentials,
  onChange,
  onSubmit,
  loginPending,
  loginError,
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
          BANKING CONTROL
        </div>
        <h1 style={{ margin: "16px 0 6px", fontSize: 30, lineHeight: 1.1 }}>
          Console Banking et validation manager
        </h1>
        <p style={{ color: "#94a3b8", margin: 0 }}>
          Connectez-vous avec un profil Banking pour acceder aux operations et a
          la file d'approbation.
        </p>
      </div>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 14 }}>
        <label style={{ display: "grid", gap: 8 }}>
          <span style={{ fontSize: 13, color: "#cbd5e1", fontWeight: 700 }}>
            Username
          </span>
          <input
            type="text"
            name="username"
            value={credentials.username}
            onChange={onChange}
            style={inputStyle}
            autoComplete="username"
            placeholder="manager_demo"
          />
        </label>

        <label style={{ display: "grid", gap: 8 }}>
          <span style={{ fontSize: 13, color: "#cbd5e1", fontWeight: 700 }}>
            Password
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
        Compte manager de demonstration: <strong>manager_demo</strong>
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
    if (user?.role !== ROLE_MANAGER) {
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
    if (user?.role !== ROLE_TELLER) {
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
    if (user?.role !== ROLE_MANAGER) {
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
        setBankingUser(user);
        syncWasiTerminalSession();
      } catch {
        if (!isMounted) return;
        clearBankingSession();
        setBankingUser(null);
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

    try {
      const user = await loginBanking(credentials);
      syncWasiTerminalSession();
      setBankingUser(user);
      setShowEmbeddedTerminal(false);
    } catch (error) {
      setLoginError(sanitizeErrorMessage(error));
    } finally {
      setLoginPending(false);
    }
  };

  const handleLogout = () => {
    clearBankingSession();
    setBankingUser(null);
    setShowEmbeddedTerminal(false);
    resetManagerConsole();
    resetTellerConsole();
  };

  const handleApprovalDecision = async (approvalId, decisionNote, decision) => {
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
            <strong>WASI Terminal (Embedded in Banking)</strong>
            <button
              type="button"
              style={buttonStyle}
              onClick={() => setShowEmbeddedTerminal(false)}
            >
              Retour Banking
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
