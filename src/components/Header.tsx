import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { ExternalLink, Sparkles, Coins } from "lucide-react";
import { useWallet } from "../context/WalletContext";
import {
  SOURCE_DRIFT_LEDGER_ADDRESS,
  getExplorerAddressUrl,
} from "../config/chain";
import { FundingModal } from "./FundingModal";
import { WalkthroughModal, isTourDismissed } from "./WalkthroughModal";
import { WalletModal } from "./WalletModal";

export const Header: React.FC = () => {
  const { address } = useWallet();
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showFundingModal, setShowFundingModal] = useState(false);
  const [showWalkthroughModal, setShowWalkthroughModal] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (!isTourDismissed()) {
      setShowWalkthroughModal(true);
    }
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full overflow-x-hidden border-b border-slate-800 bg-slate-950/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-3 py-3 sm:px-6">
        {/* Brand */}
        <div className="flex items-center space-x-3 sm:space-x-6">
          <Link
            to="/"
            aria-label="CitationWatch Home"
            className="flex min-h-[44px] items-center space-x-2.5 sm:space-x-3 group focus-visible:ring-2 focus-visible:ring-cyan-400 rounded-xl"
          >
            <div className="h-9 w-9 overflow-hidden rounded-xl border border-cyan-500/30 bg-slate-900 p-1 transition-transform group-hover:scale-105 flex-shrink-0">
              <img src="/logo.svg" alt="" className="h-full w-full object-contain" />
            </div>
            <div>
              <span className="hidden min-[420px]:inline text-base sm:text-lg font-bold tracking-tight text-white group-hover:text-cyan-400 transition-colors">
                CitationWatch
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav aria-label="Main Navigation" className="hidden md:flex items-center space-x-1">
            <Link
              to="/"
              className={`min-h-[44px] inline-flex items-center rounded-lg px-3 py-2 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                location.pathname === "/"
                  ? "bg-slate-800 text-cyan-400"
                  : "text-slate-200 hover:bg-slate-900 hover:text-white"
              }`}
            >
              Overview
            </Link>
            <Link
              to="/app"
              className={`min-h-[44px] inline-flex items-center rounded-lg px-3 py-2 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                location.pathname.startsWith("/app") || location.pathname.startsWith("/workbench")
                  ? "bg-slate-800 text-cyan-400"
                  : "text-slate-200 hover:bg-slate-900 hover:text-white"
              }`}
            >
              Workbench
            </Link>
          </nav>
        </div>

        {/* Right Section: Tour, Funding Guide, Contracts & Wallet */}
        <div className="flex items-center space-x-1.5 sm:space-x-3">
          {/* Guided Tour Trigger */}
          <button
            type="button"
            onClick={() => setShowWalkthroughModal(true)}
            aria-label="Guided Tour"
            className="inline-flex min-h-[44px] items-center space-x-1.5 rounded-xl border border-slate-700 bg-slate-900/90 px-2.5 sm:px-3 py-2 text-xs font-semibold text-cyan-300 hover:border-cyan-500 hover:text-white hover:bg-slate-800 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            <Sparkles className="h-3.5 w-3.5 text-cyan-400 flex-shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">Guided Tour</span>
          </button>

          {/* Get Test Funds Trigger */}
          <button
            type="button"
            onClick={() => setShowFundingModal(true)}
            aria-label="Get Test Funds & Gas Guide"
            className="inline-flex min-h-[44px] items-center space-x-1.5 rounded-xl border border-slate-700 bg-slate-900/90 px-2.5 sm:px-3 py-2 text-xs font-semibold text-cyan-300 hover:border-cyan-500 hover:text-white hover:bg-slate-800 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            <Coins className="h-3.5 w-3.5 text-cyan-400 flex-shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">Get Test Funds</span>
          </button>

          {/* Contracts Pill */}
          <div className="hidden lg:flex min-h-[44px] items-center space-x-2 text-xs font-mono text-slate-300 border border-slate-800 rounded-xl px-3 py-1.5 bg-slate-900">
            <span className="text-slate-300 font-semibold">Ledger:</span>
            <a
              href={getExplorerAddressUrl(SOURCE_DRIFT_LEDGER_ADDRESS)}
              target="_blank"
              rel="noreferrer"
              className="min-h-[44px] inline-flex items-center text-cyan-400 hover:underline space-x-1 focus-visible:ring-2 focus-visible:ring-cyan-400 rounded"
            >
              <span>{SOURCE_DRIFT_LEDGER_ADDRESS.slice(0, 6)}...{SOURCE_DRIFT_LEDGER_ADDRESS.slice(-4)}</span>
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          </div>

          {/* Wallet Pill - Shortened address or Connect */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowWalletModal(true)}
              className="flex min-h-[44px] items-center space-x-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-cyan-500 hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <span className="font-mono">
                {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Connect"}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Wallet Management Modal rendered via ModalPortal into #modal-root */}
      <WalletModal
        isOpen={showWalletModal}
        onClose={() => setShowWalletModal(false)}
      />

      {/* Test Funds Guide Modal */}
      <FundingModal
        isOpen={showFundingModal}
        onClose={() => setShowFundingModal(false)}
      />

      {/* Guided Walkthrough Modal */}
      <WalkthroughModal
        isOpen={showWalkthroughModal}
        onClose={() => setShowWalkthroughModal(false)}
      />
    </header>
  );
};
