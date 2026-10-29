import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { HiCheck } from 'react-icons/hi';

const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/**
 * IPP-1717: shown after a Submit where every test passed.
 * Runtime is measured in this browser, so it is only a rough number.
 */
export default function AcceptedDialog({ open, title, tests, seconds, attempts, runtimeMs, next, listUrl, loggedIn, loginState, onSolution, onClose }) {
  const nextRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    nextRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const stats = [
    ['Tests', `${tests} / ${tests}`],
    ['Time taken', formatTime(seconds)],
    ['Attempts', attempts],
    ['Runtime', `~${Math.max(1, Math.round(runtimeMs))} ms`],
  ];
  const nextUrl = next ? (next.isLocked ? '/pricing' : next.url) : listUrl;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="accepted-title"
        className="w-full max-w-lg rounded-2xl bg-white p-7 text-center shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-green-700">
          <HiCheck size={30} />
        </span>
        <h2 id="accepted-title" className="mt-3 text-3xl font-bold text-green-700">
          Accepted
        </h2>
        <p className="mt-1 text-slate-600">{title} · all tests passed</p>
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {stats.map(([label, value]) => (
            <div key={label} className="rounded-xl bg-slate-100 p-3">
              <p className="text-xs text-slate-500">{label}</p>
              <p className="text-lg font-bold text-slate-900">{value}</p>
            </div>
          ))}
        </div>
        {!loggedIn && (
          <p className="mt-4 rounded-lg bg-brand-50 px-3 py-2 text-sm text-slate-700">
            <Link to="/login" state={loginState} onClick={onClose} className="font-semibold text-brand-700 hover:underline">
              Log in
            </Link>{' '}
            to save your progress on every device.
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link
            ref={nextRef}
            to={nextUrl}
            onClick={onClose}
            className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            {next ? (next.isLocked ? 'Next problem (full access)' : 'Next problem →') : 'Back to all problems'}
          </Link>
          <button
            type="button"
            onClick={onSolution}
            className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Compare with the solution
          </button>
        </div>
      </div>
    </div>
  );
}
