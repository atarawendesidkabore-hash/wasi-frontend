import { WEST_AFRICAN_COUNTRIES } from "../config/wasiData";

export function generateIndices() {
  return { CI: 78, NG: 82, GH: 71, SN: 65, BF: 52, ML: 48, GN: 61, BJ: 58, TG: 63, NE: 44, MR: 55, GW: 41, SL: 46, LR: 49, GM: 39, CV: 57 };
}

export function calcWASI(indices) {
  return Math.round(WEST_AFRICAN_COUNTRIES.reduce((sum, country) => sum + (indices[country.code] || 50) * country.weight, 0));
}
