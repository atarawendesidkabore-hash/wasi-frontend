import { useCallback, useEffect, useMemo, useState } from "react";
import { navigateToApp } from "../platform/AppSwitcher";
import {
  getAppShellStyle,
  getPanelStyle,
  sharedPrimaryButtonStyle,
  sharedSecondaryButtonStyle,
  WASI_THEME,
} from "../platform/wasiTheme";
import {
  fetchComptaChart,
  fetchComptaJournal,
  fetchComptaLedger,
  fetchComptaOverview,
  fetchComptaStatements,
  fetchComptaTrialBalance,
  postComptaJournalEntry,
} from "./comptaApi";
import { DEFAULT_LEDGER_ACCOUNT_CODE } from "./comptaReferenceData";
import { syncWasiTerminalSession } from "../banking/bankingApi";

const ACCESS_TOKEN_STORAGE_KEY = "WASI_BANKING_ACCESS_TOKEN";
const TAB_OVERVIEW = "overview";
const TAB_CHART = "chart";
const TAB_JOURNAL = "journal";
const TAB_LEDGER = "ledger";
const TAB_BALANCE = "balance";
const TAB_BILAN = "bilan";
const TAB_RESULT = "result";

const MODULE_SOURCE_OPTIONS = [
  { value: "MANUAL", label: "Saisie manuelle" },
  { value: "BANKING", label: "Banking" },
  { value: "WASI", label: "WASI" },
  { value: "AFRITRADE", label: "AfriTrade" },
  { value: "AFRITAX", label: "AfriTax" },
  { value: "DEX", label: "ETF DEX" },
];

const JOURNAL_OPTIONS = [
  { value: "AC", label: "AC - Achats" },
  { value: "VT", label: "VT - Ventes" },
  { value: "BQ", label: "BQ - Banque" },
  { value: "CA", label: "CA - Caisse" },
  { value: "OD", label: "OD - Operations diverses" },
  { value: "AN", label: "AN - A nouveaux" },
  { value: "EX", label: "EX - Cloture" },
];

const TAB_LABELS = [
  { id: TAB_OVERVIEW, label: "Pilotage" },
  { id: TAB_CHART, label: "Plan comptable" },
  { id: TAB_JOURNAL, label: "Journal" },
  { id: TAB_LEDGER, label: "Grand livre" },
  { id: TAB_BALANCE, label: "Balance" },
  { id: TAB_BILAN, label: "Bilan" },
  { id: TAB_RESULT, label: "Resultat" },
];

const metricCardStyle = {
  border: `1px solid ${WASI_THEME.border}`,
  borderRadius: 12,
  padding: 12,
  background: "rgba(7,25,46,0.7)",
};

const sectionTitleStyle = {
  margin: 0,
  fontFamily: "'Bebas Neue', sans-serif",
  letterSpacing: 2,
  color: WASI_THEME.info,
  fontSize: 28,
};

const tableContainerStyle = {
  border: `1px solid ${WASI_THEME.border}`,
  borderRadius: 12,
  overflow: "hidden",
};

const tableHeaderStyle = {
  background: "rgba(6,16,31,0.92)",
  color: WASI_THEME.textMuted,
  textTransform: "uppercase",
  letterSpacing: 1,
  fontSize: 12,
};

const tableCellStyle = {
  padding: "10px 12px",
  borderBottom: `1px solid ${WASI_THEME.border}`,
  fontSize: 13,
};

const formLabelStyle = {
  display: "block",
  marginBottom: 6,
  color: WASI_THEME.textMuted,
  fontSize: 12,
  letterSpacing: 1,
  textTransform: "uppercase",
};

const formInputStyle = {
  width: "100%",
  borderRadius: 10,
  border: `1px solid ${WASI_THEME.border}`,
  background: "rgba(5,15,28,0.92)",
  color: WASI_THEME.textPrimary,
  padding: "10px 12px",
  outline: "none",
};

const tabButtonStyle = (active) => ({
  border: `1px solid ${active ? WASI_THEME.accent : WASI_THEME.border}`,
  background: active ? "rgba(200,146,42,0.18)" : "transparent",
  color: active ? WASI_THEME.accent : WASI_THEME.textMuted,
  borderRadius: 999,
  padding: "8px 14px",
  cursor: "pointer",
  fontSize: 12,
  letterSpacing: 1,
});

const formatXofFromCentimes = (value) => {
  const numeric = Number(value || 0) / 100;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XOF",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numeric);
};

const formatSignedXofFromCentimes = (value) => {
  const amount = BigInt(value || "0");
  const isNegative = amount < 0n;
  const absolute = isNegative ? 0n - amount : amount;
  return `${isNegative ? "-" : ""}${formatXofFromCentimes(absolute.toString())}`;
};

const formatDateTime = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const normalizeInputAmount = (value) =>
  String(value || "").trim().replace(/\s+/g, "").replace(",", ".");

const parseXofInputToCentimes = (value, fieldLabel) => {
  const normalized = normalizeInputAmount(value);
  if (!normalized) return "0";
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error(`${fieldLabel} doit etre un montant numerique valide.`);
  }

  const [integerPart, decimalPart = ""] = normalized.split(".");
  const centimes = `${integerPart}${decimalPart.padEnd(2, "0")}`.replace(
    /^0+(?=\d)/,
    ""
  );
  return centimes || "0";
};

const safeParseInputToCentimes = (value) => {
  try {
    return BigInt(parseXofInputToCentimes(value, "Montant"));
  } catch (_error) {
    return 0n;
  }
};

const makeEmptyJournalLine = () => ({
  accountCode: "",
  lineLabel: "",
  debit: "",
  credit: "",
});

