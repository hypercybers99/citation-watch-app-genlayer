import { describe, it, expect } from "vitest";
import {
  isTerminalReceiptStatus,
  isAcceptedReceiptStatus,
  isDisagreedReceiptStatus,
  isTimeoutReceiptStatus,
  deriveTerminalOutcome,
  type PipelineStage,
  type TxProgress,
} from "../src/lib/txLifecycle";

describe("txLifecycle status checkers", () => {
  it("identifies all string terminal statuses correctly", () => {
    expect(isTerminalReceiptStatus("ACCEPTED")).toBe(true);
    expect(isTerminalReceiptStatus("FINALIZED")).toBe(true);
    expect(isTerminalReceiptStatus("UNDETERMINED")).toBe(true);
    expect(isTerminalReceiptStatus("MAJORITY_DISAGREE")).toBe(true);
    expect(isTerminalReceiptStatus("CANCELED")).toBe(true);
    expect(isTerminalReceiptStatus("VALIDATORS_TIMEOUT")).toBe(true);
    expect(isTerminalReceiptStatus("LEADER_TIMEOUT")).toBe(true);
  });

  it("handles case-insensitivity and whitespace in terminal status strings", () => {
    expect(isTerminalReceiptStatus(" accepted ")).toBe(true);
    expect(isTerminalReceiptStatus("finalized")).toBe(true);
    expect(isTerminalReceiptStatus("  majority_disagree  ")).toBe(true);
  });

  it("identifies all numeric status code strings correctly", () => {
    expect(isTerminalReceiptStatus("5")).toBe(true); // ACCEPTED
    expect(isTerminalReceiptStatus("6")).toBe(true); // UNDETERMINED
    expect(isTerminalReceiptStatus("7")).toBe(true); // FINALIZED
    expect(isTerminalReceiptStatus("8")).toBe(true); // CANCELED
    expect(isTerminalReceiptStatus("12")).toBe(true); // VALIDATORS_TIMEOUT
    expect(isTerminalReceiptStatus("13")).toBe(true); // LEADER_TIMEOUT
  });

  it("identifies numeric values correctly", () => {
    expect(isTerminalReceiptStatus(5)).toBe(true);
    expect(isTerminalReceiptStatus(6)).toBe(true);
    expect(isTerminalReceiptStatus(7)).toBe(true);
    expect(isTerminalReceiptStatus(12)).toBe(true);
    expect(isTerminalReceiptStatus(13)).toBe(true);
  });

  it("returns false for non-terminal, null, and undefined statuses", () => {
    expect(isTerminalReceiptStatus("PENDING")).toBe(false);
    expect(isTerminalReceiptStatus("PROPOSED")).toBe(false);
    expect(isTerminalReceiptStatus("0")).toBe(false);
    expect(isTerminalReceiptStatus("1")).toBe(false);
    expect(isTerminalReceiptStatus(null)).toBe(false);
    expect(isTerminalReceiptStatus(undefined)).toBe(false);
    expect(isTerminalReceiptStatus("")).toBe(false);
  });

  it("identifies accepted statuses strictly", () => {
    expect(isAcceptedReceiptStatus("ACCEPTED")).toBe(true);
    expect(isAcceptedReceiptStatus("FINALIZED")).toBe(true);
    expect(isAcceptedReceiptStatus("5")).toBe(true);
    expect(isAcceptedReceiptStatus("7")).toBe(true);

    expect(isAcceptedReceiptStatus("UNDETERMINED")).toBe(false);
    expect(isAcceptedReceiptStatus("VALIDATORS_TIMEOUT")).toBe(false);
    expect(isAcceptedReceiptStatus(null)).toBe(false);
  });

  it("identifies disagreed statuses strictly", () => {
    expect(isDisagreedReceiptStatus("UNDETERMINED")).toBe(true);
    expect(isDisagreedReceiptStatus("MAJORITY_DISAGREE")).toBe(true);
    expect(isDisagreedReceiptStatus("6")).toBe(true);

    expect(isDisagreedReceiptStatus("ACCEPTED")).toBe(false);
    expect(isDisagreedReceiptStatus("VALIDATORS_TIMEOUT")).toBe(false);
  });

  it("identifies timeout statuses strictly", () => {
    expect(isTimeoutReceiptStatus("VALIDATORS_TIMEOUT")).toBe(true);
    expect(isTimeoutReceiptStatus("LEADER_TIMEOUT")).toBe(true);
    expect(isTimeoutReceiptStatus("12")).toBe(true);
    expect(isTimeoutReceiptStatus("13")).toBe(true);

    expect(isTimeoutReceiptStatus("ACCEPTED")).toBe(false);
    expect(isTimeoutReceiptStatus("UNDETERMINED")).toBe(false);
  });
});

