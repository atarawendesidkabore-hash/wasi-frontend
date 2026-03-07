export type UnitStatus = "OCCUPIED" | "VACANT";
export type PaymentType = "RENT" | "DEPOSIT" | "CHARGE";

export interface Tenant {
  name: string;
  leaseStart: Date;
  leaseEnd: Date;
  depositPaid: bigint;
}

export interface Unit {
  id: string;
  surface_m2: number;
  tenant?: Tenant;
  monthlyRent: bigint;
  status: UnitStatus;
}

export interface Property {
  id: string;
  address: string;
  units: Unit[];
}

export interface Payment {
  unitId: string;
  amount: bigint;
  date: Date;
  type: PaymentType;
}

export interface RentRollLine {
  propertyId: string;
  unitId: string;
  status: UnitStatus;
  expectedRentCentimes: bigint;
  actualRentCentimes: bigint;
  varianceCentimes: bigint;
}

export interface RentRollReport {
  period: string;
  totalExpectedRentCentimes: bigint;
  totalActualRentCentimes: bigint;
  totalVarianceCentimes: bigint;
  lines: RentRollLine[];
}

export interface SecMonthLine {
  period: string;
  expectedReceivableCentimes: bigint;
  projectedCollectionRatePct: number;
  projectedCollectedCentimes: bigint;
}

export interface SecPackage {
  standard: "UEMOA_RECEIVABLES_V1";
  currency: "XOF";
  amountUnit: "CENTIMES";
  generatedAtUtc: string;
  months: number;
  totalUnits: number;
  occupiedUnits: number;
  occupancyRatePct: number;
  weightedAverageMonthlyRentCentimes: bigint;
  totalExpectedReceivablesCentimes: bigint;
  projectedCollectedReceivablesCentimes: bigint;
  schedule: SecMonthLine[];
}