const BridgeButton = ({ label, onClick, subtle = false }) => (
  <button
    type="button"
    onClick={onClick}
    style={subtle ? sharedSecondaryButtonStyle : sharedPrimaryButtonStyle}
  >
    {label}
  </button>
);

const MetricCard = ({ label, value, tone = WASI_THEME.textPrimary, hint = "" }) => (
  <article style={metricCardStyle}>
    <div
      style={{
        color: WASI_THEME.textMuted,
        fontSize: 12,
        letterSpacing: 1,
        textTransform: "uppercase",
      }}
    >
      {label}
    </div>
    <div
      style={{
        color: tone,
        fontSize: 28,
        marginTop: 8,
        fontFamily: "'Bebas Neue', sans-serif",
        letterSpacing: 1,
      }}
    >
      {value}
    </div>
    {hint ? (
      <div style={{ marginTop: 6, color: WASI_THEME.textMuted, fontSize: 12 }}>
        {hint}
      </div>
    ) : null}
  </article>
);

const TableHeader = ({ columns }) => (
  <thead style={tableHeaderStyle}>
    <tr>
      {columns.map((column) => (
        <th
          key={column.key}
          style={{
            ...tableCellStyle,
            borderBottom: `1px solid ${WASI_THEME.border}`,
            textAlign: column.align || "left",
            fontWeight: 600,
          }}
        >
          {column.label}
        </th>
      ))}
    </tr>
  </thead>
);

const SectionBlock = ({ title, actions = null, children }) => (
  <section
    style={{
      ...getPanelStyle(),
      display: "grid",
      gap: 14,
    }}
  >
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <h2 style={sectionTitleStyle}>{title}</h2>
      {actions}
    </header>
    {children}
  </section>
);