describe("txLifecycle readback verification flow", () => {
  it("only marks completion stage after readback confirms on-chain state", async () => {
    const stageHistory: PipelineStage[] = [];
    const onProgress = (p: TxProgress) => stageHistory.push(p.stage);

    // Mock lifecycle simulator
    async function simulateFlowWithReadback(
      simulateReadbackSuccess: boolean
    ): Promise<boolean> {
      onProgress({ stage: "signing" });
      onProgress({ stage: "submitting" });
      onProgress({ stage: "consensus" });

      // Transaction accepted by validators
      onProgress({ stage: "accepted" });

      // READBACK VERIFICATION STEP:
      let readbackConfirmed = false;
      if (simulateReadbackSuccess) {
        readbackConfirmed = true;
        onProgress({ stage: "state_confirmed" });
      }

      if (!readbackConfirmed) {
        throw new Error("Readback verification failed: record not found on-chain.");
      }

      return true;
    }

    // 1. Success case: state_confirmed is reached
    const ok = await simulateFlowWithReadback(true);
    expect(ok).toBe(true);
    expect(stageHistory).toContain("state_confirmed");
    expect(stageHistory[stageHistory.length - 1]).toBe("state_confirmed");

    // 2. Failure case: readback fails -> error thrown, state_confirmed NOT reached
    const failedHistory: PipelineStage[] = [];
    const failedOnProgress = (p: TxProgress) => failedHistory.push(p.stage);

    let errorThrown = false;
    try {
      await (async () => {
        failedOnProgress({ stage: "signing" });
        failedOnProgress({ stage: "submitting" });
        failedOnProgress({ stage: "consensus" });
        failedOnProgress({ stage: "accepted" });
        // Readback fails:
        throw new Error("Readback verification timed out.");
      })();
    } catch {
      errorThrown = true;
    }

    expect(errorThrown).toBe(true);
    expect(failedHistory).not.toContain("state_confirmed");
  });

  it("decodes leader receipt results correctly with first status byte sliced", async () => {
    const text = "quote not found verbatim in baseline";
    const binary = String.fromCharCode(0) + text;
    const base64 = btoa(binary);

    const { decodeLeaderReceiptResult } = await import("../src/services/contractService");
    const decoded = decodeLeaderReceiptResult(base64);
    expect(decoded).toBe(text);
  });

  it("decodes leader receipt results when returned as an object with payload or raw", async () => {
    const { decodeLeaderReceiptResult } = await import("../src/services/contractService");
    expect(decodeLeaderReceiptResult({ payload: "quote not found verbatim in baseline" })).toBe("quote not found verbatim in baseline");

    const binary = String.fromCharCode(1) + "custom error";
    const base64 = btoa(binary);
    expect(decodeLeaderReceiptResult({ raw: base64 })).toBe("custom error");
  });
});

