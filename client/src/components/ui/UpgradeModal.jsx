import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { HiOutlineLockOpen, HiX } from 'react-icons/hi';

/**
 * "Get full access" popup (IPP-1501), shown when a user without full access reaches the end of the free content.
 *   <UpgradeModal open title text isGuest onClose />
 * Guests are sent to sign up first (full access is given to an account); users go to the pricing page.
 */
export default function UpgradeModal({ open, title, text, isGuest, onClose }) {
  const primaryRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    primaryRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-title"
        className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl sm:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <HiX size={20} />
        </button>
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-mark text-mark-ink" aria-hidden="true">
          <HiOutlineLockOpen size={24} />
        </span>
        <h2 id="upgrade-title" className="mt-4 text-xl font-bold tracking-tight text-slate-900">
          {title}
        </h2>
        {text && <p className="mt-2 text-[15px] leading-relaxed text-slate-600">{text}</p>}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Link
            ref={primaryRef}
            to={isGuest ? '/register' : '/pricing'}
            className="inline-flex h-11 items-center sm:flex-1 justify-center rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
          >
            {isGuest ? 'Create free account' : 'Get full access'}
          </Link>
          {isGuest ? (
            <Link
              to="/pricing"
              className="inline-flex h-11 items-center sm:flex-1 justify-center rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              See pricing
            </Link>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 items-center sm:flex-1 justify-center rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Not now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
