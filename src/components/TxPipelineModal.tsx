import React, { useState, useEffect, useRef } from "react";
import { Check, Copy, ExternalLink, RefreshCw, AlertCircle, AlertTriangle, CheckCircle, Clock, X } from "lucide-react";
import { getExplorerTxUrl } from "../config/chain";
import type { PipelineStage, TxProgress } from "../lib/txLifecycle";
import { ModalPortal } from "./ModalPortal";
import { registerModalOpen, registerModalClose } from "../lib/modalManager";
import { Z_INDEX } from "../lib/zIndex";

interface TxPipelineModalProps {
  isOpen: boolean;
  onClose: () => void;
  progress: TxProgress | null;
  title?: string;
  onRetry?: () => void;
}

export function getAriaLiveAnnouncement(stage: PipelineStage | undefined, agreeCount?: number, totalVotes?: number): string {
  switch (stage) {
    case "signing":
      return "Transaction signing in progress";
    case "submitting":
      return "Submitting transaction to GenLayer Studionet (Preview)";
    case "consensus":
      return agreeCount !== undefined && totalVotes !== undefined
        ? `Validator consensus pending: ${agreeCount} of ${totalVotes} votes agreed`
        : "Validator consensus pending: awaiting validator evaluation and votes";
    case "accepted":
      return "Transaction accepted by validators";
    case "state_confirmed":
    case "complete":
      return "Transaction state confirmed on-chain";
    case "disagreed":
      return "Consensus disagreement: validators could not reach agreement";
    case "reverted":
      return "Contract execution reverted";
    case "timed_out":
      return "Transaction timed out waiting for consensus";
    default:
      return "Transaction idle";
  }
}

