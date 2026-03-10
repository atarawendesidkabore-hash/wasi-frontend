import React from "react";
import { FileText, RefreshCw } from "lucide-react";

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const formatDetail = (detail) => {
  if (!detail) return "Aucun detail complementaire.";
  try {
    return JSON.stringify(detail, null, 2);
  } catch {
    return String(detail);
  }
};

export const ManagerAuditPanel = ({
  entries = [],
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
              <FileText className="w-5 h-5 text-slate-700" />
              <h2 className="font-bold text-slate-900">Journal d'audit manager</h2>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Tracez les decisions de controle interne et les evenements critiques Banking.
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

        {error ? (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </div>
        ) : null}
      </div>

      {entries.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-6 text-center text-slate-500">
          {loading ? "Chargement du journal d'audit..." : "Aucune entree d'audit disponible."}
        </div>
      ) : null}

      {entries.map((entry) => (
        <div key={entry.id} className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900">{entry.action}</span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                    entry.status === "SUCCESS"
                      ? "bg-emerald-50 text-emerald-800"
                      : "bg-rose-50 text-rose-800"
                  }`}
                >
                  {entry.status}
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-1">
                {entry.resourceType}
                {entry.resourceId ? ` • ${entry.resourceId}` : ""}
              </p>
            </div>
            <p className="text-xs text-slate-500">{formatDate(entry.createdAtUtc)}</p>
          </div>

          <div className="grid gap-2 text-sm text-slate-600">
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <span className="font-medium text-slate-800">Acteur:</span>{" "}
              {entry.actorUsername || "inconnu"} ({entry.actorRole || "N/A"})
            </div>
            <pre className="overflow-x-auto rounded-lg bg-slate-950 px-3 py-3 text-xs text-slate-100">
              {formatDetail(entry.detail)}
            </pre>
          </div>
        </div>
      ))}
    </div>
  );
};
