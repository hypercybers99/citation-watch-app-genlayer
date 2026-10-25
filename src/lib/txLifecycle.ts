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

export interface TerminalOutcomeParams {
  status?: string | number | null;
  result?: string | number | null;
  leaderResult?: string | null;
  agreeCount?: number | null;
  totalVotes?: number | null;
  isExpectedRevert?: boolean;
  stateApplied?: boolean | null;
}

/**
 * Derives terminal UI state from transaction status, consensus result, leaderResult, and vote counts.
 * Produces honest user-facing labels adhering strictly to the standing rules:
 * - "Accepted by validators (a/b agreed) - state applied"
 * - "Validators did not agree (a/b) - state not applied"
 * - "Reverted - state not applied" (or "expected revert")
 * Eliminates all user-facing "Finalized" phrasing.
 */
export function deriveTerminalOutcome(params: TerminalOutcomeParams): TerminalOutcome {
  const {
    status,
    result,
    leaderResult,
    agreeCount,
    totalVotes,
    isExpectedRevert = false,
    stateApplied: explicitStateApplied = null,
  } = params;

  const rawStatus = status !== undefined && status !== null ? String(status).trim().toUpperCase() : "";
  const rawResult = result !== undefined && result !== null ? String(result).trim().toUpperCase() : "";
  const rawLeader = leaderResult !== undefined && leaderResult !== null ? String(leaderResult).trim().toUpperCase() : "";

  const hasVoteRatio =
    agreeCount !== undefined &&
    agreeCount !== null &&
    totalVotes !== undefined &&
    totalVotes !== null &&
    totalVotes > 0;

  // 1. Reverted (explicit REVERTED status or leader execution error)
  if (rawStatus === "REVERTED" || rawLeader === "ERROR") {
    return {
      outcome: "reverted",
      label: isExpectedRevert ? "expected revert" : "Reverted - state not applied",
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
      label: "Timed Out - state not applied",
      badgeVariant: "rose",
      stateApplied: false,
      isTerminal: true,
    };
  }

  // 3. Canceled
  if (rawStatus === "CANCELED" || rawStatus === "8") {
    return {
      outcome: "canceled",
      label: "Canceled - state not applied",
      badgeVariant: "slate",
      stateApplied: false,
      isTerminal: true,
    };
  }

  // 4. Disagreement detection
  // A tx is disagreed if:
  // - status indicates UNDETERMINED / MAJORITY_DISAGREE (or status code 6)
  // - consensus result indicates MAJORITY_DISAGREE (code 7) or NO_MAJORITY (code 5)
  // - leaderResult indicates DISAGREED / DISAGREE
  // - vote count shows non-majority (e.g. 1/5 agreed)
  // - explicit stateApplied === false
  const isDisagreedStatus =
    rawStatus === "UNDETERMINED" ||
    rawStatus === "MAJORITY_DISAGREE" ||
    rawStatus === "DISAGREED" ||
    rawStatus === "6";

  const isDisagreedResult =
    rawResult === "7" ||
    rawResult === "MAJORITY_DISAGREE" ||
    rawResult === "DISAGREED" ||
    rawResult === "DISAGREE" ||
    rawResult === "5" ||
    rawResult === "NO_MAJORITY";

  const isDisagreedLeader = rawLeader === "DISAGREED" || rawLeader === "DISAGREE";

  const hasMinorityVotes =
    hasVoteRatio && (agreeCount as number) * 2 <= (totalVotes as number);

  const isDisagreed =
    isDisagreedStatus ||
    isDisagreedResult ||
    isDisagreedLeader ||
    hasMinorityVotes ||
    explicitStateApplied === false;

  const isAcceptedStatus =
    rawStatus === "FINALIZED" ||
    rawStatus === "ACCEPTED" ||
    rawStatus === "5" ||
    rawStatus === "7";

  const isAgreedResult =
    rawResult === "6" ||
    rawResult === "MAJORITY_AGREE" ||
    rawResult === "AGREE" ||
    rawResult === "";

  if (isDisagreed) {
    const label = hasVoteRatio
      ? `Validators did not agree (${agreeCount}/${totalVotes}) - state not applied`
      : "Validators did not agree - state not applied";

    return {
      outcome: "disagreed",
      label,
      badgeVariant: "amber",
      stateApplied: false,
      isTerminal: true,
    };
  }

  if (isAcceptedStatus && isAgreedResult) {
    const label = hasVoteRatio
      ? `Accepted by validators (${agreeCount}/${totalVotes} agreed) - state applied`
      : "Accepted by validators - state applied";

    return {
      outcome: "agreed",
      label,
      badgeVariant: "green",
      stateApplied: true,
      isTerminal: true,
    };
  }

  if (rawResult === "6" || rawResult === "MAJORITY_AGREE") {
    const label = hasVoteRatio
      ? `Accepted by validators (${agreeCount}/${totalVotes} agreed) - state applied`
      : "Accepted by validators - state applied";

    return {
      outcome: "agreed",
      label,
      badgeVariant: "green",
      stateApplied: true,
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
