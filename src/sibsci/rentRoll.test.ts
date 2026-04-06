import {
  calculatePortfolioYield,
  generateRentRoll,
  generateSecuritizationPackage,
  identifyLatePayments,
} from "./rentRoll";
import { Payment, Property, Unit } from "./types";

const unit1: Unit = {
  id: "U1",
  surface_m2: 42,
  tenant: {
    name: "Tenant One",
    leaseStart: new Date("2026-01-01T00:00:00Z"),
    leaseEnd: new Date("2026-12-31T23:59:59Z"),
    depositPaid: 200_000n,
  },
  monthlyRent: 100_000n,
  status: "OCCUPIED",
};

const unit2: Unit = {
  id: "U2",
  surface_m2: 35,
  tenant: {
    name: "Tenant Two",
    leaseStart: new Date("2026-02-01T00:00:00Z"),
    leaseEnd: new Date("2026-12-31T23:59:59Z"),
    depositPaid: 150_000n,
  },
  monthlyRent: 80_000n,
  status: "OCCUPIED",
};

const unit3: Unit = {
  id: "U3",
  surface_m2: 27,
  monthlyRent: 60_000n,
  status: "VACANT",
};

const properties: Property[] = [
  {
    id: "P1",
    address: "Zone du Bois, Ouagadougou",
    units: [unit1, unit2],
  },
  {
    id: "P2",
    address: "Avenue Kwamé Nkrumah, Ouagadougou",
    units: [unit3],
  },
];

const marchPayments: Payment[] = [
  { unitId: "U1", amount: 100_000n, date: new Date("2026-03-03T08:30:00Z"), type: "RENT" },
  { unitId: "U2", amount: 50_000n, date: new Date("2026-03-06T09:00:00Z"), type: "RENT" },
  { unitId: "U2", amount: 10_000n, date: new Date("2026-03-08T09:00:00Z"), type: "CHARGE" },
  { unitId: "U1", amount: 20_000n, date: new Date("2026-03-01T09:00:00Z"), type: "DEPOSIT" },
];

describe("SIB-SCI rent roll engine", () => {
  it("generates expected vs actual vs variance per unit for a month", () => {
    const report = generateRentRoll(properties, marchPayments, new Date("2026-03-15T00:00:00Z"));

    expect(report.period).toBe("2026-03");
    expect(report.totalExpectedRentCentimes).toBe(180_000n);
    expect(report.totalActualRentCentimes).toBe(150_000n);
    expect(report.totalVarianceCentimes).toBe(-30_000n);
    expect(report.lines).toHaveLength(3);

    const u2 = report.lines.find((line) => line.unitId === "U2");
    expect(u2?.expectedRentCentimes).toBe(80_000n);
    expect(u2?.actualRentCentimes).toBe(50_000n);
    expect(u2?.varianceCentimes).toBe(-30_000n);
  });

  it("calculates gross portfolio yield percentage", () => {
    const yieldPct = calculatePortfolioYield(properties, 2_160_000n);
    expect(yieldPct).toBe(75);
  });

  it("identifies late payments after due day", () => {
    const lateUnits = identifyLatePayments(
      [unit1, unit2, unit3],
      marchPayments,
      new Date("2026-03-10T00:00:00Z")
    );

    expect(lateUnits.map((unit) => unit.id)).toEqual(["U2"]);
  });

  it("returns no late payments before due day", () => {
    const lateUnits = identifyLatePayments(
      [unit1, unit2],
      marchPayments,
      new Date("2026-03-04T00:00:00Z")
    );

    expect(lateUnits).toHaveLength(0);
  });

  it("generates a UEMOA-format securitization package", () => {
    const sec = generateSecuritizationPackage(properties, 3);

    expect(sec.standard).toBe("UEMOA_RECEIVABLES_V1");
    expect(sec.currency).toBe("XOF");
    expect(sec.amountUnit).toBe("CENTIMES");
    expect(sec.totalUnits).toBe(3);
    expect(sec.occupiedUnits).toBe(2);
    expect(sec.occupancyRatePct).toBe(66.67);
    expect(sec.weightedAverageMonthlyRentCentimes).toBe(90_000n);
    expect(sec.totalExpectedReceivablesCentimes).toBe(540_000n);
    expect(sec.projectedCollectedReceivablesCentimes).toBe(495_450n);
    expect(sec.schedule).toHaveLength(3);
    expect(sec.schedule[0].expectedReceivableCentimes).toBe(180_000n);
    expect(sec.schedule[0].projectedCollectionRatePct).toBe(92);
  });
});
