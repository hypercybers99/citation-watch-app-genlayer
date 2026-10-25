import React, { useState, useEffect, useRef } from "react";
import {
  FileCheck2,
  ExternalLink,
  RefreshCw,
  Search,
  AlertCircle,
  Clock,
  Sparkles,
  Info,
  CheckCircle2,
  FileText,
  HelpCircle,
  Coins,
} from "lucide-react";
import {
  SOURCE_DRIFT_LEDGER_ADDRESS,
  CLAIMS_BOARD_ADDRESS,
  WALLET_DISCLAIMER,
  getExplorerAddressUrl,
  getExplorerTxUrl,
} from "../config/chain";
import { useWallet } from "../context/WalletContext";
import {
  getCitation,
  listCitationIds,
  registerCitationFlow,
  auditCitationFlow,
  publishClaimFlow,
  refreshClaimFlow,
  getClaim,
  listClaimIds,
  getClaimsLedgerAddress,
  getClaimsOwner,
  setLedgerFlow,
  getLocalUserCitationIds,
  getLocalUserClaimIds,
  getAccountBalance,
} from "../services/contractService";
import {
  mapVerdict,
  type CitationRecord,
  type AuditRecord,
  type ClaimBadgeRecord,
} from "../lib/outcome";
import { TxPipelineModal } from "../components/TxPipelineModal";
import { FundingModal } from "../components/FundingModal";
import {
  CitationCardSkeleton,
  CitationDetailSkeleton,
  ClaimCardSkeleton,
} from "../components/SkeletonLoader";
import type { TxProgress } from "../lib/txLifecycle";

// Curated sample citations from verified on-chain evidence runs
const VERIFIED_SAMPLE_CITATION_IDS = [
  "fcca1095abb0", // Claude Shannon Information Theory
  "bbee352df865", // Ada Lovelace
  "a68c69aa9a4d", // Alan Turing
  "64032d9d1502", // Computing Hardware
];

