import React, { useEffect, useRef } from "react";
import { AlertTriangle, AlertCircle, Info, CheckCircle2, X } from "lucide-react";
import { ModalPortal } from "./ModalPortal";
import { registerModalOpen, registerModalClose } from "../lib/modalManager";
import { Z_INDEX } from "../lib/zIndex";

export interface InAppNoticeProps {
  isOpen: boolean;
  onClose: () => void;
  type?: "warning" | "error" | "info" | "success";
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}

export const InAppNotice: React.FC<InAppNoticeProps> = ({
  isOpen,
  onClose,
  type = "warning",
  title,
  message,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement as HTMLElement;
      registerModalOpen();

      const timer = setTimeout(() => {
        if (dialogRef.current) {
          const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
          );
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

  const role = type === "error" || type === "warning" ? "alert" : "status";
  const ariaLive = type === "error" || type === "warning" ? "assertive" : "polite";

  const renderIcon = () => {
    switch (type) {
      case "error":
        return <AlertCircle className="h-5 w-5 text-rose-400 flex-shrink-0" aria-hidden="true" />;
      case "info":
        return <Info className="h-5 w-5 text-cyan-400 flex-shrink-0" aria-hidden="true" />;
      case "success":
        return <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" aria-hidden="true" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0" aria-hidden="true" />;
    }
  };

  const getBorderColor = () => {
    switch (type) {
      case "error":
        return "border-rose-500/40 bg-slate-900";
      case "info":
        return "border-cyan-500/40 bg-slate-900";
      case "success":
        return "border-emerald-500/40 bg-slate-900";
      default:
        return "border-amber-500/40 bg-slate-900";
    }
  };

  return (
    <ModalPortal>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="in-app-notice-title"
        className={`fixed inset-0 ${Z_INDEX.modalOverlay} overflow-y-auto bg-black/80 backdrop-blur-sm p-4 flex flex-col justify-center items-center text-left`}
      >
        <div
          ref={dialogRef}
          role={role}
          aria-live={ariaLive}
          className={`relative w-full max-w-md m-auto rounded-2xl border ${getBorderColor()} text-slate-100 shadow-2xl p-5 sm:p-6 focus:outline-none`}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start space-x-3">
              <div className="mt-0.5">{renderIcon()}</div>
              <div>
                <h3 id="in-app-notice-title" className="text-base sm:text-lg font-bold text-white tracking-tight break-words">
                  {title}
                </h3>
                <p className="mt-1.5 text-xs sm:text-sm text-slate-300 leading-relaxed break-words">
                  {message}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Dismiss notice"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400 flex-shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Action Buttons */}
          <div className="mt-5 flex flex-wrap items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
            {secondaryActionLabel && onSecondaryAction && (
              <button
                type="button"
                onClick={() => {
                  onSecondaryAction();
                  onClose();
                }}
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-700 bg-slate-800 px-4 text-xs font-semibold text-slate-200 hover:border-slate-500 hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                {secondaryActionLabel}
              </button>
            )}

            {actionLabel && onAction ? (
              <button
                type="button"
                onClick={() => {
                  onAction();
                  onClose();
                }}
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-cyan-500 px-5 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition-colors focus-visible:ring-2 focus-visible:ring-white"
              >
                {actionLabel}
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-cyan-500 px-5 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition-colors focus-visible:ring-2 focus-visible:ring-white"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};
