import React, { useState, useEffect, useRef } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  FileCheck,
  Search,
  Award,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { ModalPortal } from "./ModalPortal";
import { registerModalOpen, registerModalClose } from "../lib/modalManager";
import { Z_INDEX } from "../lib/zIndex";

interface WalkthroughModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TourStep {
  title: string;
  subtitle: string;
  description: string;
  icon: React.ReactNode;
  highlights: string[];
}

const TOUR_STEPS: TourStep[] = [
  {
    title: "Decentralized Citation Integrity",
    subtitle: "Tracking Wikipedia drift on GenLayer Studionet (Preview)",
    description:
      "Online citations decay when web pages and Wikipedia articles are edited, reorganized, or deleted. CitationWatch records verified quotation baselines on GenLayer intelligent contracts, evaluating future revisions with AI validator consensus.",
    icon: <BookOpen className="h-6 w-6 sm:h-7 sm:w-7 text-cyan-400" aria-hidden="true" />,
    highlights: [
      "Anchors exact baseline revision oldid and quote.",
      "Stores a sha256 fingerprint of the baseline quote.",
      "Records a baseline and detects later drift across revisions.",
    ],
  },
  {
    title: "1. Register Baseline Citation",
    subtitle: "Recording the baseline on-chain",
    description:
      "Enter any Wikipedia article URL, baseline revision oldid, and the exact quotation to track. When submitted, the SourceDriftLedger contract accepts and records the citation with a deterministic sha256 fingerprint.",
    icon: <FileCheck className="h-6 w-6 sm:h-7 sm:w-7 text-cyan-400" aria-hidden="true" />,
    highlights: [
      "Normalizes quote whitespace and typographic quotes.",
      "Derives a unique 12-character citation ID.",
      "Recorded on GenLayer Studionet (Preview).",
    ],
  },
  {
    title: "2. Audit Source Drift",
    subtitle: "Validator consensus evaluates revisions and current Wikipedia page",
    description:
      "Trigger an audit against a newer revision or the current Wikipedia page. Independent validators fetch the target HTML, parse passages, run language models, and agree on element status: UNCHANGED, REPHRASED, CHANGED, or ABSENT.",
    icon: <Search className="h-6 w-6 sm:h-7 sm:w-7 text-cyan-400" aria-hidden="true" />,
    highlights: [
      "Cosmetic changes (punctuation, rephrasing) remain intact.",
      "Material changes (factual divergence, deletions) trigger DRIFTED.",
      "Validators reach consensus on element verdicts.",
    ],
  },
  {
    title: "3. Publish Verifiable Claims",
    subtitle: "Anchor external facts directly to citation IDs",
    description:
      "Researchers, journalists, and protocols can register public factual claims on the ClaimsBoard contract that reference a specific citation ID. Claims automatically track the underlying citation's drift status.",
    icon: <Award className="h-6 w-6 sm:h-7 sm:w-7 text-cyan-400" aria-hidden="true" />,
    highlights: [
      "Links human assertions to citation IDs.",
      "Transparent audit trail visible on the block explorer.",
      "Flags ungrounded or drifted factual claims.",
    ],
  },
  {
    title: "4. Dynamic ClaimsBoard Badges",
    subtitle: "Real-time embeddable status",
    description:
      "Once an audit is accepted by validators, claim badges can be refreshed on-chain. If the referenced source has drifted materially, the badge updates from VERIFIED to DRIFTED, alerting downstream readers immediately.",
    icon: <ShieldCheck className="h-6 w-6 sm:h-7 sm:w-7 text-cyan-400" aria-hidden="true" />,
    highlights: [
      "Dynamic on-chain status: VERIFIED, DRIFTED, or DISPUTED.",
      "Embeddable badge snippets for blogs, docs, and papers.",
      "Synchronized with on-chain drift audits.",
    ],
  },
];

const STORAGE_KEY = "citationwatch_tour_dismissed";
// In-memory fallback if localStorage is disabled or throws SecurityError
let tourDismissedSessionFallback = false;