export const Workbench: React.FC = () => {
  const { account, disclaimer } = useWallet();
  const [activeTab, setActiveTab] = useState<
    "explore" | "detail" | "register" | "audit" | "claims" | "admin" | "evidence"
  >("explore");

  // Selected citation state
  const [selectedCitationId, setSelectedCitationId] = useState<string>("");
  const [citationData, setCitationData] = useState<CitationRecord | null>(null);
  const [isCitationLoading, setIsCitationLoading] = useState(false);
  const [searchCitationId, setSearchCitationId] = useState("");

  // Explore tab live data
  const [userCitations, setUserCitations] = useState<CitationRecord[]>([]);
  const [sampleCitations, setSampleCitations] = useState<CitationRecord[]>([]);
  const [isExploreLoading, setIsExploreLoading] = useState(false);
  const [exploreRpcError, setExploreRpcError] = useState<string | null>(null);

  // Registration form state
  const [regLabel, setRegLabel] = useState("Ada Lovelace Mathematical Eminence");
  const [regUrl, setRegUrl] = useState("https://en.wikipedia.org/w/index.php?title=Ada_Lovelace&oldid=1374881938");
  const [regQuotes, setRegQuotes] = useState<string[]>([
    'In a letter to Lady Byron, De Morgan suggested that Ada\'s skill in mathematics might lead her to become "an original mathematical investigator, perhaps of first-rate eminence".',
  ]);
  const [newQuoteText, setNewQuoteText] = useState("");

  // Audit form state
  const [auditTargetUrl, setAuditTargetUrl] = useState("https://en.wikipedia.org/w/index.php?title=Ada_Lovelace&oldid=1379797630");

  // Claims Board form state
  const [claimCitationId, setClaimCitationId] = useState("");
  const [claimHeadline, setClaimHeadline] = useState("");
  const [selectedClaimId, setSelectedClaimId] = useState("");
  const [liveClaims, setLiveClaims] = useState<ClaimBadgeRecord[]>([]);
  const [isClaimsLoading, setIsClaimsLoading] = useState(false);

  // Admin state
  const [adminLedgerAddress, setAdminLedgerAddress] = useState<string>(SOURCE_DRIFT_LEDGER_ADDRESS);
  const [currentLinkedLedger, setCurrentLinkedLedger] = useState<string>("");
  const [claimsOwner, setClaimsOwner] = useState<string>("");

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [txProgress, setTxProgress] = useState<TxProgress | null>(null);
  const [showFundingModal, setShowFundingModal] = useState(false);

  // In-memory cache to avoid redundant RPC calls
  const citationCacheRef = useRef<Map<string, CitationRecord>>(new Map());
  const claimCacheRef = useRef<Map<string, ClaimBadgeRecord>>(new Map());

  const fetchCachedCitation = async (cid: string): Promise<CitationRecord | null> => {
    if (citationCacheRef.current.has(cid)) {
      return citationCacheRef.current.get(cid)!;
    }
    const rec = await getCitation(cid);
    if (rec) citationCacheRef.current.set(cid, rec);
    return rec;
  };

  const fetchCachedClaim = async (claimId: string): Promise<ClaimBadgeRecord | null> => {
    if (claimCacheRef.current.has(claimId)) {
      return claimCacheRef.current.get(claimId)!;
    }
    const c = await getClaim(claimId);
    if (c) claimCacheRef.current.set(claimId, c);
    return c;
  };

  // Pre-write validation guard: validates account presence and queries RPC balance
  const runPreWriteGuard = async (): Promise<boolean> => {
    if (!account || !account.address) {
      alert("No active preview account found. Please open the Wallet modal in the header to generate a throwaway key.");
      return false;
    }
    try {
      await getAccountBalance(String(account.address));
      return true;
    } catch (err) {
      console.warn("Pre-write balance query warning:", err);
      return true;
    }
  };

  // Hydrate Explore tab from chain
  const loadExploreData = async () => {
    setIsExploreLoading(true);
    setExploreRpcError(null);
    try {
      // 1. Hydrate User Citations from localStorage
      const userIds = getLocalUserCitationIds();
      const userRecords: CitationRecord[] = [];
      for (const uid of userIds) {
        try {
          const rec = await fetchCachedCitation(uid);
          if (rec) userRecords.push(rec);
        } catch {
          // ignore individual fetch errors
        }
      }
      setUserCitations(userRecords);

      // 2. Hydrate Sample Citations from known verified IDs
      const sampleRecords: CitationRecord[] = [];
      for (const sid of VERIFIED_SAMPLE_CITATION_IDS) {
        try {
          const rec = await fetchCachedCitation(sid);
          if (rec) sampleRecords.push(rec);
        } catch {
          // ignore
        }
      }
      setSampleCitations(sampleRecords);
    } catch (err: any) {
      console.error("Explore hydration error:", err);
      setExploreRpcError(
        "Could not load live on-chain citations from Studionet RPC. Please check your connection and retry."
      );
    } finally {
      setIsExploreLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadExploreData();
  }, []);

  // Fetch citation details when selectedCitationId changes
  const loadCitationDetails = async (cid: string) => {
    if (!cid.trim()) return;
    setIsCitationLoading(true);
    setCitationData(null);
    try {
      const data = await getCitation(cid.trim());
      setCitationData(data);
      if (data) {
        citationCacheRef.current.set(cid.trim(), data);
      }
    } catch (err) {
      console.error("Failed to fetch citation details:", err);
      setCitationData(null);
    } finally {
      setIsCitationLoading(false);
    }
  };

  useEffect(() => {
    if (selectedCitationId) {
      loadCitationDetails(selectedCitationId);
    }
  }, [selectedCitationId]);

  // Load Claims Data
  const loadClaimsData = async () => {
    setIsClaimsLoading(true);
    try {
      const userClaimIds = getLocalUserClaimIds();
      const onChainIds = await listClaimIds(0, 10);
      const allIds = Array.from(new Set([...userClaimIds, ...onChainIds]));

      const loaded: ClaimBadgeRecord[] = [];
      for (const id of allIds) {
        try {
          const c = await fetchCachedClaim(id);
          if (c) loaded.push(c);
        } catch {
          // continue
        }
      }
      setLiveClaims(loaded);
    } catch (err) {
      console.warn("Failed to list live claims:", err);
    } finally {
      setIsClaimsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "claims") {
      loadClaimsData();
    }
  }, [activeTab]);

  // Load Admin Data
  useEffect(() => {
    if (activeTab === "admin") {
      getClaimsLedgerAddress().then(setCurrentLinkedLedger).catch(() => {});
      getClaimsOwner().then(setClaimsOwner).catch(() => {});
    }
  }, [activeTab]);

  // Handlers for Write Transactions
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!(await runPreWriteGuard())) return;

    setTxProgress({ stage: "idle" });
    setIsModalOpen(true);
    setModalTitle("Register Citation Baseline");
    try {
      const { citationId } = await registerCitationFlow(
        account,
        regLabel,
        regUrl,
        regQuotes,
        setTxProgress
      );
      setSelectedCitationId(citationId);
      setClaimCitationId(citationId);
      setActiveTab("detail");
    } catch (err: any) {
      console.error(err);
      setTxProgress((prev) => ({
        ...prev,
        stage: "reverted",
        decodedRevert: err?.message || "Contract execution failed",
      }));
    }
  };

  const handleAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!(await runPreWriteGuard())) return;

    setTxProgress({ stage: "idle" });
    setIsModalOpen(true);
    setModalTitle("Audit Citation Target");
    try {
      await auditCitationFlow(account, selectedCitationId, auditTargetUrl, setTxProgress);
      loadCitationDetails(selectedCitationId);
      setActiveTab("detail");
    } catch (err: any) {
      console.error(err);
      setTxProgress((prev) => ({
        ...prev,
        stage: "reverted",
        decodedRevert: err?.message || "Contract execution failed",
      }));
    }
  };

  const handlePublishClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!(await runPreWriteGuard())) return;

    setTxProgress({ stage: "idle" });
    setIsModalOpen(true);
    setModalTitle("Publish Claim on ClaimsBoard");
    try {
      const { claimId } = await publishClaimFlow(account, claimCitationId, claimHeadline, setTxProgress);
      setSelectedClaimId(claimId);
      loadClaimsData();
    } catch (err: any) {
      console.error(err);
      setTxProgress((prev) => ({
        ...prev,
        stage: "reverted",
        decodedRevert: err?.message || "Contract execution failed",
      }));
    }
  };

  const handleRefreshClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!(await runPreWriteGuard())) return;

    setTxProgress({ stage: "idle" });
    setIsModalOpen(true);
    setModalTitle("Refresh Claim Badge");
    try {
      await refreshClaimFlow(account, selectedClaimId, setTxProgress);
      loadClaimsData();
    } catch (err: any) {
      console.error(err);
      setTxProgress((prev) => ({
        ...prev,
        stage: "reverted",
        decodedRevert: err?.message || "Contract execution failed",
      }));
    }
  };

  const handleSetLedger = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!(await runPreWriteGuard())) return;

    setTxProgress({ stage: "idle" });
    setIsModalOpen(true);
    setModalTitle("Update ClaimsBoard Linked Ledger");
    try {
      await setLedgerFlow(account, adminLedgerAddress, setTxProgress);
      getClaimsLedgerAddress().then(setCurrentLinkedLedger).catch(() => {});
    } catch (err: any) {
      console.error(err);
      setTxProgress({
        stage: "reverted",
        decodedRevert: err?.message || "Contract execution failed",
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans text-base">
      {/* Subnav Tabs */}
      <div className="border-b border-slate-800 bg-slate-900/50 px-4 sm:px-6">
        <nav
          aria-label="Workbench navigation tabs"
          role="tablist"
          className="mx-auto max-w-7xl flex space-x-1 overflow-x-auto py-2.5"
        >
          {(
            [
              { id: "explore", label: "Explore Citations" },
              { id: "detail", label: "Citation Detail" },
              { id: "register", label: "Register Citation" },
              { id: "audit", label: "Run Audit" },
              { id: "claims", label: "Claims Board" },
              { id: "admin", label: "Admin & Ledger" },
              { id: "evidence", label: "Honest Evidence" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-[44px] rounded-xl px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                activeTab === tab.id
                  ? "bg-cyan-500 text-slate-950 font-bold"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 mx-auto max-w-7xl w-full p-4 sm:p-6 lg:p-8">
        {/* TAB 1: EXPLORE */}
        {activeTab === "explore" && (
          <section aria-labelledby="explore-citations-title" className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 id="explore-citations-title" className="text-2xl font-bold text-white">
                  Explore On-Chain Citations
                </h1>
                <p className="text-sm text-slate-300 mt-1">
                  State hydrated directly from SourceDriftLedger and ClaimsBoard on GenLayer Studionet (Preview).
                </p>
              </div>

              {/* Direct ID Search & Refresh */}
              <div className="flex items-center space-x-2">
                <label htmlFor="search-citation-input" className="sr-only">
                  Paste 12-char Citation ID
                </label>
                <input
                  id="search-citation-input"
                  type="text"
                  placeholder="Paste 12-char Citation ID..."
                  value={searchCitationId}
                  onChange={(e) => setSearchCitationId(e.target.value)}
                  className="min-h-[44px] rounded-xl border border-slate-700 bg-slate-900 px-3.5 text-sm font-mono text-white focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-400 w-56 sm:w-64"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (searchCitationId.trim()) {
                      setSelectedCitationId(searchCitationId.trim());
                      setActiveTab("detail");
                    }
                  }}
                  className="min-h-[44px] rounded-xl bg-cyan-500 px-4 text-sm font-bold text-slate-950 hover:bg-cyan-400 transition-colors focus-visible:ring-2 focus-visible:ring-white"
                >
                  Inspect
                </button>
                <button
                  type="button"
                  onClick={loadExploreData}
                  disabled={isExploreLoading}
                  aria-label="Reload citations from chain"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-slate-200 hover:text-white hover:border-slate-500 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400"
                >
                  <RefreshCw className={`h-4 w-4 ${isExploreLoading ? "animate-spin" : ""}`} aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* RPC Error State with Retry Button */}
            {exploreRpcError && (
              <div className="rounded-2xl border border-rose-800 bg-rose-950/60 p-5 text-rose-200">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <AlertCircle className="h-5 w-5 text-rose-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                    <div>
                      <p className="font-bold text-rose-300">RPC Communication Error</p>
                      <p className="text-sm text-rose-200 mt-1">{exploreRpcError}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={loadExploreData}
                    className="min-h-[44px] rounded-xl bg-rose-800 px-4 text-xs font-bold text-white hover:bg-rose-700 ml-4 flex-shrink-0 transition-colors focus-visible:ring-2 focus-visible:ring-white"
                  >
                    Retry
                  </button>
                </div>
              </div>
            )}

            {/* Skeletons while loading */}
            {isExploreLoading && (
              <div className="space-y-4">
                <p className="text-xs text-slate-300">Querying active contracts on GenLayer Studionet (Preview)...</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <CitationCardSkeleton />
                  <CitationCardSkeleton />
                  <CitationCardSkeleton />
                </div>
              </div>
            )}

            {/* Section 1: User Citations in this browser session */}
            {!isExploreLoading && userCitations.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <h3 className="text-lg font-bold text-white">Your citations (Local Session)</h3>
                  <span className="rounded-full bg-cyan-900/60 text-cyan-300 text-xs px-2.5 py-0.5 font-mono font-bold">
                    {userCitations.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {userCitations.map((c) => {
                    return (
                      <div
                        key={c.citation_id}
                        className="rounded-2xl border border-cyan-700/60 bg-slate-900/80 p-5 flex flex-col justify-between hover:border-cyan-500 transition-all"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                              {c.status}
                            </span>
                            <span className="text-xs text-slate-300 font-semibold">{c.audits_total} audits</span>
                          </div>
                          <h4 className="text-base font-bold text-white mb-1">{c.label}</h4>
                          <p className="text-xs text-slate-300 mb-2">{c.baseline_title} (rev {c.baseline_oldid})</p>
                          <p className="font-mono text-xs text-cyan-400 break-all">{c.citation_id}</p>
                        </div>
                        <div className="mt-4 pt-3 border-t border-slate-800 flex justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCitationId(c.citation_id);
                              setActiveTab("detail");
                            }}
                            className="min-h-[44px] text-xs font-bold text-cyan-400 hover:text-cyan-300 hover:underline inline-flex items-center space-x-1 focus-visible:ring-2 focus-visible:ring-cyan-400"
                          >
                            <span>Inspect Details &rarr;</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Section 2: Verified Sample Citations */}
            {!isExploreLoading && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white">
                      Verified sample citations (IDs from our evidence run)
                    </h3>
                    <p className="text-xs text-slate-300">
                      Each card is hydrated directly from SourceDriftLedger on GenLayer Studionet (Preview).
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sampleCitations.map((c) => {
                    return (
                      <div
                        key={c.citation_id}
                        className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 flex flex-col justify-between hover:border-slate-700 transition-all"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
                              {c.status}
                            </span>
                            <span className="text-xs text-slate-300 font-semibold">{c.audits_total} audits</span>
                          </div>
                          <h4 className="text-base font-bold text-white mb-1">{c.label}</h4>
                          <p className="text-xs text-slate-300 mb-2">{c.baseline_title} (rev {c.baseline_oldid})</p>
                          <p className="font-mono text-xs text-cyan-400 break-all">{c.citation_id}</p>
                        </div>
                        <div className="mt-4 pt-3 border-t border-slate-800 flex justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCitationId(c.citation_id);
                              setActiveTab("detail");
                            }}
                            className="min-h-[44px] text-xs font-bold text-cyan-400 hover:text-cyan-300 hover:underline inline-flex items-center space-x-1 focus-visible:ring-2 focus-visible:ring-cyan-400"
                          >
                            <span>Inspect Details &rarr;</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        {/* TAB 2: CITATION DETAIL */}
        {activeTab === "detail" && (
          <section aria-labelledby="citation-detail-title" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 id="citation-detail-title" className="text-2xl font-bold text-white">
                  Citation Baseline &amp; Drift History
                </h1>
                <p className="text-sm text-slate-300 mt-1">
                  On-chain baseline records and sequential validator drift audits.
                </p>
              </div>

              {/* Selector */}
              <div className="flex items-center space-x-2">
                <label htmlFor="detail-citation-id-input" className="sr-only">
                  Citation ID
                </label>
                <input
                  id="detail-citation-id-input"
                  type="text"
                  value={selectedCitationId}
                  onChange={(e) => setSelectedCitationId(e.target.value)}
                  placeholder="12-char Citation ID"
                  className="min-h-[44px] rounded-xl border border-slate-700 bg-slate-900 px-3.5 text-xs font-mono text-white focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-400 w-44"
                />
                <button
                  type="button"
                  onClick={() => loadCitationDetails(selectedCitationId)}
                  disabled={isCitationLoading}
                  className="min-h-[44px] rounded-xl bg-slate-800 px-3 text-xs font-bold text-slate-200 hover:bg-slate-700 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400"
                >
                  Load
                </button>
              </div>
            </div>

            {/* Loading Skeleton */}
            {isCitationLoading ? (
              <CitationDetailSkeleton />
            ) : citationData ? (
              <div className="space-y-6">
                {/* Main Card */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-mono text-cyan-400 font-bold block mb-1">
                        ID: {citationData.citation_id}
                      </span>
                      <h3 className="text-xl font-bold text-white">{citationData.label}</h3>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold px-3 py-1 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800">
                        Status: {citationData.status}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-800 text-xs">
                    <div>
                      <span className="text-slate-300 font-semibold block mb-1">Wikipedia Article:</span>
                      <span className="font-semibold text-white">{citationData.baseline_title}</span>
                    </div>
                    <div>
                      <span className="text-slate-300 font-semibold block mb-1">Baseline Revision:</span>
                      <span className="font-mono text-slate-200 font-semibold">{citationData.baseline_oldid}</span>
                    </div>
                    <div>
                      <span className="text-slate-300 font-semibold block mb-1">Total Audits:</span>
                      <span className="font-semibold text-white">{citationData.audits_total}</span>
                    </div>
                    <div>
                      <span className="text-slate-300 font-semibold block mb-1">Registrant:</span>
                      <span className="font-mono text-slate-200 font-semibold break-all">{citationData.registrant}</span>
                    </div>
                  </div>

                  <div className="pt-2 text-xs">
                    <span className="text-slate-300 font-semibold block mb-1">Baseline SHA-256 Fingerprint:</span>
                    <span className="font-mono text-slate-300 break-all">{citationData.baseline_text_sha256}</span>
                  </div>
                  <div className="mt-2 text-xs">
                    <span className="text-slate-300 font-semibold block mb-1">Baseline URL:</span>
                    <a
                      href={citationData.baseline_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-cyan-400 hover:underline break-all font-mono"
                    >
                      {citationData.baseline_url}
                    </a>
                  </div>
                </div>

                {/* Claim Elements */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
                  <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider mb-3">
                    Registered Claim Quotes
                  </h3>
                  <div className="space-y-3">
                    {citationData.elements?.map((elem, idx) => (
                      <div key={idx} className="rounded-xl bg-slate-950 p-4 text-sm text-slate-200 border border-slate-800">
                        <span className="text-slate-300 mr-2 text-xs font-mono font-bold">[{elem.id}]</span>
                        <span className="italic font-serif">&ldquo;{elem.quote}&rdquo;</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Audit History */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
                  <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider">
                    Recorded Audits ({citationData.audits?.length || 0})
                  </h3>

                  {citationData.audits && citationData.audits.length > 0 ? (
                    <div className="space-y-4">
                      {citationData.audits.map((a, i) => {
                        const verdict = mapVerdict(a.class);
                        return (
                          <div key={i} className="rounded-xl bg-slate-950 p-5 text-sm border border-slate-800 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center space-x-3">
                                <span className="font-bold text-base text-white">Audit #{a.n}</span>
                                <span className="rounded px-2.5 py-0.5 text-xs font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
                                  {a.class}
                                </span>
                              </div>
                              <span className="text-xs text-slate-300 font-mono font-semibold">
                                {a.target_kind} {a.target_oldid ? `(oldid ${a.target_oldid})` : "(LIVE)"}
                              </span>
                            </div>

                            <p className="text-xs text-slate-300 leading-relaxed">{verdict.explanation}</p>

                            {/* Elements in Audit */}
                            {a.elements && a.elements.length > 0 && (
                              <div className="space-y-2 pt-2 border-t border-slate-800/80">
                                {a.elements.map((el, elIdx) => (
                                  <div key={elIdx} className="rounded-lg bg-slate-900 p-3 text-xs space-y-1">
                                    <div className="flex items-center justify-between">
                                      <span className="text-slate-300 font-mono font-semibold">Element {el.id}</span>
                                      <span className="font-bold text-cyan-300">Status: {el.status}</span>
                                    </div>
                                    {el.cited_quote && (
                                      <p className="text-emerald-300 text-xs italic bg-emerald-950/20 p-2 rounded border border-emerald-900/40">
                                        &ldquo;{el.cited_quote}&rdquo;
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-800 p-6 text-center space-y-2">
                      <p className="text-xs text-slate-300 font-medium">No audits recorded yet for this citation.</p>
                      <button
                        type="button"
                        onClick={() => setActiveTab("audit")}
                        className="min-h-[44px] px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-colors"
                      >
                        Run Drift Audit on this Citation
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Informative Empty State */
              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center space-y-4">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800 text-cyan-400">
                  <FileText className="h-6 w-6" aria-hidden="true" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-white">No Citation Selected</h3>
                  <p className="text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
                    Select a verified sample citation from Explore or register a new Wikipedia citation baseline to inspect quotes, sha256 fingerprints, and validator audit history.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab("explore")}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400"
                  >
                    Browse Explore Citations
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("register")}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-colors focus-visible:ring-2 focus-visible:ring-white"
                  >
                    Register New Baseline
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* TAB 3: REGISTER */}
        {activeTab === "register" && (
          <section aria-labelledby="register-citation-title" className="max-w-2xl mx-auto space-y-6">
            <div>
              <h1 id="register-citation-title" className="text-2xl font-bold text-white">
                Register New Citation Baseline
              </h1>
              <p className="text-sm text-slate-300 mt-1 leading-relaxed">
                Submits a Wikipedia article revision permalink and extracted verbatim claim quotes for validator consensus.
              </p>
            </div>

            <form onSubmit={handleRegister} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-5">
              <div>
                <label htmlFor="reg-label-input" className="text-sm text-slate-200 font-semibold block mb-1.5">
                  Citation Label
                </label>
                <input
                  id="reg-label-input"
                  type="text"
                  value={regLabel}
                  onChange={(e) => setRegLabel(e.target.value)}
                  placeholder="e.g. Ada Lovelace Mathematical Eminence"
                  className="min-h-[44px] w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 text-sm text-white focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  required
                />
              </div>

              <div>
                <label htmlFor="reg-url-input" className="text-sm text-slate-200 font-semibold block mb-1.5">
                  Wikipedia Baseline Revision Permalink
                </label>
                <input
                  id="reg-url-input"
                  type="text"
                  value={regUrl}
                  onChange={(e) => setRegUrl(e.target.value)}
                  placeholder="https://en.wikipedia.org/w/index.php?title=...&oldid=..."
                  className="min-h-[44px] w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 text-sm font-mono text-white focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  required
                />
                <p className="text-xs text-slate-300 mt-1.5">
                  Must be an en.wikipedia.org permalink containing the explicit baseline `oldid` query parameter.
                </p>
              </div>

              <div>
                <label className="text-sm text-slate-200 font-semibold block mb-1.5">
                  Verbatim Quotation Elements ({regQuotes.length})
                </label>
                <div className="space-y-2 mb-3">
                  {regQuotes.map((q, idx) => (
                    <div key={idx} className="flex items-center justify-between rounded-xl bg-slate-950 p-3 border border-slate-800">
                      <p className="text-xs text-slate-200 italic mr-2">&ldquo;{q}&rdquo;</p>
                      <button
                        type="button"
                        onClick={() => setRegQuotes(regQuotes.filter((_, i) => i !== idx))}
                        className="min-h-[44px] text-xs font-semibold text-rose-400 hover:text-rose-300 px-2"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>

                {regQuotes.length < 3 && (
                  <div className="flex space-x-2">
                    <label htmlFor="add-quote-input" className="sr-only">
                      Add additional quote
                    </label>
                    <input
                      id="add-quote-input"
                      type="text"
                      placeholder="Add verbatim sentence from baseline..."
                      value={newQuoteText}
                      onChange={(e) => setNewQuoteText(e.target.value)}
                      className="min-h-[44px] flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3.5 text-xs text-white focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newQuoteText.trim()) {
                          setRegQuotes([...regQuotes, newQuoteText.trim()]);
                          setNewQuoteText("");
                        }
                      }}
                      className="min-h-[44px] rounded-xl bg-slate-800 px-4 text-xs font-bold text-slate-200 hover:bg-slate-700 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400"
                    >
                      Add Quote
                    </button>
                  </div>
                )}
              </div>

              {/* Inline Funding Callout and Submit */}
              <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-[11px] text-amber-300 font-semibold">{WALLET_DISCLAIMER}</p>
                  <div className="flex items-center space-x-2 text-xs text-slate-300">
                    <span>Studionet (Preview) &middot; Gas: 0 GEN &middot; Consensus evaluated</span>
                    <button
                      type="button"
                      onClick={() => setShowFundingModal(true)}
                      className="inline-flex min-h-[44px] items-center text-cyan-400 hover:text-cyan-300 hover:underline font-bold focus-visible:ring-2 focus-visible:ring-cyan-400"
                    >
                      [Gas &amp; Funds Guide]
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  className="min-h-[44px] rounded-xl bg-cyan-500 px-6 py-2.5 text-sm font-bold text-slate-950 hover:bg-cyan-400 shadow-lg shadow-cyan-500/25 transition-colors focus-visible:ring-2 focus-visible:ring-white"
                >
                  Submit Registration
                </button>
              </div>
            </form>
          </section>
        )}

        {/* TAB 4: AUDIT */}
        {activeTab === "audit" && (
          <section aria-labelledby="drift-audit-title" className="max-w-2xl mx-auto space-y-6">
            <div>
              <h1 id="drift-audit-title" className="text-2xl font-bold text-white">
                Execute Citation Drift Audit
              </h1>
              <p className="text-sm text-slate-300 mt-1 leading-relaxed">
                Audit a registered baseline against a later revision permalink or the current LIVE Wikipedia page.
              </p>
            </div>

            <form onSubmit={handleAudit} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-5">
              <div>
                <label htmlFor="audit-citation-id-input" className="text-sm text-slate-200 font-semibold block mb-1.5">
                  Target Citation ID
                </label>
                <input
                  id="audit-citation-id-input"
                  type="text"
                  value={selectedCitationId}
                  onChange={(e) => setSelectedCitationId(e.target.value)}
                  placeholder="12-char Citation ID (e.g. bbee352df865)"
                  className="min-h-[44px] w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 text-sm font-mono text-white focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  required
                />
              </div>

              <div>
                <label htmlFor="audit-target-url-input" className="text-sm text-slate-200 font-semibold block mb-1.5">
                  Target URL
                </label>
                <input
                  id="audit-target-url-input"
                  type="text"
                  value={auditTargetUrl}
                  onChange={(e) => setAuditTargetUrl(e.target.value)}
                  placeholder="https://en.wikipedia.org/w/index.php?title=...&oldid=... or /wiki/Title"
                  className="min-h-[44px] w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 text-sm font-mono text-white focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  required
                />
                <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                  Revision permalink or clean LIVE page path. Note: 300s cooldown applies to LIVE page audits.
                </p>
              </div>

              {/* Inline Funding Callout and Submit */}
              <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-[11px] text-amber-300 font-semibold">{WALLET_DISCLAIMER}</p>
                  <div className="flex items-center space-x-2 text-xs text-slate-300">
                    <span>Studionet (Preview) &middot; Gas: 0 GEN &middot; Consensus evaluated</span>
                    <button
                      type="button"
                      onClick={() => setShowFundingModal(true)}
                      className="inline-flex min-h-[44px] items-center text-cyan-400 hover:text-cyan-300 hover:underline font-bold focus-visible:ring-2 focus-visible:ring-cyan-400"
                    >
                      [Gas &amp; Funds Guide]
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  className="min-h-[44px] rounded-xl bg-cyan-500 px-6 py-2.5 text-sm font-bold text-slate-950 hover:bg-cyan-400 shadow-lg shadow-cyan-500/25 transition-colors focus-visible:ring-2 focus-visible:ring-white"
                >
                  Execute Audit Transaction
                </button>
              </div>
            </form>
          </section>
        )}

        {/* TAB 5: CLAIMS BOARD */}
        {activeTab === "claims" && (
          <section aria-labelledby="claims-board-title" className="max-w-2xl mx-auto space-y-6">
            <div>
              <h1 id="claims-board-title" className="text-2xl font-bold text-white">
                ClaimsBoard Cross-Contract Integration
              </h1>
              <p className="text-sm text-slate-300 mt-1 leading-relaxed">
                Proves cross-contract reuse: external dApps publish assertions bound to citations and synchronize dynamic drift badges.
              </p>
            </div>

            {/* Publish Form */}
            <form onSubmit={handlePublishClaim} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
              <h3 className="text-base font-bold text-cyan-400">Publish New Assertion</h3>
              <div>
                <label htmlFor="claim-citation-id-input" className="text-xs text-slate-200 font-semibold block mb-1">
                  Referenced Citation ID
                </label>
                <input
                  id="claim-citation-id-input"
                  type="text"
                  value={claimCitationId}
                  onChange={(e) => setClaimCitationId(e.target.value)}
                  className="min-h-[44px] w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 text-xs font-mono text-white focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  required
                />
              </div>
              <div>
                <label htmlFor="claim-headline-input" className="text-xs text-slate-200 font-semibold block mb-1">
                  Claim Headline (10 to 140 chars)
                </label>
                <textarea
                  id="claim-headline-input"
                  rows={2}
                  value={claimHeadline}
                  onChange={(e) => setClaimHeadline(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  required
                />
              </div>

              {/* Inline Funding Callout and Submit */}
              <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-1">
                  <p className="text-[11px] text-amber-300 font-semibold">{WALLET_DISCLAIMER}</p>
                  <div className="flex items-center space-x-2 text-xs text-slate-300">
                    <span>Gas: 0 GEN &middot; Consensus evaluated</span>
                    <button
                      type="button"
                      onClick={() => setShowFundingModal(true)}
                      className="inline-flex min-h-[44px] items-center text-cyan-400 hover:underline font-bold focus-visible:ring-2 focus-visible:ring-cyan-400"
                    >
                      [Gas Guide]
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  className="min-h-[44px] rounded-xl bg-cyan-500 px-5 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition-colors focus-visible:ring-2 focus-visible:ring-white"
                >
                  Publish Assertion
                </button>
              </div>
            </form>

            {/* Refresh Claim Badge */}
            <form onSubmit={handleRefreshClaim} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
              <h3 className="text-base font-bold text-cyan-400">Refresh Claim Badge</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Calls `refresh_claim` on ClaimsBoard to query SourceDriftLedger and update the badge status.
              </p>
              <div>
                <label htmlFor="refresh-claim-id-input" className="text-xs text-slate-200 font-semibold block mb-1">
                  Claim ID
                </label>
                <input
                  id="refresh-claim-id-input"
                  type="text"
                  value={selectedClaimId}
                  onChange={(e) => setSelectedClaimId(e.target.value)}
                  className="min-h-[44px] w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 text-xs font-mono text-white focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  required
                />
              </div>

              {/* Inline Funding Callout and Submit */}
              <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-1">
                  <p className="text-[11px] text-amber-300 font-semibold">{WALLET_DISCLAIMER}</p>
                  <div className="flex items-center space-x-2 text-xs text-slate-300">
                    <span>Gas: 0 GEN &middot; Consensus evaluated</span>
                    <button
                      type="button"
                      onClick={() => setShowFundingModal(true)}
                      className="inline-flex min-h-[44px] items-center text-cyan-400 hover:underline font-bold focus-visible:ring-2 focus-visible:ring-cyan-400"
                    >
                      [Gas Guide]
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  className="min-h-[44px] rounded-xl bg-cyan-500 px-5 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition-colors focus-visible:ring-2 focus-visible:ring-white"
                >
                  Refresh Badge
                </button>
              </div>
            </form>

            {/* Live Claims on Board */}
            {isClaimsLoading ? (
              <div className="space-y-3">
                <ClaimCardSkeleton />
                <ClaimCardSkeleton />
              </div>
            ) : liveClaims.length > 0 ? (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                  Active Assertions on Board ({liveClaims.length})
                </h3>
                {liveClaims.map((claim) => (
                  <div
                    key={claim.id}
                    className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-2 hover:border-slate-700 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-cyan-400 font-bold">{claim.id}</span>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded font-bold uppercase ${
                          claim.badge === "VERIFIED"
                            ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                            : claim.badge === "DRIFTED"
                            ? "bg-amber-950 text-amber-300 border border-amber-800"
                            : "bg-rose-950 text-rose-300 border border-rose-800"
                        }`}
                      >
                        {claim.badge}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-white">&ldquo;{claim.headline}&rdquo;</p>
                    <div className="flex flex-wrap items-center justify-between text-xs text-slate-300 pt-2 border-t border-slate-800">
                      <span>Citation: <code className="font-mono text-cyan-300">{claim.citation_id}</code></span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedClaimId(claim.id);
                        }}
                        className="min-h-[44px] text-xs font-bold text-cyan-400 hover:underline"
                      >
                        Select for Refresh
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-800 p-6 text-center space-y-2">
                <p className="text-xs text-slate-300 font-medium">No claims published yet on the board.</p>
                <p className="text-xs text-slate-400">Assert a verifiable factual claim using the form above.</p>
              </div>
            )}
          </section>
        )}

        {/* TAB 6: ADMIN */}
        {activeTab === "admin" && (
          <section aria-labelledby="admin-title" className="max-w-2xl mx-auto space-y-6">
            <div>
              <h1 id="admin-title" className="text-2xl font-bold text-white">
                ClaimsBoard Administration
              </h1>
              <p className="text-sm text-slate-300 mt-1 leading-relaxed">
                Configure the linked SourceDriftLedger address on the ClaimsBoard contract.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
              <h3 className="text-base font-bold text-cyan-400">Contract Configuration</h3>
              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-slate-300 font-semibold block">ClaimsBoard Owner:</span>
                  <span className="font-mono text-slate-200 break-all">{claimsOwner || "Loading..."}</span>
                </div>
                <div>
                  <span className="text-slate-300 font-semibold block">Currently Configured Ledger Address:</span>
                  <span className="font-mono text-cyan-300 break-all">{currentLinkedLedger || "Loading..."}</span>
                </div>
              </div>

              <form onSubmit={handleSetLedger} className="mt-4 pt-4 border-t border-slate-800 space-y-4">
                <label htmlFor="admin-ledger-input" className="text-xs text-slate-200 font-semibold block">
                  Update Linked Ledger (`set_ledger`) - Owner Only
                </label>
                <input
                  id="admin-ledger-input"
                  type="text"
                  value={adminLedgerAddress}
                  onChange={(e) => setAdminLedgerAddress(e.target.value)}
                  className="min-h-[44px] w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 text-xs font-mono text-white focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  required
                />
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <p className="text-[11px] text-amber-300 font-semibold">{WALLET_DISCLAIMER}</p>
                  <button
                    type="submit"
                    className="min-h-[44px] rounded-xl bg-cyan-500 px-5 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition-colors focus-visible:ring-2 focus-visible:ring-white"
                  >
                    Execute set_ledger
                  </button>
                </div>
              </form>
            </div>
          </section>
        )}

        {/* TAB 7: EVIDENCE */}
        {activeTab === "evidence" && (
          <section aria-labelledby="evidence-title" className="space-y-6">
            <div>
              <h1 id="evidence-title" className="text-2xl font-bold text-white">
                Honest Evidence &amp; Verification Matrix
              </h1>
              <p className="text-sm text-slate-300 mt-1 leading-relaxed">
                Accurate, verifiable status of all drift classes and negative revert proofs.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="rounded-2xl border border-emerald-800/60 bg-slate-900/60 p-6">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 block mb-3">
                  Verified On-Chain (Accepted by Validators)
                </span>
                <ul className="text-sm space-y-2.5 text-slate-200 leading-relaxed">
                  <li><strong>SAME / UNCHANGED:</strong> Alan Turing rev 1380390650 (4/5 votes agreed).</li>
                  <li><strong>COSMETIC:</strong> Computing Hardware rev 1258760000 (3/5 votes agreed).</li>
                  <li><strong>MATERIAL:</strong> Python Language rev 1258761000 (3/5 votes agreed).</li>
                  <li><strong>Transition:</strong> SAME &rarr; COSMETIC sequential revisions.</li>
                  <li><strong>ClaimsBoard Reuse:</strong> Alan Turing assertion badge confirmed.</li>
                </ul>
              </div>

              <div className="rounded-2xl border border-rose-800/60 bg-slate-900/60 p-6">
                <span className="text-xs font-bold uppercase tracking-wider text-rose-400 block mb-3">
                  Unit-Tested Only &amp; On-Chain Reverts
                </span>
                <ul className="text-sm space-y-2.5 text-slate-200 leading-relaxed">
                  <li><strong>REMOVED:</strong> Unit-tested only. Real deletion calibration empirical margin: 0.1630. Attempted on-chain reverts: 4 transactions reverted with &quot;invalid model output&quot;.</li>
                  <li><strong>Negative Tests:</strong> 11 negative on-chain tests covering URL schemes, domains, oldid order, invalid model outputs, and unauthorized access.</li>
                </ul>
              </div>
            </div>
          </section>
        )}
      </div>

      {/* Transaction Lifecycle Modal */}
      <TxPipelineModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        progress={txProgress}
        title={modalTitle}
      />

      {/* Test Funds & Gas Guide Modal */}
      <FundingModal
        isOpen={showFundingModal}
        onClose={() => setShowFundingModal(false)}
      />
    </div>
  );
};