export const OhadaComptaApp = () => {
  const [activeTab, setActiveTab] = useState(TAB_OVERVIEW);
  const [overview, setOverview] = useState(null);
  const [chart, setChart] = useState(null);
  const [journal, setJournal] = useState([]);
  const [trialBalance, setTrialBalance] = useState(null);
  const [statements, setStatements] = useState(null);
  const [ledger, setLedger] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [journalError, setJournalError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [selectedClass, setSelectedClass] = useState("ALL");
  const [accountQuery, setAccountQuery] = useState("");
  const [selectedLedgerAccount, setSelectedLedgerAccount] = useState(
    DEFAULT_LEDGER_ACCOUNT_CODE
  );
  const [journalForm, setJournalForm] = useState({
    reference: "",
    journalCode: "OD",
    moduleSource: "MANUAL",
    description: "",
    entryDate: new Date().toISOString().slice(0, 10),
    lines: [makeEmptyJournalLine(), makeEmptyJournalLine()],
  });

  const hasBankingSession =
    typeof window !== "undefined" &&
    Boolean(window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY));

  const loadLedger = useCallback(
    async (accountCode) => {
      if (!hasBankingSession || !accountCode) return;
      setLedgerLoading(true);
      try {
        const payload = await fetchComptaLedger(accountCode, 250);
        setLedger(payload);
      } catch (loadError) {
        setJournalError(
          loadError.message || "Impossible de charger le grand livre."
        );
      } finally {
        setLedgerLoading(false);
      }
    },
    [hasBankingSession]
  );

  const loadWorkspace = useCallback(async () => {
    if (!hasBankingSession) {
      setOverview(null);
      setChart(null);
      setJournal([]);
      setTrialBalance(null);
      setStatements(null);
      setLedger(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    setSuccessMessage("");
    try {
      const [
        overviewPayload,
        chartPayload,
        journalPayload,
        trialBalancePayload,
        statementsPayload,
      ] = await Promise.all([
        fetchComptaOverview(),
        fetchComptaChart(),
        fetchComptaJournal(24),
        fetchComptaTrialBalance(),
        fetchComptaStatements(),
      ]);

      setOverview(overviewPayload);
      setChart(chartPayload);
      setJournal(journalPayload.entries || []);
      setTrialBalance(trialBalancePayload);
      setStatements(statementsPayload);

      const availableCodes = new Set(
        (chartPayload.accounts || []).map((account) => account.code)
      );
      if (!availableCodes.has(selectedLedgerAccount)) {
        const fallbackCode = availableCodes.has(DEFAULT_LEDGER_ACCOUNT_CODE)
          ? DEFAULT_LEDGER_ACCOUNT_CODE
          : chartPayload.accounts?.[0]?.code || "";
        setSelectedLedgerAccount(fallbackCode);
      }
    } catch (loadError) {
      setError(loadError.message || "Impossible de charger OHADA-Compta.");
    } finally {
      setLoading(false);
    }
  }, [hasBankingSession, selectedLedgerAccount]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    if (!selectedLedgerAccount) return;
    loadLedger(selectedLedgerAccount);
  }, [loadLedger, selectedLedgerAccount]);

  const openModule = useCallback((target) => {
    syncWasiTerminalSession();
    navigateToApp(target);
  }, []);

  const metrics = useMemo(() => {
    if (!overview || !statements) return [];
    const netResult = statements.incomeStatement?.aggregates?.netResultCentimes || "0";
    return [
      {
        label: "Ecritures postees",
        value: String(overview.summary?.journalEntriesCount ?? 0),
        tone: WASI_THEME.info,
      },
      {
        label: "Comptes actifs",
        value: String(overview.summary?.activeAccountsCount ?? 0),
        tone: WASI_THEME.success,
      },
      {
        label: "Produits",
        value: formatXofFromCentimes(overview.summary?.revenueCentimes ?? "0"),
        tone: WASI_THEME.success,
      },
      {
        label: "Charges",
        value: formatXofFromCentimes(overview.summary?.expenseCentimes ?? "0"),
        tone: WASI_THEME.danger,
      },
      {
        label: "Resultat net",
        value: formatSignedXofFromCentimes(netResult),
        tone: BigInt(netResult) >= 0n ? WASI_THEME.accent : WASI_THEME.danger,
      },
      {
        label: "TVA nette",
        value: formatXofFromCentimes(overview.tax?.vatDueCentimes ?? "0"),
        tone: WASI_THEME.warning,
      },
    ];
  }, [overview, statements]);

  const filteredAccounts = useMemo(() => {
    const normalizedQuery = accountQuery.trim().toLowerCase();
    return (chart?.accounts || []).filter((account) => {
      if (
        selectedClass !== "ALL" &&
        Number(selectedClass) !== Number(account.classNumber)
      ) {
        return false;
      }

      if (!normalizedQuery) return true;
      const haystack = `${account.code} ${account.label} ${account.category}`
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      const needle = normalizedQuery
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      return haystack.includes(needle);
    });
  }, [accountQuery, chart, selectedClass]);

  const journalTotals = useMemo(() => {
    const totalDebitCentimes = journalForm.lines.reduce(
      (sum, line) => sum + safeParseInputToCentimes(line.debit),
      0n
    );
    const totalCreditCentimes = journalForm.lines.reduce(
      (sum, line) => sum + safeParseInputToCentimes(line.credit),
      0n
    );

    return {
      totalDebitCentimes,
      totalCreditCentimes,
      isBalanced:
        totalDebitCentimes > 0n && totalDebitCentimes === totalCreditCentimes,
    };
  }, [journalForm.lines]);

  const classButtons = useMemo(
    () => [{ classNumber: "ALL", classLabel: "Toutes" }].concat(chart?.classes || []),
    [chart]
  );

  const updateJournalForm = (field, value) => {
    setJournalForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const updateJournalLine = (index, field, value) => {
    setJournalForm((current) => ({
      ...current,
      lines: current.lines.map((line, lineIndex) =>
        lineIndex === index ? { ...line, [field]: value } : line
      ),
    }));
  };

  const addJournalLine = () => {
    setJournalForm((current) => ({
      ...current,
      lines: current.lines.concat(makeEmptyJournalLine()),
    }));
  };

  const removeJournalLine = (index) => {
    setJournalForm((current) => ({
      ...current,
      lines:
        current.lines.length <= 2
          ? current.lines
          : current.lines.filter((_, lineIndex) => lineIndex !== index),
    }));
  };

  const resetJournalForm = () => {
    setJournalForm({
      reference: "",
      journalCode: "OD",
      moduleSource: "MANUAL",
      description: "",
      entryDate: new Date().toISOString().slice(0, 10),
      lines: [makeEmptyJournalLine(), makeEmptyJournalLine()],
    });
  };

  const submitJournalEntry = async () => {
    setJournalError("");
    setSuccessMessage("");

    if (!journalForm.description.trim()) {
      setJournalError("Le libelle de l'ecriture est requis.");
      return;
    }

    let normalizedLines;
    try {
      normalizedLines = journalForm.lines
        .map((line, index) => {
          const debitCentimes = parseXofInputToCentimes(
            line.debit,
            `Debit ligne ${index + 1}`
          );
          const creditCentimes = parseXofInputToCentimes(
            line.credit,
            `Credit ligne ${index + 1}`
          );
          const hasDebit = BigInt(debitCentimes) > 0n;
          const hasCredit = BigInt(creditCentimes) > 0n;

          if (!line.accountCode.trim()) {
            throw new Error(`Le compte est requis pour la ligne ${index + 1}.`);
          }
          if (hasDebit === hasCredit) {
            throw new Error(
              `La ligne ${index + 1} doit porter soit un debit soit un credit.`
            );
          }

          return {
            accountCode: line.accountCode.trim(),
            lineLabel: line.lineLabel.trim(),
            debitCentimes,
            creditCentimes,
          };
        })
        .filter((line) => BigInt(line.debitCentimes) > 0n || BigInt(line.creditCentimes) > 0n);
    } catch (parseError) {
      setJournalError(parseError.message);
      return;
    }

    if (normalizedLines.length < 2) {
      setJournalError("Au moins deux lignes sont requises.");
      return;
    }

    const totalDebitCentimes = normalizedLines.reduce(
      (sum, line) => sum + BigInt(line.debitCentimes),
      0n
    );
    const totalCreditCentimes = normalizedLines.reduce(
      (sum, line) => sum + BigInt(line.creditCentimes),
      0n
    );

    if (totalDebitCentimes !== totalCreditCentimes) {
      setJournalError("L'ecriture n'est pas equilibree.");
      return;
    }

    setSubmitting(true);
    try {
      await postComptaJournalEntry({
        reference: journalForm.reference.trim(),
        journalCode: journalForm.journalCode,
        moduleSource: journalForm.moduleSource,
        description: journalForm.description.trim(),
        entryDateUtc: new Date(
          `${journalForm.entryDate}T12:00:00.000Z`
        ).toISOString(),
        lines: normalizedLines,
      });
      resetJournalForm();
      await loadWorkspace();
      await loadLedger(selectedLedgerAccount || DEFAULT_LEDGER_ACCOUNT_CODE);
      setSuccessMessage("Ecriture postee avec succes.");
      setActiveTab(TAB_JOURNAL);
    } catch (submitError) {
      setJournalError(
        submitError.message || "Impossible de poster l'ecriture."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const renderOverview = () => (
    <div style={{ display: "grid", gap: 16 }}>
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 10,
        }}
      >
        {metrics.map((metric) => (
          <MetricCard
            key={metric.label}
            label={metric.label}
            value={metric.value}
            tone={metric.tone}
          />
        ))}
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1.3fr 1fr",
          gap: 16,
        }}
      >
        <SectionBlock title="Synthese ecosysteme">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 10,
            }}
          >
            <MetricCard
              label="Liquidite Banking"
              value={formatXofFromCentimes(
                overview?.bridge?.bankLiquidityCentimes ?? "0"
              )}
              tone={WASI_THEME.success}
            />
            <MetricCard
              label="AUM ETF DEX"
              value={formatXofFromCentimes(
                overview?.bridge?.dexAumCentimes ?? "0"
              )}
              tone={WASI_THEME.info}
            />
            <MetricCard
              label="Grand livre banque"
              value={formatXofFromCentimes(
                overview?.bridge?.accountingCashLedgerCentimes ?? "0"
              )}
              tone={WASI_THEME.accent}
            />
            <MetricCard
              label="Balance equilibree"
              value={trialBalance?.totals?.isBalanced ? "OUI" : "NON"}
              tone={
                trialBalance?.totals?.isBalanced
                  ? WASI_THEME.success
                  : WASI_THEME.danger
              }
            />
          </div>
        </SectionBlock>

        <SectionBlock title="Pont modules">
          <div style={{ display: "grid", gap: 10 }}>
            <div style={metricCardStyle}>
              <div style={{ color: WASI_THEME.textMuted, fontSize: 12 }}>
                Modules relies
              </div>
              <div style={{ marginTop: 8, color: WASI_THEME.accent }}>
                {(overview?.bridge?.modulesConnected || []).join(" / ")}
              </div>
            </div>
            <div style={metricCardStyle}>
              <div style={{ color: WASI_THEME.textMuted, fontSize: 12 }}>
                TVA a declarer
              </div>
              <div style={{ marginTop: 8, color: WASI_THEME.warning }}>
                {formatXofFromCentimes(overview?.tax?.vatDueCentimes ?? "0")}
              </div>
            </div>
            <div style={metricCardStyle}>
              <div style={{ color: WASI_THEME.textMuted, fontSize: 12 }}>
                Echeance fiscale proche
              </div>
              <div style={{ marginTop: 8 }}>
                {overview?.tax?.filingCalendar?.[0]?.label || "--"}
              </div>
              <div style={{ marginTop: 4, color: WASI_THEME.textMuted }}>
                {overview?.tax?.filingCalendar?.[0]?.dueDate || "--"}
              </div>
            </div>
          </div>
        </SectionBlock>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1.3fr 1fr",
          gap: 16,
        }}
      >
        <SectionBlock title="Dernieres ecritures">
          <div style={{ display: "grid", gap: 10 }}>
            {journal.slice(0, 6).map((entry) => (
              <article key={entry.id} style={metricCardStyle}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div style={{ color: WASI_THEME.accent, fontWeight: 700 }}>
                      {entry.reference}
                    </div>
                    <div style={{ marginTop: 4 }}>{entry.description}</div>
                  </div>
                  <div style={{ textAlign: "right", color: WASI_THEME.textMuted }}>
                    <div>
                      {entry.journalCode} / {entry.moduleSource}
                    </div>
                    <div style={{ marginTop: 4 }}>
                      {formatDateTime(entry.entryDateUtc)}
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    marginTop: 10,
                    color: WASI_THEME.textMuted,
                    fontSize: 12,
                  }}
                >
                  <span>Debit {formatXofFromCentimes(entry.totalDebitCentimes)}</span>
                  <span>Credit {formatXofFromCentimes(entry.totalCreditCentimes)}</span>
                </div>
              </article>
            ))}
          </div>
        </SectionBlock>

        <SectionBlock title="Capitaux et resultat">
          <div style={{ display: "grid", gap: 10 }}>
            {(statements?.balanceSheet?.passif || []).map((row) => (
              <div key={row.code} style={metricCardStyle}>
                <div style={{ color: WASI_THEME.textMuted, fontSize: 12 }}>
                  {row.label}
                </div>
                <div style={{ marginTop: 8, color: WASI_THEME.textPrimary }}>
                  {formatSignedXofFromCentimes(row.amountCentimes)}
                </div>
              </div>
            ))}
          </div>
        </SectionBlock>
      </section>
    </div>
  );

  const renderChart = () => (
    <SectionBlock
      title="Plan comptable SYSCOHADA"
      actions={
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {classButtons.map((item) => (
            <button
              key={item.classNumber}
              type="button"
              onClick={() => setSelectedClass(String(item.classNumber))}
              style={tabButtonStyle(
                String(item.classNumber) === String(selectedClass)
              )}
            >
              {item.classNumber === "ALL"
                ? item.classLabel
                : `Classe ${item.classNumber}`}
            </button>
          ))}
        </div>
      }
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 10,
          alignItems: "center",
        }}
      >
        <input
          type="text"
          value={accountQuery}
          onChange={(event) => setAccountQuery(event.target.value)}
          placeholder="Rechercher un compte, un libelle ou une categorie..."
          style={formInputStyle}
        />
        <div style={{ color: WASI_THEME.textMuted, fontSize: 12 }}>
          {filteredAccounts.length} compte(s)
        </div>
      </div>

      <div style={tableContainerStyle}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <TableHeader
            columns={[
              { key: "code", label: "Numero" },
              { key: "label", label: "Libelle" },
              { key: "class", label: "Classe" },
              { key: "category", label: "Categorie" },
              { key: "side", label: "Sens" },
            ]}
          />
          <tbody>
            {filteredAccounts.map((account) => (
              <tr key={account.code}>
                <td style={{ ...tableCellStyle, color: WASI_THEME.accent }}>
                  {account.code}
                </td>
                <td style={tableCellStyle}>{account.label}</td>
                <td style={tableCellStyle}>
                  {account.classNumber} - {account.classLabel}
                </td>
                <td style={{ ...tableCellStyle, color: WASI_THEME.textMuted }}>
                  {account.category}
                </td>
                <td style={tableCellStyle}>{account.normalSide}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionBlock>
  );

  const renderJournal = () => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1.15fr 1fr",
        gap: 16,
      }}
    >
      <SectionBlock
        title="Saisie du journal"
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={resetJournalForm}
              style={sharedSecondaryButtonStyle}
            >
              Reinitialiser
            </button>
            <button
              type="button"
              onClick={submitJournalEntry}
              style={sharedPrimaryButtonStyle}
              disabled={submitting}
            >
              {submitting ? "Posting..." : "Poster l'ecriture"}
            </button>
          </div>
        }
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr 1fr",
            gap: 10,
          }}
        >
          <div>
            <label style={formLabelStyle}>Reference</label>
            <input
              value={journalForm.reference}
              onChange={(event) => updateJournalForm("reference", event.target.value)}
              placeholder="Auto si vide"
              style={formInputStyle}
            />
          </div>
          <div>
            <label style={formLabelStyle}>Journal</label>
            <select
              value={journalForm.journalCode}
              onChange={(event) => updateJournalForm("journalCode", event.target.value)}
              style={formInputStyle}
            >
              {JOURNAL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={formLabelStyle}>Module source</label>
            <select
              value={journalForm.moduleSource}
              onChange={(event) => updateJournalForm("moduleSource", event.target.value)}
              style={formInputStyle}
            >
              {MODULE_SOURCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={formLabelStyle}>Date</label>
            <input
              type="date"
              value={journalForm.entryDate}
              onChange={(event) => updateJournalForm("entryDate", event.target.value)}
              style={formInputStyle}
            />
          </div>
        </div>

        <div>
          <label style={formLabelStyle}>Libelle de piece</label>
          <input
            value={journalForm.description}
            onChange={(event) => updateJournalForm("description", event.target.value)}
            placeholder="Ex: Facture client mars 2026"
            style={formInputStyle}
          />
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {journalForm.lines.map((line, index) => (
            <div
              key={`journal-line-${index}`}
              style={{
                ...metricCardStyle,
                display: "grid",
                gridTemplateColumns: "1.2fr 1.1fr 0.8fr 0.8fr auto",
                gap: 10,
                alignItems: "end",
              }}
            >
              <div>
                <label style={formLabelStyle}>Compte</label>
                <select
                  value={line.accountCode}
                  onChange={(event) =>
                    updateJournalLine(index, "accountCode", event.target.value)
                  }
                  style={formInputStyle}
                >
                  <option value="">Selectionner...</option>
                  {(chart?.accounts || []).map((account) => (
                    <option key={account.code} value={account.code}>
                      {account.code} - {account.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={formLabelStyle}>Libelle ligne</label>
                <input
                  value={line.lineLabel}
                  onChange={(event) =>
                    updateJournalLine(index, "lineLabel", event.target.value)
                  }
                  placeholder="Libelle auto si vide"
                  style={formInputStyle}
                />
              </div>
              <div>
                <label style={formLabelStyle}>Debit XOF</label>
                <input
                  value={line.debit}
                  onChange={(event) =>
                    updateJournalLine(index, "debit", event.target.value)
                  }
                  placeholder="0"
                  style={formInputStyle}
                />
              </div>
              <div>
                <label style={formLabelStyle}>Credit XOF</label>
                <input
                  value={line.credit}
                  onChange={(event) =>
                    updateJournalLine(index, "credit", event.target.value)
                  }
                  placeholder="0"
                  style={formInputStyle}
                />
              </div>
              <button
                type="button"
                onClick={() => removeJournalLine(index)}
                style={{
                  ...sharedSecondaryButtonStyle,
                  opacity: journalForm.lines.length <= 2 ? 0.45 : 1,
                }}
                disabled={journalForm.lines.length <= 2}
              >
                Retirer
              </button>
            </div>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <button type="button" onClick={addJournalLine} style={sharedSecondaryButtonStyle}>
            Ajouter une ligne
          </button>
          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              color: journalTotals.isBalanced
                ? WASI_THEME.success
                : WASI_THEME.warning,
            }}
          >
            <span>Debit {formatXofFromCentimes(journalTotals.totalDebitCentimes.toString())}</span>
            <span>Credit {formatXofFromCentimes(journalTotals.totalCreditCentimes.toString())}</span>
            <span>{journalTotals.isBalanced ? "Equilibree" : "A equilibrer"}</span>
          </div>
        </div>

        {journalError ? (
          <div style={{ ...metricCardStyle, color: WASI_THEME.danger }}>
            {journalError}
          </div>
        ) : null}
        {successMessage ? (
          <div style={{ ...metricCardStyle, color: WASI_THEME.success }}>
            {successMessage}
          </div>
        ) : null}
      </SectionBlock>

      <SectionBlock title="Journal general">
        <div style={{ display: "grid", gap: 10 }}>
          {journal.map((entry) => (
            <article key={entry.id} style={metricCardStyle}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ color: WASI_THEME.accent, fontWeight: 700 }}>
                    {entry.reference}
                  </div>
                  <div style={{ marginTop: 4 }}>{entry.description}</div>
                </div>
                <div style={{ textAlign: "right", color: WASI_THEME.textMuted }}>
                  <div>
                    {entry.journalCode} / {entry.moduleSource}
                  </div>
                  <div style={{ marginTop: 4 }}>
                    {formatDateTime(entry.entryDateUtc)}
                  </div>
                </div>
              </div>
              <div style={{ display: "grid", gap: 4, marginTop: 10 }}>
                {(entry.lines || []).map((line, lineIndex) => (
                  <div
                    key={`${entry.id}-${line.accountCode}-${lineIndex}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "110px 1fr 150px",
                      gap: 10,
                      fontSize: 12,
                    }}
                  >
                    <span style={{ color: WASI_THEME.info }}>{line.accountCode}</span>
                    <span>{line.lineLabel}</span>
                    <span style={{ textAlign: "right", color: WASI_THEME.textMuted }}>
                      {line.debitCentimes !== "0"
                        ? `D ${formatXofFromCentimes(line.debitCentimes)}`
                        : `C ${formatXofFromCentimes(line.creditCentimes)}`}
                    </span>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </SectionBlock>
    </div>
  );

  const renderLedger = () => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "340px 1fr",
        gap: 16,
      }}
    >
      <SectionBlock title="Choix du compte">
        <div style={{ display: "grid", gap: 10 }}>
          <input
            type="text"
            value={accountQuery}
            onChange={(event) => setAccountQuery(event.target.value)}
            placeholder="Filtrer les comptes..."
            style={formInputStyle}
          />
          <div
            style={{
              maxHeight: 540,
              overflowY: "auto",
              display: "grid",
              gap: 8,
            }}
          >
            {filteredAccounts.map((account) => (
              <button
                key={account.code}
                type="button"
                onClick={() => setSelectedLedgerAccount(account.code)}
                style={{
                  ...metricCardStyle,
                  textAlign: "left",
                  cursor: "pointer",
                  borderColor:
                    account.code === selectedLedgerAccount
                      ? WASI_THEME.accent
                      : WASI_THEME.border,
                  background:
                    account.code === selectedLedgerAccount
                      ? "rgba(200,146,42,0.14)"
                      : metricCardStyle.background,
                }}
              >
                <div style={{ color: WASI_THEME.accent, fontWeight: 700 }}>
                  {account.code}
                </div>
                <div style={{ marginTop: 4 }}>{account.label}</div>
                <div style={{ marginTop: 6, color: WASI_THEME.textMuted, fontSize: 12 }}>
                  {account.classLabel} / {account.category}
                </div>
              </button>
            ))}
          </div>
        </div>
      </SectionBlock>

      <SectionBlock
        title="Grand livre"
        actions={
          ledger?.account ? (
            <div style={{ color: WASI_THEME.textMuted, fontSize: 12 }}>
              {ledger.account.code} / {ledger.account.label}
            </div>
          ) : null
        }
      >
        {ledgerLoading ? (
          <div style={metricCardStyle}>Chargement du grand livre...</div>
        ) : null}
        {ledger ? (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 10,
              }}
            >
              <MetricCard
                label="Total debit"
                value={formatXofFromCentimes(ledger.totals.totalDebitCentimes)}
                tone={WASI_THEME.success}
              />
              <MetricCard
                label="Total credit"
                value={formatXofFromCentimes(ledger.totals.totalCreditCentimes)}
                tone={WASI_THEME.danger}
              />
              <MetricCard
                label="Solde final"
                value={formatXofFromCentimes(ledger.totals.closingBalanceCentimes)}
                tone={
                  ledger.totals.closingBalanceSide === "DEBIT"
                    ? WASI_THEME.success
                    : ledger.totals.closingBalanceSide === "CREDIT"
                      ? WASI_THEME.danger
                      : WASI_THEME.textPrimary
                }
                hint={ledger.totals.closingBalanceSide}
              />
              <MetricCard
                label="Mouvements"
                value={String(ledger.totals.entryCount)}
                tone={WASI_THEME.info}
              />
            </div>

            <div style={tableContainerStyle}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <TableHeader
                  columns={[
                    { key: "date", label: "Date" },
                    { key: "ref", label: "Piece" },
                    { key: "journal", label: "Journal" },
                    { key: "libelle", label: "Libelle" },
                    { key: "contrepartie", label: "Contrepartie" },
                    { key: "debit", label: "Debit", align: "right" },
                    { key: "credit", label: "Credit", align: "right" },
                    { key: "solde", label: "Solde", align: "right" },
                  ]}
                />
                <tbody>
                  {ledger.entries.map((entry) => (
                    <tr key={`${entry.entryId}-${entry.reference}-${entry.lineLabel}`}>
                      <td style={tableCellStyle}>{formatDateTime(entry.entryDateUtc)}</td>
                      <td style={{ ...tableCellStyle, color: WASI_THEME.accent }}>
                        {entry.reference}
                      </td>
                      <td style={tableCellStyle}>{entry.journalCode}</td>
                      <td style={tableCellStyle}>
                        <div>{entry.lineLabel}</div>
                        <div style={{ color: WASI_THEME.textMuted, fontSize: 12 }}>
                          {entry.description}
                        </div>
                      </td>
                      <td style={{ ...tableCellStyle, color: WASI_THEME.textMuted }}>
                        {entry.counterpartSummary || "--"}
                      </td>
                      <td style={{ ...tableCellStyle, textAlign: "right" }}>
                        {formatXofFromCentimes(entry.debitCentimes)}
                      </td>
                      <td style={{ ...tableCellStyle, textAlign: "right" }}>
                        {formatXofFromCentimes(entry.creditCentimes)}
                      </td>
                      <td
                        style={{
                          ...tableCellStyle,
                          textAlign: "right",
                          color:
                            entry.runningBalanceSide === "DEBIT"
                              ? WASI_THEME.success
                              : entry.runningBalanceSide === "CREDIT"
                                ? WASI_THEME.danger
                                : WASI_THEME.textMuted,
                        }}
                      >
                        {formatXofFromCentimes(entry.runningBalanceCentimes)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </SectionBlock>
    </div>
  );

  const renderTrialBalance = () => (
    <SectionBlock
      title="Balance generale"
      actions={
        trialBalance ? (
          <div
            style={{
              color: trialBalance.totals?.isBalanced
                ? WASI_THEME.success
                : WASI_THEME.danger,
            }}
          >
            {trialBalance.totals?.isBalanced ? "Debit = Credit" : "Ecart detecte"}
          </div>
        ) : null
      }
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 10,
        }}
      >
        <MetricCard
          label="Total debit"
          value={formatXofFromCentimes(trialBalance?.totals?.totalDebitCentimes ?? "0")}
          tone={WASI_THEME.success}
        />
        <MetricCard
          label="Total credit"
          value={formatXofFromCentimes(trialBalance?.totals?.totalCreditCentimes ?? "0")}
          tone={WASI_THEME.danger}
        />
      </div>

      <div style={tableContainerStyle}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <TableHeader
            columns={[
              { key: "code", label: "Compte" },
              { key: "classe", label: "Classe" },
              { key: "label", label: "Libelle" },
              { key: "debit", label: "Total debit", align: "right" },
              { key: "credit", label: "Total credit", align: "right" },
              { key: "balance", label: "Solde", align: "right" },
            ]}
          />
          <tbody>
            {(trialBalance?.rows || []).map((row) => (
              <tr key={row.code}>
                <td style={{ ...tableCellStyle, color: WASI_THEME.accent }}>
                  {row.code}
                </td>
                <td style={tableCellStyle}>{row.classNumber}</td>
                <td style={tableCellStyle}>{row.label}</td>
                <td style={{ ...tableCellStyle, textAlign: "right" }}>
                  {formatXofFromCentimes(row.totalDebitCentimes)}
                </td>
                <td style={{ ...tableCellStyle, textAlign: "right" }}>
                  {formatXofFromCentimes(row.totalCreditCentimes)}
                </td>
                <td
                  style={{
                    ...tableCellStyle,
                    textAlign: "right",
                    color:
                      row.balanceSide === "DEBIT"
                        ? WASI_THEME.success
                        : row.balanceSide === "CREDIT"
                          ? WASI_THEME.danger
                          : WASI_THEME.textMuted,
                  }}
                >
                  {row.balanceSide} {formatXofFromCentimes(row.balanceCentimes)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionBlock>
  );

  const renderBalanceSheet = () => (
    <SectionBlock
      title="Bilan SYSCOHADA"
      actions={
        statements?.balanceSheet?.totals ? (
          <div
            style={{
              color: statements.balanceSheet.totals.isBalanced
                ? WASI_THEME.success
                : WASI_THEME.warning,
            }}
          >
            {statements.balanceSheet.totals.isBalanced
              ? "Actif = Passif"
              : `Ecart ${formatSignedXofFromCentimes(
                  statements.balanceSheet.totals.differenceCentimes
                )}`}
          </div>
        ) : null
      }
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
        }}
      >
        <article style={getPanelStyle()}>
          <h3 style={sectionTitleStyle}>Actif</h3>
          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            {(statements?.balanceSheet?.actif || []).map((row) => (
              <div key={row.code} style={metricCardStyle}>
                <div style={{ color: WASI_THEME.textMuted, fontSize: 12 }}>
                  {row.label}
                </div>
                <div style={{ marginTop: 8, color: WASI_THEME.textPrimary }}>
                  {formatSignedXofFromCentimes(row.amountCentimes)}
                </div>
                {row.detail ? (
                  <div style={{ marginTop: 8, color: WASI_THEME.textMuted, fontSize: 12 }}>
                    Brut {formatXofFromCentimes(row.detail.grossCentimes)} / Correctifs{" "}
                    {formatXofFromCentimes(row.detail.depreciationCentimes)}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </article>

        <article style={getPanelStyle()}>
          <h3 style={sectionTitleStyle}>Passif</h3>
          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            {(statements?.balanceSheet?.passif || []).map((row) => (
              <div key={row.code} style={metricCardStyle}>
                <div style={{ color: WASI_THEME.textMuted, fontSize: 12 }}>
                  {row.label}
                </div>
                <div style={{ marginTop: 8, color: WASI_THEME.textPrimary }}>
                  {formatSignedXofFromCentimes(row.amountCentimes)}
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 10,
        }}
      >
        <MetricCard
          label="Total actif"
          value={formatXofFromCentimes(
            statements?.balanceSheet?.totals?.totalActifCentimes ?? "0"
          )}
          tone={WASI_THEME.success}
        />
        <MetricCard
          label="Total passif"
          value={formatXofFromCentimes(
            statements?.balanceSheet?.totals?.totalPassifCentimes ?? "0"
          )}
          tone={WASI_THEME.info}
        />
      </div>
    </SectionBlock>
  );

  const renderIncomeStatement = () => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1.15fr 1fr",
        gap: 16,
      }}
    >
      <SectionBlock title="Compte de resultat">
        <div style={tableContainerStyle}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <TableHeader
              columns={[
                { key: "code", label: "Code" },
                { key: "label", label: "Poste" },
                { key: "amount", label: "Montant", align: "right" },
              ]}
            />
            <tbody>
              {(statements?.incomeStatement?.rows || []).map((row) => (
                <tr key={row.code}>
                  <td style={{ ...tableCellStyle, color: WASI_THEME.accent }}>
                    {row.code}
                  </td>
                  <td style={tableCellStyle}>{row.label}</td>
                  <td
                    style={{
                      ...tableCellStyle,
                      textAlign: "right",
                      color:
                        row.code === "RN"
                          ? BigInt(row.amountCentimes) >= 0n
                            ? WASI_THEME.success
                            : WASI_THEME.danger
                          : WASI_THEME.textPrimary,
                    }}
                  >
                    {formatSignedXofFromCentimes(row.amountCentimes)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionBlock>

      <SectionBlock title="SIG et fiscalite">
        <div style={{ display: "grid", gap: 10 }}>
          <MetricCard
            label="Marge brute"
            value={formatSignedXofFromCentimes(
              statements?.incomeStatement?.aggregates?.grossMarginCentimes ?? "0"
            )}
            tone={WASI_THEME.success}
          />
          <MetricCard
            label="Valeur ajoutee"
            value={formatSignedXofFromCentimes(
              statements?.incomeStatement?.aggregates?.valueAddedCentimes ?? "0"
            )}
            tone={WASI_THEME.info}
          />
          <MetricCard
            label="EBE"
            value={formatSignedXofFromCentimes(
              statements?.incomeStatement?.aggregates?.ebeCentimes ?? "0"
            )}
            tone={WASI_THEME.accent}
          />
          <MetricCard
            label="Resultat ordinaire avant impot"
            value={formatSignedXofFromCentimes(
              statements?.incomeStatement?.aggregates
                ?.ordinaryResultBeforeTaxCentimes ?? "0"
            )}
            tone={WASI_THEME.textPrimary}
          />
          <MetricCard
            label="TVA a payer"
            value={formatXofFromCentimes(statements?.tax?.vatDueCentimes ?? "0")}
            tone={WASI_THEME.warning}
          />
          <MetricCard
            label="Provision IS"
            value={formatXofFromCentimes(
              statements?.tax?.directTaxProvisionCentimes ?? "0"
            )}
            tone={WASI_THEME.danger}
          />
        </div>
      </SectionBlock>
    </div>
  );

  return (
    <main style={getAppShellStyle()}>
      <section
        style={{
          ...getPanelStyle(),
          maxWidth: 1480,
          margin: "0 auto",
          display: "grid",
          gap: 16,
        }}
      >
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 46,
                letterSpacing: 2,
                color: WASI_THEME.accent,
              }}
            >
              OHADA-COMPTA
            </h1>
            <p style={{ margin: "6px 0 0", color: WASI_THEME.textMuted }}>
              Workspace comptable SYSCOHADA relie a Banking, WASI, AfriTrade, AfriTax et ETF DEX.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span
              style={{
                border: `1px solid ${
                  hasBankingSession ? WASI_THEME.success : WASI_THEME.warning
                }`,
                color: hasBankingSession
                  ? WASI_THEME.success
                  : WASI_THEME.warning,
                borderRadius: 999,
                padding: "6px 10px",
                fontSize: 12,
                letterSpacing: 1,
              }}
            >
              {hasBankingSession ? "SESSION CONNECTEE" : "LOGIN BANKING REQUIS"}
            </span>
            <button type="button" onClick={loadWorkspace} style={sharedSecondaryButtonStyle}>
              Actualiser
            </button>
          </div>
        </header>

        <section
          style={{
            border: `1px solid ${WASI_THEME.border}`,
            borderRadius: 12,
            background: WASI_THEME.panelBackgroundSoft,
            padding: 14,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
            gap: 10,
          }}
        >
          <BridgeButton label="Ouvrir WASI Terminal" onClick={() => openModule("wasi")} />
          <BridgeButton label="Ouvrir AfriTrade" onClick={() => openModule("afritrade")} />
          <BridgeButton label="Ouvrir AfriTax" onClick={() => openModule("afritax")} />
          <BridgeButton label="Ouvrir Banking" onClick={() => openModule("banking")} subtle />
          <BridgeButton label="Ouvrir ETF DEX" onClick={() => openModule("dex")} subtle />
          <BridgeButton label="Ouvrir Finance Lab" onClick={() => openModule("finance")} subtle />
        </section>

        {!hasBankingSession ? (
          <section style={{ ...metricCardStyle, color: WASI_THEME.warning }}>
            Connectez-vous d'abord dans Banking pour charger le grand livre, la balance, le bilan et le pont fiscal.
          </section>
        ) : null}

        {error ? (
          <section style={{ ...metricCardStyle, color: WASI_THEME.danger }}>
            Erreur Compta: {error}
          </section>
        ) : null}

        {loading ? (
          <section style={metricCardStyle}>Chargement du workspace comptable...</section>
        ) : null}

        {!loading && hasBankingSession && chart ? (
          <>
            <section
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              {TAB_LABELS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  style={tabButtonStyle(activeTab === tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </section>

            {activeTab === TAB_OVERVIEW ? renderOverview() : null}
            {activeTab === TAB_CHART ? renderChart() : null}
            {activeTab === TAB_JOURNAL ? renderJournal() : null}
            {activeTab === TAB_LEDGER ? renderLedger() : null}
            {activeTab === TAB_BALANCE ? renderTrialBalance() : null}
            {activeTab === TAB_BILAN ? renderBalanceSheet() : null}
            {activeTab === TAB_RESULT ? renderIncomeStatement() : null}
          </>
        ) : null}
      </section>
    </main>
  );
};
