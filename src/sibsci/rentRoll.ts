import Decimal from "decimal.js";
import {
  Payment,
  Property,
  RentRollLine,
  RentRollReport,
  SecMonthLine,
  SecPackage,
  Tenant,
  Unit,
} from "./types";

const MONTHS_IN_YEAR = 12;
const PERCENT_MULTIPLIER = 100;
const RENT_DUE_DAY_UTC = 5;
const DEFAULT_SECURITIZATION_MONTHS = 12;
const BASE_COLLECTION_RATE_PCT = 92;
const COLLECTION_RATE_STEP_PCT = 0.25;
const MIN_COLLECTION_RATE_PCT = 85;

/**
 * Generate rent roll report (expected vs actual vs variance) for each unit in a month.
 */
export function generateRentRoll(
  properties: Property[],
  payments: Payment[],
  month: Date
): RentRollReport {
  const start = utcMonthStart(month);
  const end = utcMonthEnd(month);

  const lines: RentRollLine[] = [];

  for (const property of properties) {
    for (const unit of property.units) {
      const expectedRentCentimes = isUnitRentableInMonth(unit, start, end) ? unit.monthlyRent : 0n;

      const actualRentCentimes = payments
        .filter(
          (payment) =>
            payment.unitId === unit.id &&
            payment.type === "RENT" &&
            isSameUtcMonth(payment.date, month)
        )
        .reduce((sum, payment) => sum + payment.amount, 0n);

      lines.push({
        propertyId: property.id,
        unitId: unit.id,
        status: unit.status,
        expectedRentCentimes,
        actualRentCentimes,
        varianceCentimes: actualRentCentimes - expectedRentCentimes,
      });
    }
  }

  const totalExpectedRentCentimes = lines.reduce(
    (sum, line) => sum + line.expectedRentCentimes,
    0n
  );
  const totalActualRentCentimes = lines.reduce((sum, line) => sum + line.actualRentCentimes, 0n);

  return {
    period: `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`,
    totalExpectedRentCentimes,
    totalActualRentCentimes,
    totalVarianceCentimes: totalActualRentCentimes - totalExpectedRentCentimes,
    lines,
  };
}

/**
 * Calculate gross portfolio yield percentage from annual rents over annual rent potential.
 */
export function calculatePortfolioYield(properties: Property[], annualRents: bigint): number {
  if (annualRents < 0n) {
    throw new Error("annualRents must be non-negative");
  }

  const annualPotential = properties
    .flatMap((property) => property.units)
    .filter((unit) => unit.monthlyRent > 0n)
    .reduce((sum, unit) => sum + unit.monthlyRent * BigInt(MONTHS_IN_YEAR), 0n);

  if (annualPotential === 0n) {
    return 0;
  }

  return new Decimal(annualRents.toString())
    .div(annualPotential.toString())
    .mul(PERCENT_MULTIPLIER)
    .toDecimalPlaces(2)
    .toNumber();
}

/**
 * Identify occupied units with insufficient rent paid by the cutoff date.
 */
export function identifyLatePayments(
  units: Unit[],
  payments: Payment[],
  cutoffDate: Date
): Unit[] {
  if (cutoffDate.getUTCDate() < RENT_DUE_DAY_UTC) {
    return [];
  }

  const monthStart = utcMonthStart(cutoffDate);
  const monthEnd = utcMonthEnd(cutoffDate);

  return units.filter((unit) => {
    if (!isUnitRentableInMonth(unit, monthStart, monthEnd)) {
      return false;
    }

    const paidRent = payments
      .filter(
        (payment) =>
          payment.unitId === unit.id &&
          payment.type === "RENT" &&
          isSameUtcMonth(payment.date, cutoffDate) &&
          payment.date.getTime() <= cutoffDate.getTime()
      )
      .reduce((sum, payment) => sum + payment.amount, 0n);

    return paidRent < unit.monthlyRent;
  });
}

/**
 * Generate a UEMOA-formatted receivables package for securitization.
 */
export function generateSecuritizationPackage(
  properties: Property[],
  months: number = DEFAULT_SECURITIZATION_MONTHS
): SecPackage {
  if (!Number.isInteger(months) || months < 1) {
    throw new Error("months must be a positive integer");
  }

  const units = properties.flatMap((property) => property.units);
  const occupiedUnits = units.filter((unit) => unit.status === "OCCUPIED" && unit.tenant);

  const monthlyReceivable = occupiedUnits.reduce((sum, unit) => sum + unit.monthlyRent, 0n);

  const occupancyRatePct =
    units.length === 0
      ? 0
      : new Decimal(occupiedUnits.length)
          .div(units.length)
          .mul(PERCENT_MULTIPLIER)
          .toDecimalPlaces(2)
          .toNumber();

  const weightedAverageMonthlyRentCentimes =
    occupiedUnits.length === 0
      ? 0n
      : toRoundedBigInt(new Decimal(monthlyReceivable.toString()).div(occupiedUnits.length));

  const baseMonth = utcMonthStart(new Date());

  const schedule: SecMonthLine[] = [];
  for (let i = 0; i < months; i += 1) {
    const periodDate = addUtcMonths(baseMonth, i);
    const period = `${periodDate.getUTCFullYear()}-${String(periodDate.getUTCMonth() + 1).padStart(
      2,
      "0"
    )}`;

    const projectedCollectionRatePct = Math.max(
      BASE_COLLECTION_RATE_PCT - i * COLLECTION_RATE_STEP_PCT,
      MIN_COLLECTION_RATE_PCT
    );

    const projectedCollectedCentimes = toRoundedBigInt(
      new Decimal(monthlyReceivable.toString())
        .mul(projectedCollectionRatePct)
        .div(PERCENT_MULTIPLIER)
    );

    schedule.push({
      period,
      expectedReceivableCentimes: monthlyReceivable,
      projectedCollectionRatePct: new Decimal(projectedCollectionRatePct)
        .toDecimalPlaces(2)
        .toNumber(),
      projectedCollectedCentimes,
    });
  }

  const totalExpectedReceivablesCentimes = monthlyReceivable * BigInt(months);
  const projectedCollectedReceivablesCentimes = schedule.reduce(
    (sum, line) => sum + line.projectedCollectedCentimes,
    0n
  );

  return {
    standard: "UEMOA_RECEIVABLES_V1",
    currency: "XOF",
    amountUnit: "CENTIMES",
    generatedAtUtc: new Date().toISOString(),
    months,
    totalUnits: units.length,
    occupiedUnits: occupiedUnits.length,
    occupancyRatePct,
    weightedAverageMonthlyRentCentimes,
    totalExpectedReceivablesCentimes,
    projectedCollectedReceivablesCentimes,
    schedule,
  };
}

function isUnitRentableInMonth(unit: Unit, monthStart: Date, monthEnd: Date): boolean {
  if (unit.status !== "OCCUPIED") {
    return false;
  }
  if (!unit.tenant || unit.monthlyRent <= 0n) {
    return false;
  }
  return isTenantActiveInMonth(unit.tenant, monthStart, monthEnd);
}

function isTenantActiveInMonth(tenant: Tenant, monthStart: Date, monthEnd: Date): boolean {
  return tenant.leaseStart.getTime() <= monthEnd.getTime() && tenant.leaseEnd.getTime() >= monthStart.getTime();
}

function utcMonthStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
}

function utcMonthEnd(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999));
}

function isSameUtcMonth(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();
}

function addUtcMonths(date: Date, monthsToAdd: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + monthsToAdd, 1, 0, 0, 0, 0));
}

function toRoundedBigInt(value: Decimal): bigint {
  return BigInt(value.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toString());
}
