import React, { useState, useEffect, useRef } from "react";
import { Coins, ExternalLink, RefreshCw, X, ShieldAlert, CheckCircle2 } from "lucide-react";
import { useWallet } from "../context/WalletContext";
import { CHAIN_ID, NETWORK_STATUS, RPC_URL } from "../config/chain";
import { ModalPortal } from "./ModalPortal";
import { registerModalOpen, registerModalClose } from "../lib/modalManager";
import { Z_INDEX } from "../lib/zIndex";

interface FundingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FundingModal: React.FC<FundingModalProps> = ({ isOpen, onClose }) => {
  const { address, balance, refreshBalance, disclaimer } = useWallet();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement as HTMLElement;
      registerModalOpen();

      const timer = setTimeout(() => {
        if (dialogRef.current) {
          const focusable = Array.from(
            dialogRef.current.querySelectorAll<HTMLElement>(
              'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )
          ).filter((el) => el.offsetParent !== null || el.getClientRects().length > 0);
          if (focusable.length > 0) {
            focusable[0].focus();
          }
        }
      }, 50);

      return () => {
        registerModalClose();
        clearTimeout(timer);
        if (triggerRef.current && typeof triggerRef.current.focus === "function") {
          triggerRef.current.focus();
        }
      };
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "Tab" && dialogRef.current) {
        const focusable = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => el.offsetParent !== null);

        if (focusable.length === 0) return;

