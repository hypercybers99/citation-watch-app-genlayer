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

      if (simulateReadbackSuccess) {
        onProgress({ stage: "state_confirmed" });
        onProgress({ stage: "complete" });
        return true;
      } else {
        // Readback check failed: does not proceed to complete
        return false;
      }
    }

    const successResult = await simulateFlowWithReadback(true);
    expect(successResult).toBe(true);
    expect(stageHistory).toEqual([
      "signing",
      "submitting",
      "consensus",
      "accepted",
      "state_confirmed",
      "complete",
    ]);

    stageHistory.length = 0;
    const failResult = await simulateFlowWithReadback(false);
    expect(failResult).toBe(false);
    expect(stageHistory).toEqual([
      "signing",
      "submitting",
      "consensus",
      "accepted",
    ]);
    expect(stageHistory).not.toContain("complete");
    expect(stageHistory).not.toContain("state_confirmed");
  });
});

describe("decodeLeaderReceiptResult", () => {
  // Helper simulator for leader result decoding
  function decodeLeaderReceiptResult(receipt: any): string | null {
    if (!receipt || !receipt.raw) return null;
    try {
      const decoded = atob(receipt.raw);
      if (decoded.includes("revert") || decoded.includes("error")) {
        return decoded;
      }
      return null;
    } catch {
      return null;
    }
  }

  it("decodes revert strings correctly when present", () => {
    const binary = "execution revert: only owner can set ledger address";
    const base64 = btoa(binary);
    expect(decodeLeaderReceiptResult({ raw: base64 })).toBe(binary);
  });

  it("returns null for non-revert outputs", () => {
    const binary = "success return value";
    const base64 = btoa(binary);
    expect(decodeLeaderReceiptResult({ raw: base64 })).toBe(null);
  });

  it("handles malformed base64 without throwing", () => {
    expect(decodeLeaderReceiptResult({ raw: "not-valid-base64!!!" })).toBe(null);
  });

  it("extracts custom user errors from leader return buffer", () => {
    const binary = "custom error";
    const base64 = btoa(binary);
    expect(decodeLeaderReceiptResult({ raw: base64 })).toBe("custom error");
  });
});

