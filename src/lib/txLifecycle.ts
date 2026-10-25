export type PipelineStage =
  | "idle"
  | "signing"
  | "submitting"
  | "consensus"
  | "accepted"
  | "state_confirmed"
  | "disagreed"
  | "reverted"
  | "timed_out"
  | "complete";

export interface TxProgress {
  stage: PipelineStage;
  txHash?: string;
  leaderResult?: "SUCCESS" | "ERROR" | string;
  decodedRevert?: string;
  agreeCount?: number;
  totalVotes?: number;
  message?: string;
}

/**
 * Checks if a transaction status represents a terminal receipt state in GenLayer.
 * A transaction is terminal if it has finished validator voting (ACCEPTED or FINALIZED)
 * or ended in a terminal non-success state (undetermined/disagreement, timeout, canceled).
 */
export function isTerminalReceiptStatus(status: string | number | undefined | null): boolean {
  if (status === undefined || status === null) return false;
  const s = String(status).trim().toUpperCase();
  return (
    s === "ACCEPTED" ||
    s === "FINALIZED" ||
    s === "UNDETERMINED" ||
    s === "MAJORITY_DISAGREE" ||
    s === "CANCELED" ||
    s === "VALIDATORS_TIMEOUT" ||
    s === "LEADER_TIMEOUT" ||
    s === "5" || // ACCEPTED
    s === "6" || // UNDETERMINED
    s === "7" || // FINALIZED
    s === "8" || // CANCELED
    s === "12" || // VALIDATORS_TIMEOUT
    s === "13" // LEADER_TIMEOUT
  );
}

export function isAcceptedReceiptStatus(status: string | number | undefined | null): boolean {
  if (status === undefined || status === null) return false;
  const s = String(status).trim().toUpperCase();
  return s === "ACCEPTED" || s === "FINALIZED" || s === "5" || s === "7";
}

export function isDisagreedReceiptStatus(status: string | number | undefined | null): boolean {
  const s = String(status || "").trim().toUpperCase();
  return s === "UNDETERMINED" || s === "MAJORITY_DISAGREE" || s === "6";
}

export function isTimeoutReceiptStatus(status: string | number | undefined | null): boolean {
  const s = String(status || "").trim().toUpperCase();
  return s === "VALIDATORS_TIMEOUT" || s === "LEADER_TIMEOUT" || s === "12" || s === "13";
}

export type TerminalOutcomeState =
  | "agreed"
  | "disagreed"
  | "reverted"
  | "timed_out"
  | "canceled"
  | "pending"
  | "accepted_by_leader"
  | "voting";

export interface TerminalOutcome {
  outcome: TerminalOutcomeState;
  label: string;
  badgeVariant: "green" | "amber" | "rose" | "slate" | "cyan";
  stateApplied: boolean;
  isTerminal: boolean;
}

/**
 * Derives terminal UI state from BOTH transaction status AND result/leaderResult.
 * Resolves the issue where GenLayer returns status === FINALIZED for both agreed
 * and disagreed transactions.
 */
export function deriveTerminalOutcome(params: {
  status?: string | number | null;
  result?: string | number | null;
  leaderResult?: string | null;
}): TerminalOutcome {
  const { status, result, leaderResult } = params;

  const rawStatus = status !== undefined && status !== null ? String(status).trim().toUpperCase() : "";
  const rawResult = result !== undefined && result !== null ? String(result).trim().toUpperCase() : "";
  const rawLeader = leaderResult !== undefined && leaderResult !== null ? String(leaderResult).trim().toUpperCase() : "";

  // 1. Reverted (either status is explicitly REVERTED, or leader execution produced ERROR)
  if (rawStatus === "REVERTED" || rawLeader === "ERROR") {
    return {
      outcome: "reverted",
      label: "Reverted",
      badgeVariant: "rose",
      stateApplied: false,
      isTerminal: true,
    };
  }

  // 2. Timeouts
  if (
    rawStatus === "VALIDATORS_TIMEOUT" ||
    rawStatus === "LEADER_TIMEOUT" ||
    rawStatus === "TIMED_OUT" ||
    rawStatus === "12" ||
    rawStatus === "13"
  ) {
    return {
      outcome: "timed_out",
      label: "Timed Out",
      badgeVariant: "rose",
      stateApplied: false,
      isTerminal: true,
    };
  }

  // 3. Canceled
  if (rawStatus === "CANCELED" || rawStatus === "8") {
    return {
      outcome: "canceled",
      label: "Canceled",
      badgeVariant: "slate",
      stateApplied: false,
      isTerminal: true,
    };
  }

  // 4. Disagreed or Agreed
  const isDisagreedStatus =
    rawStatus === "UNDETERMINED" ||
    rawStatus === "MAJORITY_DISAGREE" ||
    rawStatus === "DISAGREED" ||
    rawStatus === "6";

  const isDisagreedResult =
    rawResult === "7" ||
    rawResult === "MAJORITY_DISAGREE" ||
    rawResult === "DISAGREED";

  const isAcceptedStatus =
    rawStatus === "FINALIZED" ||
    rawStatus === "ACCEPTED" ||
    rawStatus === "5" ||
    rawStatus === "7";

  if (isAcceptedStatus) {
    if (isDisagreedResult) {
      return {
        outcome: "disagreed",
        label: "Finalized (Disagreed / State not applied)",
        badgeVariant: "amber",
        stateApplied: false,
        isTerminal: true,
      };
    }
    return {
      outcome: "agreed",
      label: "Finalized (Agreed)",
      badgeVariant: "green",
      stateApplied: true,
      isTerminal: true,
    };
  }

  if (isDisagreedStatus || isDisagreedResult) {
    return {
      outcome: "disagreed",
      label: "Finalized (Disagreed / State not applied)",
      badgeVariant: "amber",
      stateApplied: false,
      isTerminal: true,
    };
  }

  // 5. In-progress / Pending states
  if (rawStatus === "PROPOSING" || rawStatus === "PROPOSED" || rawStatus === "1") {
    return {
      outcome: "accepted_by_leader",
      label: "Accepted by Leader",
      badgeVariant: "cyan",
      stateApplied: false,
      isTerminal: false,
    };
  }

  if (
    rawStatus === "VOTING" ||
    rawStatus === "COMMITTING" ||
    rawStatus === "REVEALING" ||
    rawStatus === "2" ||
    rawStatus === "3" ||
    rawStatus === "4"
  ) {
    return {
      outcome: "voting",
      label: "Voting / Awaiting Consensus",
      badgeVariant: "cyan",
      stateApplied: false,
      isTerminal: false,
    };
  }

  return {
    outcome: "pending",
    label: "Pending",
    badgeVariant: "slate",
    stateApplied: false,
    isTerminal: false,
  };
}
