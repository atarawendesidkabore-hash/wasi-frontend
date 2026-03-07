import { useEffect, useMemo, useState } from "react";
import {
  createInitialBankingState,
  deposit,
  formatXofCentimes,
  parseInputAmountToCentimes,
  transfer,
  withdraw,
} from "./bankingEngine";
import {
  fetchBankingState,
  postDeposit,
  postTransfer,
  postWithdraw,
} from "./bankingApi";

const screenStyle = {
  minHeight: "100vh",
  background:
    "radial-gradient(circle at 10% 10%, #0d2b1a 0%, #02140b 35%, #020d07 100%)",
  color: "#e8f5ee",
  fontFamily: "'Space Mono', monospace",
  padding: 24,
};

const panelStyle = {
  border: "1px solid rgba(232,245,238,0.2)",
  borderRadius: 16,
  background: "rgba(8, 26, 17, 0.75)",
  padding: 16,
  backdropFilter: "blur(8px)",
};

const inputStyle = {
  width: "100%",
  borderRadius: 8,
  border: "1px solid rgba(201,168,76,0.45)",
  background: "rgba(255,255,255,0.04)",
  color: "#e8f5ee",
  padding: "10px 12px",
  fontFamily: "inherit",
};

const buttonStyle = {
  border: "none",
  borderRadius: 8,
  background: "#1a7a4a",
  color: "#fff",
  padding: "10px 14px",
  fontFamily: "inherit",
  cursor: "pointer",
  fontWeight: 700,
};

const cardGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
};