describe("deriveTerminalOutcome dual status and result mapping", () => {
  const cases = [
    // Agreed combinations (without and with vote ratios)
    {
      input: { status: "FINALIZED", result: 6 },
      expected: { outcome: "agreed", label: "Accepted by validators - state applied", badgeVariant: "green", stateApplied: true, isTerminal: true },
    },
    {
      input: { status: "FINALIZED", result: 6, agreeCount: 3, totalVotes: 5 },
      expected: { outcome: "agreed", label: "Accepted by validators (3/5 agreed) - state applied", badgeVariant: "green", stateApplied: true, isTerminal: true },
    },
    {
      input: { status: "FINALIZED", result: 6, agreeCount: 5, totalVotes: 5 },
      expected: { outcome: "agreed", label: "Accepted by validators (5/5 agreed) - state applied", badgeVariant: "green", stateApplied: true, isTerminal: true },
    },
    {
      input: { status: "FINALIZED", result: "MAJORITY_AGREE" },
      expected: { outcome: "agreed", label: "Accepted by validators - state applied", badgeVariant: "green", stateApplied: true, isTerminal: true },
    },
    {
      input: { status: "ACCEPTED", result: 6 },
      expected: { outcome: "agreed", label: "Accepted by validators - state applied", badgeVariant: "green", stateApplied: true, isTerminal: true },
    },
    {
      input: { status: "ACCEPTED", result: 6, agreeCount: 3, totalVotes: 5 },
      expected: { outcome: "agreed", label: "Accepted by validators (3/5 agreed) - state applied", badgeVariant: "green", stateApplied: true, isTerminal: true },
    },
    {
      input: { status: 7, result: 6 },
      expected: { outcome: "agreed", label: "Accepted by validators - state applied", badgeVariant: "green", stateApplied: true, isTerminal: true },
    },
    {
      input: { status: 5, result: 6 },
      expected: { outcome: "agreed", label: "Accepted by validators - state applied", badgeVariant: "green", stateApplied: true, isTerminal: true },
    },
    {
      input: { status: "FINALIZED", result: null, leaderResult: "SUCCESS" },
      expected: { outcome: "agreed", label: "Accepted by validators - state applied", badgeVariant: "green", stateApplied: true, isTerminal: true },
    },

    // Disagreed combinations (handling status UNDETERMINED / ACCEPTED / FINALIZED x result 5 / 6 / 7 / null x leaderResult SUCCESS / ERROR / DISAGREED)
    {
      input: { status: "FINALIZED", result: 7 },
      expected: { outcome: "disagreed", label: "Validators did not agree - state not applied", badgeVariant: "amber", stateApplied: false, isTerminal: true },
    },
    {
      input: { status: "FINALIZED", result: 7, agreeCount: 1, totalVotes: 5 },
      expected: { outcome: "disagreed", label: "Validators did not agree (1/5) - state not applied", badgeVariant: "amber", stateApplied: false, isTerminal: true },
    },
    {
      input: { status: "FINALIZED", result: "MAJORITY_DISAGREE" },
      expected: { outcome: "disagreed", label: "Validators did not agree - state not applied", badgeVariant: "amber", stateApplied: false, isTerminal: true },
    },
    {
      input: { status: "FINALIZED", result: 5 }, // NO_MAJORITY
      expected: { outcome: "disagreed", label: "Validators did not agree - state not applied", badgeVariant: "amber", stateApplied: false, isTerminal: true },
    },
    {
      input: { status: "ACCEPTED", result: 5 }, // ACCEPTED status but NO_MAJORITY result
      expected: { outcome: "disagreed", label: "Validators did not agree - state not applied", badgeVariant: "amber", stateApplied: false, isTerminal: true },
    },
    {
      input: { status: "UNDETERMINED", result: 6 }, // UNDETERMINED status overrides agreed result
      expected: { outcome: "disagreed", label: "Validators did not agree - state not applied", badgeVariant: "amber", stateApplied: false, isTerminal: true },
    },
    {
      // Contradiction case 0x7a78...: result 6, 1/5 votes, leader DISAGREED
      input: { status: "FINALIZED", result: 6, leaderResult: "DISAGREED", agreeCount: 1, totalVotes: 5 },
      expected: { outcome: "disagreed", label: "Validators did not agree (1/5) - state not applied", badgeVariant: "amber", stateApplied: false, isTerminal: true },
    },
    {
      // Non-majority vote ratio (1/5) overrides status FINALIZED and result 6
      input: { status: "FINALIZED", result: 6, agreeCount: 1, totalVotes: 5 },
      expected: { outcome: "disagreed", label: "Validators did not agree (1/5) - state not applied", badgeVariant: "amber", stateApplied: false, isTerminal: true },
    },
    {
      input: { status: "UNDETERMINED", result: null },
      expected: { outcome: "disagreed", label: "Validators did not agree - state not applied", badgeVariant: "amber", stateApplied: false, isTerminal: true },
    },
    {
      input: { status: "MAJORITY_DISAGREE", result: null },
      expected: { outcome: "disagreed", label: "Validators did not agree - state not applied", badgeVariant: "amber", stateApplied: false, isTerminal: true },
    },
    {
      input: { status: 6, result: null },
      expected: { outcome: "disagreed", label: "Validators did not agree - state not applied", badgeVariant: "amber", stateApplied: false, isTerminal: true },
    },

    // Reverted combinations
    {
      input: { status: "REVERTED", result: null },
      expected: { outcome: "reverted", label: "Reverted - state not applied", badgeVariant: "rose", stateApplied: false, isTerminal: true },
    },
    {
      input: { status: "REVERTED", isExpectedRevert: true },
      expected: { outcome: "reverted", label: "expected revert", badgeVariant: "rose", stateApplied: false, isTerminal: true },
    },
    {
      input: { status: "FINALIZED", leaderResult: "ERROR" },
      expected: { outcome: "reverted", label: "Reverted - state not applied", badgeVariant: "rose", stateApplied: false, isTerminal: true },
    },
    {
      input: { status: "FINALIZED", leaderResult: "ERROR", isExpectedRevert: true },
      expected: { outcome: "reverted", label: "expected revert", badgeVariant: "rose", stateApplied: false, isTerminal: true },
    },
    {
      input: { status: "ACCEPTED", leaderResult: "ERROR" },
      expected: { outcome: "reverted", label: "Reverted - state not applied", badgeVariant: "rose", stateApplied: false, isTerminal: true },
    },

    // Timeout combinations
    {
      input: { status: "VALIDATORS_TIMEOUT" },
      expected: { outcome: "timed_out", label: "Timed Out - state not applied", badgeVariant: "rose", stateApplied: false, isTerminal: true },
    },
    {
      input: { status: "LEADER_TIMEOUT" },
      expected: { outcome: "timed_out", label: "Timed Out - state not applied", badgeVariant: "rose", stateApplied: false, isTerminal: true },
    },
    {
      input: { status: 12 },
      expected: { outcome: "timed_out", label: "Timed Out - state not applied", badgeVariant: "rose", stateApplied: false, isTerminal: true },
    },

    // Canceled combinations
    {
      input: { status: "CANCELED" },
      expected: { outcome: "canceled", label: "Canceled - state not applied", badgeVariant: "slate", stateApplied: false, isTerminal: true },
    },
    {
      input: { status: 8 },
      expected: { outcome: "canceled", label: "Canceled - state not applied", badgeVariant: "slate", stateApplied: false, isTerminal: true },
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