        const firstEl = focusable[0];
        const lastEl = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstEl) {
            e.preventDefault();
            lastEl.focus();
          }
        } else {
          if (document.activeElement === lastEl) {
            e.preventDefault();
            firstEl.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    setRefreshSuccess(false);
    try {
      await refreshBalance();
      setRefreshSuccess(true);
      setTimeout(() => setRefreshSuccess(false), 2500);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <ModalPortal>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="funding-modal-title"
        className={`fixed inset-0 ${Z_INDEX.modalOverlay} overflow-y-auto bg-black/80 backdrop-blur-sm p-2 sm:p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-[calc(1rem+env(safe-area-inset-top,0px))] flex flex-col justify-start items-center`}
      >
        <div
          ref={dialogRef}
          className={`relative w-full max-w-xl m-auto rounded-2xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl flex flex-col max-h-[calc(100vh-2rem)] max-h-[calc(100dvh-2rem)] ${Z_INDEX.modalDialog} focus:outline-none`}
        >
          {/* Sticky Header */}
          <div className="flex-shrink-0 flex items-start justify-between border-b border-slate-800 p-4 sm:p-6 pb-4">
            <div className="flex items-center space-x-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-950/80 border border-cyan-500/40 text-cyan-400">
                <Coins className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <h2 id="funding-modal-title" className="text-lg sm:text-xl font-bold tracking-tight text-white break-words">
                  Test Funds &amp; Gas Guide
                </h2>
                <p className="text-xs font-mono text-cyan-400 break-words">
                  {NETWORK_STATUS} (Chain ID: {CHAIN_ID})
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close funding guide"
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500 hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Scrollable Body */}
          <div
            tabIndex={0}
            role="region"
            aria-label="Funding instructions"
            className="flex-1 overflow-y-auto p-4 sm:p-6 overscroll-contain space-y-4 focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-500"
          >
            {/* Disclaimer Alert */}
            <div className="rounded-xl border border-amber-600/50 bg-amber-950/30 p-3.5 flex items-start space-x-3">
              <ShieldAlert className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-xs text-amber-200 leading-relaxed font-medium break-words">
                {disclaimer}
              </p>
            </div>

            {/* Balance Status Section */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Connected Throwaway Account
                </span>
                <button
                  type="button"
                  onClick={handleManualRefresh}
                  disabled={isRefreshing}
                  className="inline-flex min-h-[44px] items-center space-x-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 hover:border-cyan-500 hover:text-cyan-300 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} aria-hidden="true" />
                  <span>{isRefreshing ? "Checking..." : "Check Balance"}</span>
                </button>
              </div>

              <div className="mt-2 font-mono text-xs text-slate-300 break-all bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                {address || "No active account"}
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-slate-800/80 pt-3">
                <span className="text-sm font-medium text-slate-300">Available GEN Balance:</span>
                <span className="text-sm font-bold text-cyan-400 font-mono">
                  {balance !== null ? `${balance.toString()} GEN` : "0 GEN"}
                </span>
              </div>

              {refreshSuccess && (
                <div className="mt-2 flex items-center space-x-1.5 text-xs text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>RPC balance verified successfully from {RPC_URL}</span>
                </div>
              )}
            </div>

            {/* Measured Write Costs & Fee Structure */}
            <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <h3 className="text-sm font-bold text-white mb-2">Measured Transaction Costs on Studionet Preview</h3>
                <p>
                  On GenLayer Studionet (Preview), smart contracts are nondeterministic intelligent contracts executed and verified by AI validator consensus.
                </p>
                <ul className="mt-2 space-y-1.5 list-disc list-inside text-slate-300">
                  <li>
                    <strong className="text-slate-100">Native Transaction Gas:</strong> 0 GEN (empirically measured cost: 0 GEN on Studionet Preview).
                  </li>
                  <li>
                    <strong className="text-slate-100">Execution Mechanism:</strong> Transactions are processed by a leader validator and verified by peer validators.
                  </li>
                  <li>
                    <strong className="text-slate-100">Zero-Balance Support:</strong> Write transactions execute with 0 GEN balance on GenLayer Studionet (Preview). Ephemeral preview throwaway accounts can sign and submit transactions immediately without faucet funding. This behavior is backed by two dated empirical measurements:
                    <ul className="mt-1.5 ml-3 space-y-1 list-disc list-inside text-slate-300">
                      <li><strong>Experiment 1 (2026-10-24, key <code>0xE1876592e963bdA36324F1A2362B94280bFf6C21</code>):</strong> 3 of 4 write methods reached validator agreement on the first attempt; <code>register_citation</code> disagreed with 1/5 validator votes. 0 GEN consumed.</li>
                      <li><strong>Experiment 2 (2026-10-25, fresh key <code>0x15Fd0F2f7EA16D2ddc41d92bf48805563b893622</code>, balance 0 GEN):</strong> 4 of 4 write methods (<code>register_citation</code>, <code>audit_citation</code>, <code>publish_claim</code>, <code>refresh_claim</code>) reached validator agreement on first attempt with 3/5, 5/5, 3/5, and 3/5 votes without retries. 0 GEN consumed.</li>
                    </ul>
                    <p className="mt-1.5 text-slate-400">
                      Balances were read before and after each transaction using <code>eth_getBalance</code> JSON-RPC calls. Studionet Preview behavior may change in future network releases.
                    </p>
                  </li>
                </ul>
              </div>

              {/* Faucet Guidance */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <h3 className="text-sm font-bold text-white mb-2">How to Request Test Funds (Faucet)</h3>
                <p>
                  If a future network configuration activates native gas pricing:
                </p>
                <ol className="mt-2 space-y-1.5 list-decimal list-inside text-slate-300">
                  <li>Copy your throwaway address above using the copy button or header pill.</li>
                  <li>Visit the GenLayer Studio portal or developer community faucet channel.</li>
                  <li>Paste your address and request preview network tokens.</li>
                  <li>Return here and click <strong className="text-cyan-400">Check Balance</strong> to confirm receipt.</li>
                </ol>
                <div className="mt-3 flex flex-wrap gap-2 pt-2">
                  <a
                    href="https://studio.genlayer.com"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-[44px] items-center space-x-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-medium text-cyan-300 hover:border-cyan-400 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400"
                  >
                    <span>GenLayer Studio Portal</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  <a
                    href="https://explorer-studio.genlayer.com"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-[44px] items-center space-x-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-medium text-cyan-300 hover:border-cyan-400 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400"
                  >
                    <span>Studionet Explorer</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>

              {/* Low Balance & Revert Recovery */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <h3 className="text-sm font-bold text-white mb-2">Network Diagnostics &amp; Revert Recovery</h3>
                <p>
                  If a transaction fails with an unexpected error:
                </p>
                <ul className="mt-1.5 space-y-1 list-disc list-inside text-slate-300">
                  <li>Ensure your browser has access to the Studionet RPC endpoint (<code className="text-cyan-300">{RPC_URL}</code>).</li>
                  <li>If the network experiences validator latency or consensus timeouts, wait 30 seconds and retry.</li>
                  <li>You can reset to a fresh throwaway key anytime via the wallet modal.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Sticky Footer */}
          <div className="flex-shrink-0 border-t border-slate-800 p-4 sm:p-6 pt-3 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-6 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm transition-colors focus-visible:ring-2 focus-visible:ring-white"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};
