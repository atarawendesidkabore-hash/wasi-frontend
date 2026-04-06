import {
  MAX_MONETARY_AMOUNT_CENTIMES,
  createInitialBankingState,
  deposit,
  parseInputAmountToCentimes,
  transfer,
  withdraw,
} from "./bankingEngine";

describe("bankingEngine", () => {
  test("parses decimal amount to centimes", () => {
    expect(parseInputAmountToCentimes("1250.5")).toBe(125050n);
    expect(parseInputAmountToCentimes("1250,50")).toBe(125050n);
  });

  test("rejects invalid format", () => {
    expect(() => parseInputAmountToCentimes("12.345")).toThrow(
      "Invalid amount format."
    );
  });

  test("rejects amount over max bound", () => {
    const huge = (MAX_MONETARY_AMOUNT_CENTIMES + 1n).toString();
    expect(() => parseInputAmountToCentimes(huge)).toThrow(
      "Amount is out of supported bounds."
    );
  });

  test("deposit increases balance and records transaction", () => {
    const state = createInitialBankingState();
    const next = deposit(state, "acc_main", 10000n, "Cash in");

    expect(next.accounts.find((account) => account.id === "acc_main")?.balanceCentimes).toBe(
      125010000n
    );
    expect(next.transactions[0].kind).toBe("DEPOSIT");
  });

  test("withdraw rejects insufficient funds", () => {
    const state = createInitialBankingState();
    expect(() => withdraw(state, "acc_main", MAX_MONETARY_AMOUNT_CENTIMES + 1n)).toThrow(
      "Amount is out of supported bounds."
    );
    expect(() => withdraw(state, "acc_main", 999999999n)).toThrow(
      "Insufficient funds."
    );
  });

  test("transfer moves funds and writes in/out transactions", () => {
    const state = createInitialBankingState();
    const next = transfer(state, "acc_main", "acc_savings", 15000n, "Savings top-up");

    expect(next.accounts.find((account) => account.id === "acc_main")?.balanceCentimes).toBe(
      124985000n
    );
    expect(next.accounts.find((account) => account.id === "acc_savings")?.balanceCentimes).toBe(
      345515000n
    );
    expect(next.transactions[0].kind).toBe("TRANSFER_OUT");
    expect(next.transactions[1].kind).toBe("TRANSFER_IN");
  });
});