export const BankingApp = () => {
  const [state, setState] = useState(createInitialBankingState);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [backendConnected, setBackendConnected] = useState(false);
  const [depositForm, setDepositForm] = useState({
    accountId: "acc_main",
    amount: "",
  });
  const [withdrawForm, setWithdrawForm] = useState({
    accountId: "acc_main",
    amount: "",
  });
  const [transferForm, setTransferForm] = useState({
    fromAccountId: "acc_main",
    toAccountId: "acc_savings",
    amount: "",
  });

  const totalBalance = useMemo(
    () =>
      state.accounts.reduce(
        (sum, account) => sum + account.balanceCentimes,
        0n
      ),
    [state.accounts]
  );

  const clearError = () => setError("");

  useEffect(() => {
    let cancelled = false;

    const loadState = async () => {
      try {
        const remoteState = await fetchBankingState(150);
        if (cancelled) return;
        setState(remoteState);
        setBackendConnected(true);
        setError("");
      } catch (_) {
        if (cancelled) return;
        setBackendConnected(false);
        setState(createInitialBankingState());
        setError(
          "Backend not reachable. Running in local demo mode. Start server with npm run server."
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadState();
    return () => {
      cancelled = true;
    };
  }, []);

  const onDeposit = async (event) => {
    event.preventDefault();
    try {
      setSubmitting(true);
      clearError();
      const amountCentimes = parseInputAmountToCentimes(depositForm.amount);
      if (backendConnected) {
        const remoteState = await postDeposit({
          accountId: depositForm.accountId,
          amountCentimes,
          description: "Manual deposit",
        });
        setState(remoteState);
      } else {
        setState((previous) =>
          deposit(previous, depositForm.accountId, amountCentimes, "Manual deposit")
        );
      }
      setDepositForm((previous) => ({ ...previous, amount: "" }));
    } catch (failure) {
      setError(failure.message);
    } finally {
      setSubmitting(false);
    }
  };

  const onWithdraw = async (event) => {
    event.preventDefault();
    try {
      setSubmitting(true);
      clearError();
      const amountCentimes = parseInputAmountToCentimes(withdrawForm.amount);
      if (backendConnected) {
        const remoteState = await postWithdraw({
          accountId: withdrawForm.accountId,
          amountCentimes,
          description: "Manual withdrawal",
        });
        setState(remoteState);
      } else {
        setState((previous) =>
          withdraw(
            previous,
            withdrawForm.accountId,
            amountCentimes,
            "Manual withdrawal"
          )
        );
      }
      setWithdrawForm((previous) => ({ ...previous, amount: "" }));
    } catch (failure) {
      setError(failure.message);
    } finally {
      setSubmitting(false);
    }
  };

  const onTransfer = async (event) => {
    event.preventDefault();
    try {
      setSubmitting(true);
      clearError();
      const amountCentimes = parseInputAmountToCentimes(transferForm.amount);
      if (backendConnected) {
        const remoteState = await postTransfer({
          fromAccountId: transferForm.fromAccountId,
          toAccountId: transferForm.toAccountId,
          amountCentimes,
          description: "Internal transfer",
        });
        setState(remoteState);
      } else {
        setState((previous) =>
          transfer(
            previous,
            transferForm.fromAccountId,
            transferForm.toAccountId,
            amountCentimes,
            "Internal transfer"
          )
        );
      }
      setTransferForm((previous) => ({ ...previous, amount: "" }));
    } catch (failure) {
      setError(failure.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main style={screenStyle}>
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          display: "grid",
          gap: 16,
        }}
      >
        <section style={{ ...panelStyle, borderColor: "rgba(201,168,76,0.55)" }}>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <a
              href="?app=wasi"
              style={{
                color: "#c9a84c",
                fontWeight: 700,
                textDecoration: "none",
                border: "1px solid rgba(201,168,76,0.45)",
                padding: "6px 10px",
                borderRadius: 8,
              }}
            >
              Open WASI Terminal
            </a>
          </div>
          <h1 style={{ margin: 0, fontSize: 28, color: "#c9a84c" }}>
            WASI Banking App
          </h1>
          <p style={{ marginTop: 8, marginBottom: 0, color: "#b9d8c7" }}>
            Retail + business wallet MVP with safe centimes-based accounting.
          </p>
          <p style={{ marginTop: 8, marginBottom: 0, color: backendConnected ? "#4ade80" : "#f0b429" }}>
            Mode: {backendConnected ? "Live SQLite backend" : "Offline local demo"}
          </p>
          <p style={{ marginTop: 8, marginBottom: 0 }}>
            Portfolio total:{" "}
            <strong style={{ color: "#4ade80" }}>
              {formatXofCentimes(totalBalance)}
            </strong>
          </p>
        </section>

        {error ? (
          <section style={{ ...panelStyle, borderColor: "rgba(220,38,38,0.8)" }}>
            <strong style={{ color: "#fda4af" }}>Operation failed:</strong> {error}
          </section>
        ) : null}

        <section style={panelStyle}>
          <h2 style={{ marginTop: 0 }}>Accounts</h2>
          <div style={cardGridStyle}>
            {state.accounts.map((account) => (
              <article
                key={account.id}
                style={{
                  border: "1px solid rgba(232,245,238,0.2)",
                  borderRadius: 12,
                  padding: 12,
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                <div style={{ color: "#c9a84c", fontWeight: 700 }}>
                  {account.holder}
                </div>
                <div style={{ opacity: 0.85, fontSize: 12 }}>{account.type}</div>
                <div style={{ marginTop: 8, fontSize: 20, fontWeight: 700 }}>
                  {formatXofCentimes(account.balanceCentimes)}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          }}
        >
          <form onSubmit={onDeposit} style={panelStyle}>
            <h3 style={{ marginTop: 0 }}>Deposit</h3>
            <label>
              Account
              <select
                style={inputStyle}
                value={depositForm.accountId}
                onChange={(event) =>
                  setDepositForm((previous) => ({
                    ...previous,
                    accountId: event.target.value,
                  }))
                }
              >
                {state.accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.type} - {account.holder}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "block", marginTop: 10 }}>
              Amount (XOF)
              <input
                style={inputStyle}
                type="text"
                inputMode="decimal"
                placeholder="25000 or 25000.50"
                value={depositForm.amount}
                onChange={(event) =>
                  setDepositForm((previous) => ({
                    ...previous,
                    amount: event.target.value,
                  }))
                }
                required
              />
            </label>
            <button style={{ ...buttonStyle, marginTop: 12 }} type="submit">
              {submitting ? "Processing..." : "Deposit"}
            </button>
          </form>

          <form onSubmit={onWithdraw} style={panelStyle}>
            <h3 style={{ marginTop: 0 }}>Withdrawal</h3>
            <label>
              Account
              <select
                style={inputStyle}
                value={withdrawForm.accountId}
                onChange={(event) =>
                  setWithdrawForm((previous) => ({
                    ...previous,
                    accountId: event.target.value,
                  }))
                }
              >
                {state.accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.type} - {account.holder}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "block", marginTop: 10 }}>
              Amount (XOF)
              <input
                style={inputStyle}
                type="text"
                inputMode="decimal"
                placeholder="10000"
                value={withdrawForm.amount}
                onChange={(event) =>
                  setWithdrawForm((previous) => ({
                    ...previous,
                    amount: event.target.value,
                  }))
                }
                required
              />
            </label>
            <button style={{ ...buttonStyle, marginTop: 12 }} type="submit">
              {submitting ? "Processing..." : "Withdraw"}
            </button>
          </form>

          <form onSubmit={onTransfer} style={panelStyle}>
            <h3 style={{ marginTop: 0 }}>Transfer</h3>
            <label>
              From
              <select
                style={inputStyle}
                value={transferForm.fromAccountId}
                onChange={(event) =>
                  setTransferForm((previous) => ({
                    ...previous,
                    fromAccountId: event.target.value,
                  }))
                }
              >
                {state.accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.type} - {account.holder}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "block", marginTop: 10 }}>
              To
              <select
                style={inputStyle}
                value={transferForm.toAccountId}
                onChange={(event) =>
                  setTransferForm((previous) => ({
                    ...previous,
                    toAccountId: event.target.value,
                  }))
                }
              >
                {state.accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.type} - {account.holder}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "block", marginTop: 10 }}>
              Amount (XOF)
              <input
                style={inputStyle}
                type="text"
                inputMode="decimal"
                placeholder="15000"
                value={transferForm.amount}
                onChange={(event) =>
                  setTransferForm((previous) => ({
                    ...previous,
                    amount: event.target.value,
                  }))
                }
                required
              />
            </label>
            <button style={{ ...buttonStyle, marginTop: 12 }} type="submit">
              {submitting ? "Processing..." : "Transfer"}
            </button>
          </form>
        </section>

        <section style={panelStyle}>
          <h2 style={{ marginTop: 0 }}>Recent transactions</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", paddingBottom: 8 }}>Time (UTC)</th>
                  <th style={{ textAlign: "left", paddingBottom: 8 }}>Type</th>
                  <th style={{ textAlign: "left", paddingBottom: 8 }}>Account</th>
                  <th style={{ textAlign: "left", paddingBottom: 8 }}>Amount</th>
                  <th style={{ textAlign: "left", paddingBottom: 8 }}>Description</th>
                </tr>
              </thead>
              <tbody>
                {state.transactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ opacity: 0.8, paddingTop: 8 }}>
                      No transaction yet.
                    </td>
                  </tr>
                ) : (
                  state.transactions.slice(0, 20).map((transaction) => (
                    <tr key={transaction.id}>
                      <td style={{ padding: "6px 0", opacity: 0.85 }}>
                        {transaction.createdAtUtc}
                      </td>
                      <td style={{ padding: "6px 0", fontWeight: 700 }}>
                        {transaction.kind}
                      </td>
                      <td style={{ padding: "6px 0" }}>{transaction.accountId}</td>
                      <td
                        style={{
                          padding: "6px 0",
                          color:
                            transaction.kind === "WITHDRAWAL" ||
                            transaction.kind === "TRANSFER_OUT"
                              ? "#fb7185"
                              : "#4ade80",
                        }}
                      >
                        {formatXofCentimes(transaction.amountCentimes)}
                      </td>
                      <td style={{ padding: "6px 0", opacity: 0.85 }}>
                        {transaction.description}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      {loading ? (
        <div style={{ position: "fixed", bottom: 16, right: 16, color: "#c9a84c" }}>
          Loading banking state...
        </div>
      ) : null}
    </main>
  );
};
