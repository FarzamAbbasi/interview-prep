import { HiOutlineClock } from 'react-icons/hi';

const formatClock = (seconds) => {
  const s = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * IPP-1725: top of a running round: "JavaScript · Mid · Question 2 of 4", timer, step bar, End round.
 *   secondsLeft = null hides the timer (e.g. while the user rates an answer)
 */
export default function RoundHeader({ round, items, index, secondsLeft, warnAt = 30, onEnd, busy }) {
  const item = items[index];
  const low = secondsLeft !== null && secondsLeft <= warnAt;
  return (
    <div className="sticky top-16 z-30 -mx-4 border-b border-slate-200 bg-slate-50/95 px-4 pb-3 pt-2 backdrop-blur sm:mx-0 sm:rounded-b-xl sm:px-0">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-sm text-slate-500">
          <b className="font-semibold text-slate-900">{round.language?.name}</b> · <span className="capitalize">{round.level}</span> ·
          Question {Math.min(index + 1, items.length)} of {items.length}
          {item?.kind === 'coding' ? ' · Coding' : ''}
          {round.isTrial ? ' · Free round' : ''}
        </p>
        <div className="flex shrink-0 items-center gap-3">
          <button type="button" onClick={onEnd} disabled={busy} className="hidden text-sm font-medium text-slate-500 hover:text-slate-900 sm:inline">
            End round
          </button>
          {secondsLeft !== null && (
            <span
              role="timer"
              aria-live={low ? 'polite' : 'off'}
              aria-label={`Time left ${formatClock(secondsLeft)}`}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-mono text-base font-semibold ${
                low ? 'bg-amber-50 text-amber-700' : 'bg-white text-slate-900'
              }`}
            >
              <HiOutlineClock /> {formatClock(secondsLeft)}
            </span>
          )}
        </div>
      </div>
      <div className="mt-2.5 flex gap-1.5" aria-hidden="true">
        {items.map((it, i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full ${
              i === index ? 'bg-brand-100 ring-2 ring-brand-600' : it.answeredAt ? 'bg-brand-600' : 'bg-slate-200'
            }`}
          />
        ))}
      </div>
      <button type="button" onClick={onEnd} disabled={busy} className="mt-2 text-xs font-medium text-slate-500 hover:text-slate-900 sm:hidden">
        End round
      </button>
    </div>
  );
}
