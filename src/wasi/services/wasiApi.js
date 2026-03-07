// WASI backend API helpers
const _RENDER_URL = "https://wasi-backend-api.onrender.com";
const _LOCAL_URL = `${window.location.protocol}//${window.location.hostname}:8000`;
const _IS_LOCAL_HOST =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

export const BACKEND_API_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_WASI_API_URL) ||
  window.WASI_API_URL ||
  window.localStorage.getItem("WASI_API_URL") ||
  (_IS_LOCAL_HOST ? _LOCAL_URL : _RENDER_URL);

// Fetch real indices from backend; returns { code: indexValue } map or null on failure
export async function fetchBackendIndices(token) {
  if (!token) return null;
  try {
    const res = await fetch(`${BACKEND_API_URL}/api/indices/latest`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.indices || null;
  } catch (_) {
    return null;
  }
}

// Fetch live WASI composite from backend
export async function fetchBackendComposite(token) {
  if (!token) return null;
  try {
    const res = await fetch(`${BACKEND_API_URL}/api/indices/history?months=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.length > 0 ? data[0].composite_value : null;
  } catch (_) {
    return null;
  }
}

// Fetch stock market data (NGX, GSE, BRVM)
export async function fetchStockMarkets(token) {
  if (!token) return null;
  try {
    const res = await fetch(`${BACKEND_API_URL}/api/markets/latest`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (_) {
    return null;
  }
}

// Fetch market divergence signals
export async function fetchDivergence(token) {
  if (!token) return null;
  try {
    const res = await fetch(`${BACKEND_API_URL}/api/markets/divergence?lookback_months=3`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (_) {
    return null;
  }
}

// Fetch live signals (base + adjustment + adjusted index per country)
export async function fetchLiveSignals(token) {
  if (!token) return null;
  try {
    const res = await fetch(`${BACKEND_API_URL}/api/v2/signals/live`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    // Return a map of country_code → signal object
    const map = {};
    (data.signals || []).forEach(s => { map[s.country_code] = s; });
    return map;
  } catch (_) {
    return null;
  }
}

// Fetch active news events
export async function fetchNewsEvents(token) {
  if (!token) return null;
  try {
    const res = await fetch(`${BACKEND_API_URL}/api/v2/signals/events`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.events || [];
  } catch (_) {
    return null;
  }
}

export async function fetchBankContext(token, countryCode) {
  if (!token) return null;
  try {
    const res = await fetch(`${BACKEND_API_URL}/api/v2/bank/credit-context/${countryCode}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (_) {
    return null;
  }
}

// Fetch commodity spot prices (WB Pink Sheet — cocoa, brent, gold, cotton, coffee, iron ore)
export async function fetchCommodityPrices(token) {
  if (!token) return null;
  try {
    const res = await fetch(`${BACKEND_API_URL}/api/v2/data/commodities/latest`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.prices || [];
  } catch (_) {
    return null;
  }
}

// Fetch IMF WEO macro indicators for one country
export async function fetchMacroData(token, countryCode) {
  if (!token) return null;
  try {
    const res = await fetch(`${BACKEND_API_URL}/api/v2/data/macro/${countryCode}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (_) {
    return null;
  }
}
// Fetch USSD aggregate data (daily signals from MoMo, commodities, trade, ports)
export async function fetchUSSDAggregate(token) {
  if (!token) return null;
  try {
    const res = await fetch(`${BACKEND_API_URL}/api/ussd/aggregate/summary`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (_) {
    return null;
  }
}
// ─────────────────────────────────────────────────────────────────────────────

// 16 ECOWAS West African countries — weights match composite_engine.py exactly
// Primary 75%: NG 28% + CI 22% + GH 15% + SN 10%
// Secondary 18%: BF 4% + ML 4% + GN 4% + BJ 3% + TG 3%
// Tertiary 7%: NE 1% + MR 1% + GW 1% + SL 1% + LR 1% + GM 1% + CV 1%
// ── Government & Macroeconomic Advisory Knowledge Base ───────────────────────
export async function fetchHistoricalData(token) {
  if (!token) return null;
  try {
    const res = await fetch(`${BACKEND_API_URL}/api/country/CI/history?months=60`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (_) {
    return null;
  }
}

// Fetch 12-month index history for any country
export async function fetchCountryHistory(token, countryCode) {
  if (!token) return null;
  try {
    const res = await fetch(`${BACKEND_API_URL}/api/country/${countryCode}/history?months=12`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (_) {
    return null;
  }
}

// ---- Guardrailed v1 contracts (data-truth envelopes) -------------------------------------
export const DATA_MODES = {
  LIVE: "live",
  HISTORIQUE: "historique",
  ESTIMATION: "estimation",
};

const MISSING_REALTIME_DATA_MESSAGE = "Je n'ai pas cette donnée en temps réel";

function withDataLineage(payload, fallback) {
  return {
    ...payload,
    source: payload?.source || fallback.source,
    timestamp: payload?.timestamp || fallback.timestamp || new Date().toISOString(),
    data_mode: payload?.data_mode || fallback.data_mode || DATA_MODES.HISTORIQUE,
    confidence: typeof payload?.confidence === "number" ? payload.confidence : fallback.confidence ?? 0.5,
  };
}

export async function fetchFxRates(token, base = "XOF", symbols = ["EUR", "USD"]) {
  if (!token) return null;
  const query = `base=${encodeURIComponent(base)}&symbols=${encodeURIComponent(symbols.join(","))}`;
  try {
    const res = await fetch(`${BACKEND_API_URL}/v1/market/fx?${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const payload = await res.json();
    const safePayload = withDataLineage(payload, {
      source: "open.er-api.com",
      data_mode: DATA_MODES.LIVE,
      confidence: 0.85,
    });

    if (!Array.isArray(safePayload.rates) || safePayload.rates.length === 0) {
      return {
        ...safePayload,
        data_mode: DATA_MODES.HISTORIQUE,
        message: MISSING_REALTIME_DATA_MESSAGE,
      };
    }

    return safePayload;
  } catch (_) {
    return null;
  }
}

export async function postCreditDecision(token, requestBody) {
  if (!token) return null;
  try {
    const res = await fetch(`${BACKEND_API_URL}/v1/credit/decision`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(requestBody),
    });
    if (!res.ok) return null;
    const payload = await res.json();
    return {
      ...payload,
      human_review_required: true,
      disclaimer: "Advisory only. Décision finale = validation humaine",
    };
  } catch (_) {
    return null;
  }
}

export async function postFinancialAnalysis(token, requestBody) {
  if (!token) return null;
  try {
    const res = await fetch(`${BACKEND_API_URL}/v1/ai/financial-analysis`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(requestBody),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (_) {
    return null;
  }
}