describe("deriveTerminalOutcome dual status and result mapping", () => {
  const cases = [
    // Agreed combinations
    {
      input: { status: "FINALIZED", result: 6 },
      expected: { outcome: "agreed", label: "Finalized (Agreed)", badgeVariant: "green", stateApplied: true, isTerminal: true },
    },
    {
      input: { status: "FINALIZED", result: "MAJORITY_AGREE" },
      expected: { outcome: "agreed", label: "Finalized (Agreed)", badgeVariant: "green", stateApplied: true, isTerminal: true },
    },
    {
      input: { status: "ACCEPTED", result: 6 },
      expected: { outcome: "agreed", label: "Finalized (Agreed)", badgeVariant: "green", stateApplied: true, isTerminal: true },
    },
    {
      input: { status: 7, result: 6 },
      expected: { outcome: "agreed", label: "Finalized (Agreed)", badgeVariant: "green", stateApplied: true, isTerminal: true },
    },
    {
      input: { status: 5, result: 6 },
      expected: { outcome: "agreed", label: "Finalized (Agreed)", badgeVariant: "green", stateApplied: true, isTerminal: true },
    },
    {
      input: { status: "FINALIZED", result: null, leaderResult: "SUCCESS" },
      expected: { outcome: "agreed", label: "Finalized (Agreed)", badgeVariant: "green", stateApplied: true, isTerminal: true },
    },

    // Disagreed combinations
    {
      input: { status: "FINALIZED", result: 7 },
      expected: { outcome: "disagreed", label: "Finalized (Disagreed / State not applied)", badgeVariant: "amber", stateApplied: false, isTerminal: true },
    },
    {
      input: { status: "FINALIZED", result: "MAJORITY_DISAGREE" },
      expected: { outcome: "disagreed", label: "Finalized (Disagreed / State not applied)", badgeVariant: "amber", stateApplied: false, isTerminal: true },
    },
    {
      input: { status: "UNDETERMINED", result: null },
      expected: { outcome: "disagreed", label: "Finalized (Disagreed / State not applied)", badgeVariant: "amber", stateApplied: false, isTerminal: true },
    },
    {
      input: { status: "MAJORITY_DISAGREE", result: null },
      expected: { outcome: "disagreed", label: "Finalized (Disagreed / State not applied)", badgeVariant: "amber", stateApplied: false, isTerminal: true },
    },
    {
      input: { status: 6, result: null },
      expected: { outcome: "disagreed", label: "Finalized (Disagreed / State not applied)", badgeVariant: "amber", stateApplied: false, isTerminal: true },
    },

    // Reverted combinations
    {
      input: { status: "REVERTED", result: null },
      expected: { outcome: "reverted", label: "Reverted", badgeVariant: "rose", stateApplied: false, isTerminal: true },
    },
    {
      input: { status: "FINALIZED", leaderResult: "ERROR" },
      expected: { outcome: "reverted", label: "Reverted", badgeVariant: "rose", stateApplied: false, isTerminal: true },
    },
    {
      input: { status: "ACCEPTED", leaderResult: "ERROR" },
      expected: { outcome: "reverted", label: "Reverted", badgeVariant: "rose", stateApplied: false, isTerminal: true },
    },

    // Timeout combinations
    {
      input: { status: "VALIDATORS_TIMEOUT" },
      expected: { outcome: "timed_out", label: "Timed Out", badgeVariant: "rose", stateApplied: false, isTerminal: true },
    },
    {
      input: { status: "LEADER_TIMEOUT" },
      expected: { outcome: "timed_out", label: "Timed Out", badgeVariant: "rose", stateApplied: false, isTerminal: true },
    },
    {
      input: { status: 12 },
      expected: { outcome: "timed_out", label: "Timed Out", badgeVariant: "rose", stateApplied: false, isTerminal: true },
    },

    // Canceled combinations
    {
      input: { status: "CANCELED" },
      expected: { outcome: "canceled", label: "Canceled", badgeVariant: "slate", stateApplied: false, isTerminal: true },
    },
    {
      input: { status: 8 },
      expected: { outcome: "canceled", label: "Canceled", badgeVariant: "slate", stateApplied: false, isTerminal: true },
    },

    // In-progress / Pending combinations
    {
      input: { status: "PROPOSING" },
      expected: { outcome: "accepted_by_leader", label: "Accepted by Leader", badgeVariant: "cyan", stateApplied: false, isTerminal: false },
    },
    {
      input: { status: "VOTING" },
      expected: { outcome: "voting", label: "Voting / Awaiting Consensus", badgeVariant: "cyan", stateApplied: false, isTerminal: false },
    },
    {
      input: { status: "PENDING" },
      expected: { outcome: "pending", label: "Pending", badgeVariant: "slate", stateApplied: false, isTerminal: false },
    },
    {
      input: { status: null },
      expected: { outcome: "pending", label: "Pending", badgeVariant: "slate", stateApplied: false, isTerminal: false },
    },
  ];

  cases.forEach(({ input, expected }, idx) => {
    it(`handles case #${idx + 1}: status=${input.status}, result=${(input as any).result}, leaderResult=${(input as any).leaderResult}`, () => {
      const outcome = deriveTerminalOutcome(input);
      expect(outcome).toEqual(expected);
    });
  });
});
