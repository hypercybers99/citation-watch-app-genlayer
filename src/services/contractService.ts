import { createClient } from "genlayer-js";
import {
  SOURCE_DRIFT_LEDGER_ADDRESS,
  CLAIMS_BOARD_ADDRESS,
  GENLAYER_CHAIN,
  RPC_URL,
} from "../config/chain";
import type { CitationRecord, AuditRecord, ClaimBadgeRecord } from "../lib/outcome";
import {
  isAcceptedReceiptStatus,
  isDisagreedReceiptStatus,
  isTimeoutReceiptStatus,
  deriveTerminalOutcome,
  type TxProgress,
} from "../lib/txLifecycle";
import { decodeContractRevert } from "../lib/revertMap";

const USER_CITATIONS_STORAGE_KEY = "citation_watch_user_citations";
const USER_CLAIMS_STORAGE_KEY = "citation_watch_user_claims";

export function getGenLayerClient(account?: any) {
  return createClient({
    chain: GENLAYER_CHAIN,
    endpoint: RPC_URL,
    account,
  });
}

/**
 * Queries account balance on GenLayer Studionet (Preview) via RPC.
 */
export async function getAccountBalance(address: string): Promise<bigint> {
  try {
    const client = getGenLayerClient();
    const bal = await client.getBalance({ address: address as `0x${string}` });
    return BigInt(bal.toString());
  } catch (err) {
    console.warn("getAccountBalance RPC error:", err);
    return 0n;
  }
}

/**
 * Formats a descriptive, user-friendly error message for failed consensus states.
 */
function formatTxFailureMessage(action: string, result: { status: string; decodedRevert?: string; tx?: any }): string {
  if (result.decodedRevert) {
    return result.decodedRevert;
  }
  if (result.status === "DISAGREED") {
    return `Consensus Disagreement: The validators could not reach agreement on this ${action} transaction. The target content or validator environment produced differing execution results.`;
  }
  if (result.status === "TIMED_OUT") {
    return `Consensus Timeout: Transaction was submitted to GenLayer Studionet (Preview), but validator consensus did not finalize within the monitoring window. Please check the explorer or try again.`;
  }
  return `${action} failed with status ${result.status}`;
}

/**
 * Decodes leader receipt result from GenLayer JSON-RPC base64 response.
 */
export function decodeLeaderReceiptResult(resultInput: any): string {
  try {
    if (!resultInput) return "";
    if (typeof resultInput === "object") {
      if (typeof resultInput.payload === "string" && resultInput.payload) {
        return resultInput.payload;
      }
      if (typeof resultInput.raw === "string" && resultInput.raw) {
        resultInput = resultInput.raw;
      }
    }
    if (typeof resultInput !== "string") return "";
    const binaryStr = atob(resultInput);
    if (binaryStr.length <= 1) return "";
    const sliced = binaryStr.slice(1);
    const bytes = new Uint8Array(sliced.length);
    for (let i = 0; i < sliced.length; i++) {
      bytes[i] = sliced.charCodeAt(i);
    }
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return "";
  }
}

// -----------------------------------------------------------------------------
// LOCAL STORAGE CITATION & CLAIM TRACKING
// -----------------------------------------------------------------------------