export const WalkthroughModal: React.FC<WalkthroughModalProps> = ({ isOpen, onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
      triggerRef.current = document.activeElement as HTMLElement;
      registerModalOpen();

      // Focus first visible focusable element inside modal
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
        handleDismiss();
        return;
      }

      if (e.key === "ArrowRight") {
        if (currentStep < TOUR_STEPS.length - 1) {
          setCurrentStep((prev) => prev + 1);
        }
        return;
      }

      if (e.key === "ArrowLeft") {
        if (currentStep > 0) {
          setCurrentStep((prev) => prev - 1);
        }
        return;
      }

      // Focus trap
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
  }, [isOpen, currentStep]);

  if (!isOpen) return null;

  const handleDismiss = () => {
    tourDismissedSessionFallback = true;
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // sessionStorage / in-memory fallback handles private mode
    }
    onClose();
  };

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleDismiss();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const step = TOUR_STEPS[currentStep];

  return (
    <ModalPortal>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="walkthrough-title"
        className={`fixed inset-0 ${Z_INDEX.modalOverlay} overflow-y-auto bg-black/80 backdrop-blur-sm p-2 sm:p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-[calc(1rem+env(safe-area-inset-top,0px))] flex flex-col justify-start items-center`}
      >
        <div
          ref={dialogRef}
          className={`relative w-full max-w-lg m-auto rounded-2xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl flex flex-col max-h-[calc(100vh-2rem)] max-h-[calc(100dvh-2rem)] ${Z_INDEX.modalDialog} focus:outline-none`}
        >
          {/* Sticky Header: step indicator & close control */}
          <div className="flex-shrink-0 flex items-center justify-between border-b border-slate-800 px-4 py-3 sm:px-6">
            <div className="flex items-center space-x-2">
              <Sparkles className="h-4 w-4 text-cyan-400" aria-hidden="true" />
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                Interactive Guide &middot; Step {currentStep + 1} of {TOUR_STEPS.length}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleDismiss}
                className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded transition-colors hidden xs:inline-block focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                Skip tour
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                aria-label="Close guided tour"
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500 hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div
            className="flex-shrink-0 h-1.5 w-full overflow-hidden bg-slate-800"
            role="progressbar"
            aria-valuenow={currentStep + 1}
            aria-valuemin={1}
            aria-valuemax={TOUR_STEPS.length}
            aria-label={`Step ${currentStep + 1} of ${TOUR_STEPS.length}`}
          >
            <div
              className="h-full bg-cyan-400 transition-all duration-300"
              style={{ width: `${((currentStep + 1) / TOUR_STEPS.length) * 100}%` }}
            />
          </div>

          {/* Scrollable Body Region */}
          <div
            tabIndex={0}
            role="region"
            aria-label="Step content"
            className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 overscroll-contain space-y-4 focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-500"
          >
            <div className="flex items-center space-x-3.5">
              <div className="flex h-11 w-11 sm:h-12 sm:w-12 flex-shrink-0 items-center justify-center rounded-2xl border border-cyan-500/30 bg-cyan-950/40">
                {step.icon}
              </div>
              <div>
                <h2 id="walkthrough-title" className="text-base sm:text-lg font-bold text-white tracking-tight break-words">
                  {step.title}
                </h2>
                <p className="text-xs text-slate-300 break-words">{step.subtitle}</p>
              </div>
            </div>

            <p className="text-xs sm:text-sm leading-relaxed text-slate-200 break-words">
              {step.description}
            </p>

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
              <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400">
                Key Highlights
              </span>
              <ul className="mt-2 space-y-1.5 text-xs text-slate-300">
                {step.highlights.map((h, i) => (
                  <li key={i} className="flex items-start space-x-2">
                    <span className="text-cyan-400 font-bold flex-shrink-0">&bull;</span>
                    <span className="break-words">{h}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Sticky Footer: Step Dots, Skip tour, and Nav Buttons */}
          <div className="flex-shrink-0 flex items-center justify-between border-t border-slate-800 px-4 py-3 sm:px-6 gap-2">
            {/* Step dots & Mobile Skip */}
            <div className="flex items-center space-x-3">
              <div className="flex space-x-1.5" aria-hidden="true">
                {TOUR_STEPS.map((_, i) => (
                  <span
                    key={i}
                    className={`h-2 rounded-full transition-all ${
                      i === currentStep ? "w-5 sm:w-6 bg-cyan-400" : "w-2 bg-slate-700"
                    }`}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={handleDismiss}
                className="text-xs text-slate-400 hover:text-white transition-colors underline focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                Skip tour
              </button>
            </div>

            <div className="flex items-center space-x-2">
              {currentStep > 0 && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center space-x-1 rounded-xl border border-slate-700 bg-slate-800 px-3.5 text-xs font-semibold text-slate-200 hover:border-slate-500 hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  <span>Back</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleNext}
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center space-x-1.5 rounded-xl bg-cyan-500 px-4 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition-colors focus-visible:ring-2 focus-visible:ring-white"
              >
                <span>{currentStep === TOUR_STEPS.length - 1 ? "Finish Tour" : "Next"}</span>
                {currentStep < TOUR_STEPS.length - 1 && <ChevronRight className="h-4 w-4" aria-hidden="true" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export function isTourDismissed(): boolean {
  if (tourDismissedSessionFallback) return true;
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return tourDismissedSessionFallback;
  }
}