export const TxPipelineModal: React.FC<TxPipelineModalProps> = ({
  isOpen,
  onClose,
  progress,
  title = "Consensus Transaction",
  onRetry,
}) => {
  const [copiedHash, setCopiedHash] = useState(false);
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

  if (!isOpen || !progress) return null;

  const copyTxHash = () => {
    if (progress?.txHash) {
      navigator.clipboard.writeText(progress.txHash);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    }
  };

  const stage = progress.stage;
  const isTerminalSuccess = stage === "complete" || stage === "state_confirmed" || stage === "accepted";
  const isDisagreed = stage === "disagreed";
  const isTimedOut = stage === "timed_out";
  const isReverted = stage === "reverted";

  const liveAnnouncement = getAriaLiveAnnouncement(stage, progress.agreeCount, progress.totalVotes);

  return (
    <ModalPortal>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tx-pipeline-title"
        className={`fixed inset-0 ${Z_INDEX.modalOverlay} overflow-y-auto bg-black/80 backdrop-blur-sm p-2 sm:p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-[calc(1rem+env(safe-area-inset-top,0px))] flex flex-col justify-start items-center text-left`}
      >
        <div
          ref={dialogRef}
          className={`relative w-full max-w-lg m-auto rounded-2xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl flex flex-col max-h-[calc(100vh-2rem)] max-h-[calc(100dvh-2rem)] ${Z_INDEX.modalDialog} focus:outline-none`}
        >
          {/* Screen Reader ARIA Live Region */}
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="sr-only"
            id="tx-pipeline-announcement"
          >
            {liveAnnouncement}
          </div>

          {/* Sticky Header */}
          <div className="flex-shrink-0 flex items-start justify-between border-b border-slate-800 p-4 sm:p-6 pb-4">
            <div>
              <span className="text-xs uppercase tracking-wider text-cyan-400 font-bold inline-block mb-1">
                GenLayer Consensus Pipeline
              </span>
              <h3 id="tx-pipeline-title" className="text-lg sm:text-xl font-bold text-white break-words">
                {title}
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400"
              aria-label="Close dialog"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 overscroll-contain space-y-4">
            {/* Progress Pipeline Steps */}
            <div className="space-y-3">
              {/* Step 1: Submitting */}
              <div className="flex items-center space-x-3 text-sm">
                {stage === "signing" || stage === "submitting" ? (
                  <RefreshCw className="h-4 w-4 animate-spin text-cyan-400 flex-shrink-0" aria-hidden="true" />
                ) : stage !== "idle" ? (
                  <CheckCircle className="h-4 w-4 text-emerald-400 flex-shrink-0" aria-hidden="true" />
                ) : (
                  <Clock className="h-4 w-4 text-slate-600 flex-shrink-0" aria-hidden="true" />
                )}
                <span
                  className={
                    stage === "signing" || stage === "submitting"
                      ? "text-cyan-300 font-semibold"
                      : "text-slate-300"
                  }
                >
                  1. Signing &amp; Submitting to Studionet
                </span>
              </div>

              {/* Step 2: Consensus */}
              <div className="flex items-center space-x-3 text-sm">
                {stage === "consensus" ? (
                  <RefreshCw className="h-4 w-4 animate-spin text-cyan-400 flex-shrink-0" aria-hidden="true" />
                ) : isTerminalSuccess ? (
                  <CheckCircle className="h-4 w-4 text-emerald-400 flex-shrink-0" aria-hidden="true" />
                ) : isReverted ? (
                  <AlertTriangle className="h-4 w-4 text-rose-400 flex-shrink-0" aria-hidden="true" />
                ) : isDisagreed ? (
                  <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0" aria-hidden="true" />
                ) : (
                  <Clock className="h-4 w-4 text-slate-600 flex-shrink-0" aria-hidden="true" />
                )}
                <span
                  className={
                    stage === "consensus"
                      ? "text-cyan-300 font-semibold"
                      : isTerminalSuccess
                      ? "text-slate-300"
                      : isReverted
                      ? "text-rose-300 font-semibold"
                      : isDisagreed
                      ? "text-amber-300 font-semibold"
                      : "text-slate-300"
                  }
                >
                  2. Validator Execution &amp; Consensus
                  {progress.agreeCount !== undefined && progress.totalVotes !== undefined && (
                    <span className="ml-2 font-mono text-xs font-bold text-cyan-400">
                      ({progress.agreeCount}/{progress.totalVotes} votes agreed)
                    </span>
                  )}
                </span>
              </div>

              {/* Step 3: State Confirmed & Readback */}
              <div className="flex items-center space-x-3 text-sm">
                {stage === "state_confirmed" || stage === "complete" ? (
                  <CheckCircle className="h-4 w-4 text-emerald-400 flex-shrink-0" aria-hidden="true" />
                ) : isTerminalSuccess ? (
                  <RefreshCw className="h-4 w-4 animate-spin text-cyan-400 flex-shrink-0" aria-hidden="true" />
                ) : (
                  <Clock className="h-4 w-4 text-slate-600 flex-shrink-0" aria-hidden="true" />
                )}
                <span
                  className={
                    stage === "state_confirmed" || stage === "complete"
                      ? "text-emerald-400 font-semibold"
                      : stage === "accepted"
                      ? "text-cyan-300 font-semibold"
                      : "text-slate-300"
                  }
                >
                  3. Readback Verification &amp; Local State Update
                </span>
              </div>
            </div>

            {/* Informative Revert Banner */}
            {isReverted && (
              <div className="rounded-xl border border-rose-800 bg-rose-950/40 p-4">
                <div className="flex items-start space-x-2.5">
                  <AlertCircle className="h-5 w-5 text-rose-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="text-rose-200">
                    <p className="text-xs font-bold text-rose-300 uppercase tracking-wide">
                      Contract Execution Reverted by Validator Execution
                    </p>
                    <p className="mt-1 text-sm text-rose-200 break-words">
                      {progress.decodedRevert || "Transaction reverted during contract execution."}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Informative Disagreement Banner */}
            {isDisagreed && (
              <div className="rounded-xl border border-amber-800 bg-amber-950/40 p-4">
                <div className="flex items-start space-x-2.5">
                  <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <p className="text-xs font-bold text-amber-300 uppercase tracking-wide">
                      Validator Consensus Disagreement
                    </p>
                    <p className="mt-1 text-sm text-amber-200 break-words">
                      Validators did not reach consensus agreement. Transaction concluded with status UNDETERMINED.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Tx Hash & Explorer Link */}
            {progress.txHash && (
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
                <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
                  <span className="font-semibold">Transaction Hash</span>
                  <button
                    type="button"
                    onClick={copyTxHash}
                    className="min-h-[44px] flex items-center space-x-1 text-cyan-400 hover:text-cyan-300 font-semibold focus-visible:ring-2 focus-visible:ring-cyan-400"
                  >
                    {copiedHash ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copiedHash ? "Copied" : "Copy"}</span>
                  </button>
                </div>
                <p className="font-mono text-xs break-all text-slate-300">{progress.txHash}</p>
                <div className="mt-2.5 flex justify-end">
                  <a
                    href={getExplorerTxUrl(progress.txHash)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-[44px] items-center space-x-1.5 text-xs font-semibold text-cyan-400 hover:underline focus-visible:ring-2 focus-visible:ring-cyan-400"
                  >
                    <span>View on GenLayer Explorer</span>
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Sticky Footer */}
          <div className="flex-shrink-0 border-t border-slate-800 p-4 sm:p-6 pt-3 flex justify-end space-x-3">
            {onRetry && (isReverted || isDisagreed || isTimedOut) && (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex min-h-[44px] items-center rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-slate-700 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                Try Again
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-[44px] items-center rounded-xl bg-cyan-500 px-6 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition-colors focus-visible:ring-2 focus-visible:ring-white"
            >
              {isTerminalSuccess ? "Done" : "Dismiss"}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};
