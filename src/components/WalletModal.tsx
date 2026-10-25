import React, { useState, useEffect, useRef } from "react";
import { Check, Copy, RefreshCw, X, AlertCircle } from "lucide-react";
import { useWallet } from "../context/WalletContext";
import { ModalPortal } from "./ModalPortal";
import { registerModalOpen, registerModalClose } from "../lib/modalManager";
import { Z_INDEX } from "../lib/zIndex";

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WalletModal: React.FC<WalletModalProps> = ({ isOpen, onClose }) => {
  const { address, disclaimer, resetWallet, importKey } = useWallet();
  const [importKeyInput, setImportKeyInput] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [copiedAddr, setCopiedAddr] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement as HTMLElement;
      registerModalOpen();
      setImportError(null);

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

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopiedAddr(true);
      setTimeout(() => setCopiedAddr(false), 2000);
    }
  };

  const handleImport = (e: React.FormEvent) => {
    e.preventDefault();
    setImportError(null);
    if (!importKeyInput.trim()) return;

    if (importKey(importKeyInput.trim())) {
      onClose();
      setImportKeyInput("");
    } else {
      setImportError("Invalid private key format. Must be a 32-byte hex string (with optional 0x prefix).");
    }
  };

  return (
    <ModalPortal>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="wallet-modal-title"
        className={`fixed inset-0 ${Z_INDEX.modalOverlay} overflow-y-auto bg-black/80 backdrop-blur-sm p-2 sm:p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-[calc(1rem+env(safe-area-inset-top,0px))] flex flex-col justify-start sm:justify-center items-center text-left`}
      >
        <div
          ref={dialogRef}
          className={`relative w-full max-w-md my-auto rounded-2xl border border-slate-700 bg-slate-900 p-5 sm:p-6 text-slate-100 shadow-2xl flex flex-col max-h-[calc(100vh-2rem)] max-h-[calc(100dvh-2rem)] ${Z_INDEX.modalDialog} focus:outline-none`}
        >
          {/* Sticky Header */}
          <div className="flex-shrink-0 flex items-start justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 id="wallet-modal-title" className="text-lg font-bold text-white break-words">
                Wallet Connection
              </h3>
              <p className="mt-1 text-xs text-amber-300 font-semibold break-words">{disclaimer}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close wallet connection dialog"
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Scrollable Body */}
          <div
            tabIndex={0}
            role="region"
            aria-label="Wallet management details"
            className="flex-1 overflow-y-auto py-4 space-y-4 overscroll-contain focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-500"
          >
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5">
              <span className="text-xs text-slate-300 font-semibold block mb-1">Active Address</span>
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs break-all text-cyan-300">{address || "None"}</span>
                {address && (
                  <button
                    type="button"
                    onClick={copyAddress}
                    aria-label="Copy active address"
                    className="ml-2 flex h-11 w-11 items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400"
                  >
                    {copiedAddr ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  </button>
                )}
              </div>
            </div>

            <div>
              <button
                type="button"
                onClick={resetWallet}
                className="w-full flex min-h-[44px] items-center justify-center space-x-2 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Generate Fresh Key</span>
              </button>
            </div>

            {/* Import Key Form */}
            <form onSubmit={handleImport} className="pt-3 border-t border-slate-800">
              <label htmlFor="import-private-key-input" className="text-xs text-slate-300 font-semibold block mb-1.5">
                Import Existing Key
              </label>
              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                <input
                  id="import-private-key-input"
                  type="password"
                  placeholder="0x..."
                  value={importKeyInput}
                  onChange={(e) => {
                    setImportKeyInput(e.target.value);
                    if (importError) setImportError(null);
                  }}
                  className="flex-1 min-h-[44px] rounded-xl border border-slate-700 bg-slate-950 px-3.5 text-xs text-slate-100 font-mono focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                />
                <button
                  type="submit"
                  className="min-h-[44px] rounded-xl bg-cyan-500 px-5 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition-colors focus-visible:ring-2 focus-visible:ring-white"
                >
                  Import
                </button>
              </div>

              {importError && (
                <div role="alert" className="mt-2.5 flex items-start space-x-2 rounded-lg bg-rose-950/40 border border-rose-500/30 p-2.5 text-xs text-rose-300">
                  <AlertCircle className="h-4 w-4 text-rose-400 flex-shrink-0 mt-0.5" />
                  <span>{importError}</span>
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};
