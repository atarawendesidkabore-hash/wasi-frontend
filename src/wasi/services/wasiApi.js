import { resolvePlatformApiBaseUrl } from "../../platform/apiResolver";

// WASI backend API helpers
export const BACKEND_API_URL = resolvePlatformApiBaseUrl();

const unwrapData = (payload) => (payload && typeof payload === "object" && "data" in payload ? payload.data : payload);
const SNAPSHOT_TAG = "snapshot";

const toDataMode = (source) => {
  const normalized = String(source || "").toLowerCase();
  if (normalized.includes(SNAPSHOT_TAG)) return "snapshot";
  if (normalized.includes("live") || normalized.includes("realtime")) return "live";
  return "unknown";
};

const normalizeTransportMode = (mode) => {
  const rawIndex =
    mode?.index ?? mode?.score ?? (typeof mode === "number" ? mode : null);
  const index = Number(rawIndex);
  return {
    index: Number.isFinite(index) ? index : null,
    trend: mode?.trend || "UNKNOWN",
    source: mode?.source || null,
    quality: mode?.quality || null,
  };
};

/**
 * Normalize transport comparison payloads across legacy/new backend formats.
 * @param {unknown} payload
 * @param {string} countryCode
 * @returns {{
 * country_code: string,
 * transport_composite: number|null,
 * country_profile: string,
 * profile_weights: Record<string, number>|null,
 * effective_weights: Record<string, number>|null,
 * modes: {
 * maritime: {index:number|null,trend:string,source:string|null,quality:string|null},
 * air: {index:number|null,trend:string,source:string|null,quality:string|null},
 * rail: {index:number|null,trend:string,source:string|null,quality:string|null},
 * road: {index:number|null,trend:string,source:string|null,quality:string|null},
 * },
 * source: string,
 * data_mode: string,
 * timestamp: string|null,
 * last_updated: string|null,
 * methodology_version: string|null,
 * source_note: string|null,
 * }|null}
 */
export const normalizeTransportComparison = (payload, countryCode) => {
  const data = unwrapData(payload);
  if (!data || typeof data !== "object") return null;

  const fallbackModes = {
    maritime: data.maritime,
    air: data.air,
    rail: data.rail,
    road: data.road,
  };

  const rawModes =
    data.modes && typeof data.modes === "object" ? data.modes : fallbackModes;

  const transportCompositeRaw =
    data.transport_composite ?? data.composite ?? data.index ?? null;
  const transportComposite = Number(transportCompositeRaw);

  const normalizedCountryCode = String(
    data.country_code || countryCode || ""
  ).toUpperCase();
  const profileWeights =
    data.profile_weights && typeof data.profile_weights === "object"
      ? data.profile_weights
      : null;

  return {
    country_code: normalizedCountryCode,
    transport_composite: Number.isFinite(transportComposite)
      ? transportComposite
      : null,
    country_profile: String(data.country_profile || data.profile || "UNKNOWN"),
    profile_weights: profileWeights,
    effective_weights:
      (data.effective_weights && typeof data.effective_weights === "object"
        ? data.effective_weights
        : profileWeights) || null,
    modes: {
      maritime: normalizeTransportMode(rawModes?.maritime),
      air: normalizeTransportMode(rawModes?.air),
      rail: normalizeTransportMode(rawModes?.rail),
      road: normalizeTransportMode(rawModes?.road),
    },
    source: String(data.source || "unknown"),
    data_mode: data.data_mode || toDataMode(data.source),
    timestamp: data.timestamp || null,
    last_updated: data.last_updated || data.timestamp || null,
    methodology_version: data.methodology_version || null,
    source_note: data.source_note || null,
  };
};

// Fetch real indices from backend; returns { code: indexValue } map or null on failure
export async function fetchBackendIndices(token) {
  if (!token) return null;
  try {
    const res = await fetch(`${BACKEND_API_URL}/api/indices/latest`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = unwrapData(await res.json());
    return {
      indices: data.indices || null,
      source: data.source || "unknown",
      timestamp: data.timestamp || null,
      dataMode: data.data_mode || toDataMode(data.source),
    };
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
    const data = unwrapData(await res.json());
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
    const data = unwrapData(await res.json());
    if (Array.isArray(data)) {
      return {
        markets: data,
        source: "unknown",
        timestamp: null,
        dataMode: "unknown",
      };
    }
    return {
      markets: data.markets || [],
      source: data.source || "unknown",
      timestamp: data.timestamp || null,
      dataMode: data.data_mode || toDataMode(data.source),
    };
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
    return unwrapData(await res.json());
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
    const data = unwrapData(await res.json());
    const map = {};
    (data.signals || []).forEach((signal) => {
      map[signal.country_code] = signal;
    });
    return {
      signals: map,
      source: data.source || "unknown",
      timestamp: data.timestamp || null,
      dataMode: data.data_mode || toDataMode(data.source),
    };
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
    const data = unwrapData(await res.json());
    return {
      events: data.events || [],
      source: data.source || "unknown",
      timestamp: data.timestamp || null,
      dataMode: data.data_mode || toDataMode(data.source),
    };
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
    return unwrapData(await res.json());
  } catch (_) {
    return null;
  }
}

// Fetch transport mode comparison (road/air/rail/maritime)
export async function fetchTransportComparison(token, countryCode) {
  if (!token || !countryCode) return null;
  try {
    const res = await fetch(
      `${BACKEND_API_URL}/api/v2/transport/mode-comparison/${encodeURIComponent(
        String(countryCode).toUpperCase()
      )}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (!res.ok) return null;
    const payload = await res.json();
    return normalizeTransportComparison(payload, countryCode);
  } catch (_) {
    return null;
  }
}

// Fetch commodity spot prices (expanded WASI commodity universe)

export async function fetchCommodityPrices(token) {
  if (!token) return null;
  try {
    const res = await fetch(`${BACKEND_API_URL}/api/v2/data/commodities/latest?limit=200`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = unwrapData(await res.json());
    return {
      prices: data.prices || [],
      source: data.source || "unknown",
      timestamp: data.timestamp || null,
      dataMode: data.data_mode || toDataMode(data.source),
    };
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
    return unwrapData(await res.json());
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
    return unwrapData(await res.json());
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
    return unwrapData(await res.json());
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
    return unwrapData(await res.json());
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
