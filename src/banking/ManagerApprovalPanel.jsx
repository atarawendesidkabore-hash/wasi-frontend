import React, { useState } from "react";
import { CheckCircle, RefreshCw, ShieldAlert, XCircle } from "lucide-react";

const formatApprovalAmount = (amountCentimes) => {
  const raw = Number(amountCentimes || 0) / 100;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XOF",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(raw);
};

const formatDecisionDate = (value) => {
  if (!value) return "En attente";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const toneByStatus = {
  PENDING: "bg-amber-50 text-amber-900 border-amber-200",
  APPROVED: "bg-emerald-50 text-emerald-900 border-emerald-200",
  REJECTED: "bg-rose-50 text-rose-900 border-rose-200",
};

export const ManagerApprovalPanel = ({
  approvals = [],
  currentStatus = "PENDING",
  onStatusChange,
  onRefresh,
  onApprove,
  onReject,
  loading = false,
  actionApprovalId = null,
  error = "",
}) => {
  const [decisionNotes, setDecisionNotes] = useState({});

  const updateDecisionNote = (approvalId, value) => {
    setDecisionNotes((previous) => ({
      ...previous,
      [approvalId]: value,
    }));
  };

  const readDecisionNote = (approvalId, fallback) => {
    const candidate = String(decisionNotes[approvalId] || "").trim();
    return candidate || fallback;
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-600" />
              <h2 className="font-bold text-slate-900">File d'approbation manager</h2>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Validez les operations sensibles initiees par les tellers avant execution.
            </p>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Actualiser
          </button>
        </div>

        <div className="mt-4 flex gap-2">
          {["PENDING", "APPROVED", "REJECTED"].map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => onStatusChange?.(status)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                currentStatus === status
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        {error ? (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </div>
        ) : null}
      </div>

      {approvals.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-6 text-center text-slate-500">
          {loading
            ? "Chargement des approbations..."
            : "Aucune operation ne correspond a ce statut pour le moment."}
        </div>
      ) : null}

      {approvals.map((approval) => {
        const busy = actionApprovalId === approval.id;
        const notePlaceholder =
          approval.status === "REJECTED"
            ? "Motif de rejet"
            : "Note de decision manager";
        const detailLabel =
          approval.operationType === "TRANSFER"
            ? `${approval.fromAccountId} -> ${approval.toAccountId}`
            : approval.accountId || "Compte non renseigne";

        return (
          <div key={approval.id} className="bg-white rounded-xl shadow-sm p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900">
                    {approval.operationType}
                  </span>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                      toneByStatus[approval.status] || toneByStatus.PENDING
                    }`}
                  >
                    {approval.status}
                  </span>
                </div>
                <p className="text-sm text-slate-500 mt-1">
                  Creee le {formatDecisionDate(approval.createdAtUtc)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-slate-900">
                  {formatApprovalAmount(approval.amountCentimes)}
                </p>
                <p className="text-xs text-slate-500">{detailLabel}</p>
              </div>
            </div>

            <div className="grid gap-2 text-sm text-slate-600">
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <span className="font-medium text-slate-800">Initie par:</span>{" "}
                {approval.initiatedByUsername || "Utilisateur inconnu"} ({approval.initiatedByRole || "N/A"})
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <span className="font-medium text-slate-800">Description:</span>{" "}
                {approval.description || "Sans description"}
              </div>
              {approval.approvedByUsername ? (
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <span className="font-medium text-slate-800">Decision par:</span>{" "}
                  {approval.approvedByUsername} le {formatDecisionDate(approval.decidedAtUtc)}
                </div>
              ) : null}
              {approval.decisionNote ? (
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <span className="font-medium text-slate-800">Note:</span>{" "}
                  {approval.decisionNote}
                </div>
              ) : null}
            </div>

            {approval.status === "PENDING" ? (
              <>
                <textarea
                  value={decisionNotes[approval.id] || ""}
                  onChange={(event) =>
                    updateDecisionNote(approval.id, event.target.value)
                  }
                  className="min-h-[84px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none"
                  placeholder={notePlaceholder}
                />
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      onApprove?.(
                        approval.id,
                        readDecisionNote(approval.id, "Approved from manager console")
                      )
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Approuver
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      onReject?.(
                        approval.id,
                        readDecisionNote(approval.id, "Rejected from manager console")
                      )
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-rose-300"
                  >
                    <XCircle className="w-4 h-4" />
                    Rejeter
                  </button>
                </div>
              </>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};
