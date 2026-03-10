import React from "react";
import { Clock3, RefreshCw } from "lucide-react";

const toneByStatus = {
  PENDING: "bg-amber-50 text-amber-900 border-amber-200",
  APPROVED: "bg-emerald-50 text-emerald-900 border-emerald-200",
  REJECTED: "bg-rose-50 text-rose-900 border-rose-200",
};

const formatApprovalAmount = (amountCentimes) => {
  const raw = Number(amountCentimes || 0) / 100;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XOF",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(raw);
};

const formatDate = (value) => {
  if (!value) return "En attente";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

export const TellerApprovalPanel = ({
  approvals = [],
  currentStatus = "PENDING",
  onStatusChange,
  onRefresh,
  loading = false,
  error = "",
}) => {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Clock3 className="w-5 h-5 text-amber-600" />
              <h2 className="font-bold text-slate-900">Suivi teller des validations</h2>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Suivez les operations que vous avez initiees et leur statut de validation.
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
            ? "Chargement des validations..."
            : "Aucune operation a afficher pour ce statut."}
        </div>
      ) : null}

      {approvals.map((approval) => {
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
                  Creee le {formatDate(approval.createdAtUtc)}
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
                <span className="font-medium text-slate-800">Description:</span>{" "}
                {approval.description || "Sans description"}
              </div>
              {approval.approvedByUsername ? (
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <span className="font-medium text-slate-800">Decision manager:</span>{" "}
                  {approval.approvedByUsername} le {formatDate(approval.decidedAtUtc)}
                </div>
              ) : (
                <div className="rounded-lg bg-amber-50 px-3 py-2 text-amber-900">
                  En attente de validation manager.
                </div>
              )}
              {approval.decisionNote ? (
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <span className="font-medium text-slate-800">Note:</span>{" "}
                  {approval.decisionNote}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
};