export function getLocalUserCitationIds(): string[] {
  try {
    const raw = localStorage.getItem(USER_CITATIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalUserCitationId(id: string): void {
  try {
    const current = getLocalUserCitationIds();
    if (!current.includes(id)) {
      const updated = [id, ...current];
      localStorage.setItem(USER_CITATIONS_STORAGE_KEY, JSON.stringify(updated));
    }
  } catch {
    // localStorage might fail in restricted iframe / private browsing
  }
}

export function getLocalUserClaimIds(): string[] {
  try {
    const raw = localStorage.getItem(USER_CLAIMS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalUserClaimId(id: string): void {
  try {
    const current = getLocalUserClaimIds();
    if (!current.includes(id)) {
      const updated = [id, ...current];
      localStorage.setItem(USER_CLAIMS_STORAGE_KEY, JSON.stringify(updated));
    }
  } catch {
    // ignore
  }
}

// -----------------------------------------------------------------------------
// READ CALLS (SourceDriftLedger)
// -----------------------------------------------------------------------------

export async function getCitation(citationId: string): Promise<CitationRecord | null> {
  const client = getGenLayerClient();
  try {
    const raw: any = await client.readContract({
      address: SOURCE_DRIFT_LEDGER_ADDRESS,
      functionName: "get_citation",
      args: [citationId.trim()],
    });

    if (!raw) return null;
    if (typeof raw === "string") {
      return JSON.parse(raw) as CitationRecord;
    }
    return raw as CitationRecord;
  } catch (err: any) {
    const msg = String(err).toLowerCase();
    if (msg.includes("citation not found")) {
      return null;
    }
    throw err;
  }
}

export async function listCitationIds(offset: number = 0, limit: number = 20): Promise<string[]> {
  const client = getGenLayerClient();
  const raw: any = await client.readContract({
    address: SOURCE_DRIFT_LEDGER_ADDRESS,
    functionName: "list_citation_ids",
    args: [offset, limit],
  });

  if (!raw) return [];
  if (typeof raw === "string") {
    return JSON.parse(raw) as string[];
  }
  return Array.isArray(raw) ? raw : [];
}

export async function getLedgerMeta(): Promise<{ schema_version: string; citations_total: number; nonce: number } | null> {
  const client = getGenLayerClient();
  try {
    const raw: any = await client.readContract({
      address: SOURCE_DRIFT_LEDGER_ADDRESS,
      functionName: "get_meta",
      args: [],
    });
    if (!raw) return null;
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------------
// READ CALLS (ClaimsBoard)
// -----------------------------------------------------------------------------

export async function getClaim(claimId: string): Promise<ClaimBadgeRecord | null> {
  const client = getGenLayerClient();
  try {
    const raw: any = await client.readContract({
      address: CLAIMS_BOARD_ADDRESS,
      functionName: "get_claim",
      args: [claimId.trim()],
    });

    if (!raw) return null;
    if (typeof raw === "string") {
      return JSON.parse(raw) as ClaimBadgeRecord;
    }
    return raw as ClaimBadgeRecord;
  } catch (err: any) {
    const msg = String(err).toLowerCase();
    if (msg.includes("claim not found")) {
      return null;
    }
    throw err;
  }
}

export async function listClaimIds(offset: number = 0, limit: number = 20): Promise<string[]> {
  const client = getGenLayerClient();
  const raw: any = await client.readContract({
    address: CLAIMS_BOARD_ADDRESS,
    functionName: "list_claim_ids",
    args: [offset, limit],
  });

  if (!raw) return [];
  if (typeof raw === "string") {
    return JSON.parse(raw) as string[];
  }
  return Array.isArray(raw) ? raw : [];
}

export async function getClaimsLedgerAddress(): Promise<string> {
  const client = getGenLayerClient();
  try {
    const addr = await client.readContract({
      address: CLAIMS_BOARD_ADDRESS,
      functionName: "get_ledger_address",
      args: [],
    });
    return String(addr);
  } catch {
    return "";
  }
}

export async function getClaimsOwner(): Promise<string> {
  const client = getGenLayerClient();
  try {
    const owner = await client.readContract({
      address: CLAIMS_BOARD_ADDRESS,
      functionName: "get_owner",
      args: [],
    });
    return String(owner);
  } catch {
    return "";
  }
}

// -----------------------------------------------------------------------------
// TRANSACTION MONITORING & LIFECYCLE
// -----------------------------------------------------------------------------

export async function monitorTransaction(
  txHash: string,
  onProgress?: (progress: TxProgress) => void
): Promise<{ status: string; tx: any; decodedRevert?: string }> {
  const client = getGenLayerClient();
  const startTime = Date.now();
  const timeoutMs = 240000; // 4 minutes

  while (Date.now() - startTime < timeoutMs) {
    try {
      let tx: any = null;
      try {
        tx = await client.getTransaction({ hash: txHash as any });
      } catch {
        // fallback to raw RPC
        const rpcRes = await fetch(RPC_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "eth_getTransactionByHash",
            params: [txHash],
          }),
        });
        const rpcJson = await rpcRes.json();
        tx = rpcJson.result;
      }

      if (tx) {
        const rawStatus = tx.statusName || tx.status_name || tx.status || "PENDING";
        const consensusData = tx.consensus_data;
        const leader = consensusData?.leader_receipt?.[0];

        let leaderResult: string | undefined;
        let decodedRevert: string | undefined;

        if (leader?.execution_result === "ERROR" && leader?.result) {
          leaderResult = "ERROR";
          const rawDecoded = decodeLeaderReceiptResult(leader.result);
          const parsed = decodeContractRevert(rawDecoded);
          decodedRevert = parsed.friendlyMessage;
        } else if (leader?.execution_result === "SUCCESS") {
          leaderResult = "SUCCESS";
        }

        let voteList: any[] = [];
        if (Array.isArray(consensusData?.votes)) {
          voteList = consensusData.votes;
        } else if (typeof consensusData?.votes === "object" && consensusData?.votes !== null) {
          voteList = Object.values(consensusData.votes);
        } else if (Array.isArray(consensusData?.validators)) {
          voteList = consensusData.validators;
        }

        const agreeCount = voteList.filter((v: any) => {
          if (v === "agree" || v === 1 || v === true) return true;
          if (typeof v === "object" && v !== null) {
            return v.vote === "agree" || v.vote === 1 || v.vote === true || v.agree === true;
          }
          return false;
        }).length;
        const totalVotes = voteList.length;

        const terminal = deriveTerminalOutcome({
          status: rawStatus,
          result: tx.result ?? consensusData?.result,
          leaderResult,
        });

        if (terminal.isTerminal) {
          if (terminal.outcome === "reverted") {
            onProgress?.({
              stage: "reverted",
              txHash,
              leaderResult: "ERROR",
              decodedRevert,
              agreeCount,
              totalVotes,
            });
            return { status: "REVERTED", tx, decodedRevert };
          }

          if (terminal.outcome === "disagreed") {
            onProgress?.({
              stage: "disagreed",
              txHash,
              leaderResult,
              agreeCount,
              totalVotes,
            });
            return { status: "DISAGREED", tx };
          }

          if (terminal.outcome === "timed_out") {
            onProgress?.({
              stage: "timed_out",
              txHash,
              leaderResult,
              agreeCount,
              totalVotes,
            });
            return { status: "TIMED_OUT", tx };
          }

          if (terminal.outcome === "agreed") {
            onProgress?.({
              stage: "accepted",
              txHash,
              leaderResult: "SUCCESS",
              agreeCount,
              totalVotes,
            });
            return { status: "ACCEPTED", tx };
          }
        }

        onProgress?.({
          stage: "consensus",
          txHash,
          agreeCount,
          totalVotes,
        });
      }
    } catch (pollErr) {
      console.warn("monitorTransaction poll error:", pollErr);
    }

    await new Promise((r) => setTimeout(r, 3000));
  }

  onProgress?.({ stage: "timed_out", txHash });
  return { status: "TIMED_OUT", tx: null };
}

// -----------------------------------------------------------------------------
// WRITE CALLS WITH READBACK VERIFICATION
// -----------------------------------------------------------------------------

async function executeWriteWithRetry(
  client: any,
  params: { address: string; functionName: string; args: any[]; value: bigint }
): Promise<string> {
  let lastErr: any = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const hash = await client.writeContract(params as any);
      if (hash) return String(hash);
    } catch (err: any) {
      lastErr = err;
      const delay = Math.min(2000 * Math.pow(1.5, attempt), 9000);
      console.warn(`writeContract attempt ${attempt + 1} failed, retrying in ${delay}ms:`, err?.message || err);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

export async function registerCitationFlow(
  account: any,
  label: string,
  baselineUrl: string,
  quotes: string[],
  onProgress?: (progress: TxProgress) => void
): Promise<{ txHash: string; citationId: string; record: CitationRecord }> {
  onProgress?.({ stage: "signing" });
  const client = getGenLayerClient(account);

  const cleanLabel = label.trim();
  const cleanUrl = baselineUrl.trim();
  const quotesJson = JSON.stringify(quotes.map((q) => q.trim()));

  const preExistingIds = new Set<string>();
  try {
    const initialList = await listCitationIds(0, 50);
    initialList.forEach((id) => preExistingIds.add(id));
  } catch {
    // continue
  }

  onProgress?.({ stage: "submitting" });
  const txHash: string = await executeWriteWithRetry(client, {
    address: SOURCE_DRIFT_LEDGER_ADDRESS,
    functionName: "register_citation",
    args: [cleanLabel, cleanUrl, quotesJson],
    value: 0n,
  });

  onProgress?.({ stage: "consensus", txHash });
  const result = await monitorTransaction(txHash, onProgress);

  if (result.status !== "ACCEPTED") {
    throw new Error(formatTxFailureMessage("Registration", result));
  }

  // READBACK VERIFICATION: Locate newly registered citation ID strictly matching runner account and inputs
  for (let attempt = 0; attempt < 12; attempt++) {
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const recentIds = await listCitationIds(0, 10);
      for (const cid of recentIds) {
        if (!preExistingIds.has(cid)) {
          const record = await getCitation(cid);
          if (
            record &&
            record.registrant.toLowerCase() === account.address.toLowerCase() &&
            record.label === cleanLabel &&
            record.baseline_url === cleanUrl
          ) {
            saveLocalUserCitationId(cid);
            onProgress?.({ stage: "state_confirmed", txHash });
            return { txHash, citationId: cid, record };
          }
        }
      }
    } catch {
      // retry readback
    }
  }

  throw new Error("Transaction accepted by validators, but newly created citation readback verification timed out.");
}

export async function auditCitationFlow(
  account: any,
  citationId: string,
  targetUrl: string,
  onProgress?: (progress: TxProgress) => void
): Promise<{ txHash: string; updatedCitation: CitationRecord }> {
  onProgress?.({ stage: "signing" });
  const client = getGenLayerClient(account);

  const cid = citationId.trim();
  const cleanTarget = targetUrl.trim();

  // Snapshot before audit
  const beforeCitation = await getCitation(cid);
  const beforeAuditCount = beforeCitation ? beforeCitation.audits_total : 0;

  onProgress?.({ stage: "submitting" });
  const txHash: string = await executeWriteWithRetry(client, {
    address: SOURCE_DRIFT_LEDGER_ADDRESS,
    functionName: "audit_citation",
    args: [cid, cleanTarget],
    value: 0n,
  });

  onProgress?.({ stage: "consensus", txHash });
  const result = await monitorTransaction(txHash, onProgress);

  if (result.status !== "ACCEPTED") {
    throw new Error(formatTxFailureMessage("Audit", result));
  }

  // READBACK VERIFICATION: Confirm audits_total has incremented
  for (let attempt = 0; attempt < 8; attempt++) {
    await new Promise((r) => setTimeout(r, 2000));
    const afterCitation = await getCitation(cid);
    if (afterCitation && afterCitation.audits_total > beforeAuditCount) {
      onProgress?.({ stage: "state_confirmed", txHash });
      return { txHash, updatedCitation: afterCitation };
    }
  }

  const finalCitation = await getCitation(cid);
  if (finalCitation) {
    onProgress?.({ stage: "state_confirmed", txHash });
    return { txHash, updatedCitation: finalCitation };
  }

  throw new Error("Audit accepted by validators, but readback verification timed out.");
}

export async function publishClaimFlow(
  account: any,
  citationId: string,
  headline: string,
  onProgress?: (progress: TxProgress) => void
): Promise<{ txHash: string; claimId: string; claim: ClaimBadgeRecord }> {
  onProgress?.({ stage: "signing" });
  const client = getGenLayerClient(account);

  const cid = citationId.trim();
  const cleanHeadline = headline.trim();

  const preExistingClaimIds = new Set<string>();
  try {
    const initialClaims = await listClaimIds(0, 50);
    initialClaims.forEach((id) => preExistingClaimIds.add(id));
  } catch {
    // continue
  }

  onProgress?.({ stage: "submitting" });
  const txHash: string = await executeWriteWithRetry(client, {
    address: CLAIMS_BOARD_ADDRESS,
    functionName: "publish_claim",
    args: [cid, cleanHeadline],
    value: 0n,
  });

  onProgress?.({ stage: "consensus", txHash });
  const result = await monitorTransaction(txHash, onProgress);

  if (result.status !== "ACCEPTED") {
    throw new Error(formatTxFailureMessage("Publish claim", result));
  }

  // READBACK VERIFICATION: Locate newly published claim strictly matching runner account and inputs
  for (let attempt = 0; attempt < 12; attempt++) {
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const recentIds = await listClaimIds(0, 10);
      for (const claimId of recentIds) {
        if (!preExistingClaimIds.has(claimId)) {
          const claim = await getClaim(claimId);
          if (
            claim &&
            claim.publisher.toLowerCase() === account.address.toLowerCase() &&
            claim.citation_id === cid &&
            claim.headline === cleanHeadline
          ) {
            saveLocalUserClaimId(claimId);
            onProgress?.({ stage: "state_confirmed", txHash });
            return { txHash, claimId, claim };
          }
        }
      }
    } catch {
      // retry
    }
  }

  throw new Error("Claim published on-chain, but newly created claim readback verification timed out.");
}

export async function refreshClaimFlow(
  account: any,
  claimId: string,
  onProgress?: (progress: TxProgress) => void
): Promise<{ txHash: string; claim: ClaimBadgeRecord }> {
  onProgress?.({ stage: "signing" });
  const client = getGenLayerClient(account);

  const cleanId = claimId.trim();

  onProgress?.({ stage: "submitting" });
  const txHash: string = await executeWriteWithRetry(client, {
    address: CLAIMS_BOARD_ADDRESS,
    functionName: "refresh_claim",
    args: [cleanId],
    value: 0n,
  });

  onProgress?.({ stage: "consensus", txHash });
  const result = await monitorTransaction(txHash, onProgress);

  if (result.status !== "ACCEPTED") {
    throw new Error(formatTxFailureMessage("Refresh claim", result));
  }

  // READBACK VERIFICATION: Verify claim record can be fetched
  await new Promise((r) => setTimeout(r, 2000));
  const refreshed = await getClaim(cleanId);
  if (refreshed) {
    onProgress?.({ stage: "state_confirmed", txHash });
    return { txHash, claim: refreshed };
  }

  throw new Error("Refresh claim accepted, but readback verification timed out.");
}

export async function setLedgerFlow(
  account: any,
  newLedgerAddress: string,
  onProgress?: (progress: TxProgress) => void
): Promise<{ txHash: string }> {
  onProgress?.({ stage: "signing" });
  const client = getGenLayerClient(account);

  const cleanAddress = newLedgerAddress.trim();

  onProgress?.({ stage: "submitting" });
  const txHash: string = await executeWriteWithRetry(client, {
    address: CLAIMS_BOARD_ADDRESS,
    functionName: "set_ledger",
    args: [cleanAddress],
    value: 0n,
  });

  onProgress?.({ stage: "consensus", txHash });
  const result = await monitorTransaction(txHash, onProgress);

  if (result.status !== "ACCEPTED") {
    throw new Error(result.decodedRevert || `Set ledger failed with status ${result.status}`);
  }

  onProgress?.({ stage: "state_confirmed", txHash });
  return { txHash };
}
