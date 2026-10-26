// IPP-1602: green / yellow / red bar = share of easy / medium / hard questions
const LEVELS = [
  { key: 'easy', label: 'Easy', color: 'bg-[#2fb07f]' },
  { key: 'medium', label: 'Medium', color: 'bg-[#f0b429]' },
  { key: 'hard', label: 'Hard', color: 'bg-[#e05e66]' },
];

export default function DifficultyBar({ difficulty = {}, className = '' }) {
  const total = LEVELS.reduce((n, l) => n + (difficulty[l.key] || 0), 0);
  const label = total ? LEVELS.map((l) => `${difficulty[l.key] || 0} ${l.label.toLowerCase()}`).join(', ') : 'No questions yet';
  return (
    <div className={`flex h-1.5 overflow-hidden rounded-full bg-slate-200 ${className}`} role="img" aria-label={label} title={label}>
      {LEVELS.map((l) =>
        difficulty[l.key] ? <span key={l.key} className={l.color} style={{ flexGrow: difficulty[l.key] }} /> : null
      )}
    </div>
  );
}

// Thin violet bar: how much of the topic / language the user marked as done
export function ProgressBar({ done = 0, total = 0, className = '' }) {
  const pct = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return (
    <div className={`h-1 overflow-hidden rounded-full bg-slate-200 ${className}`} aria-hidden="true">
      <span className="block h-full rounded-full bg-brand-600 transition-[width] duration-300" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function DifficultyLegend({ withProgress = false, className = '' }) {
  return (
    <ul className={`flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-slate-500 ${className}`} aria-label="Colour key">
      {LEVELS.map((l) => (
        <li key={l.key} className="flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-[3px] ${l.color}`} /> {l.label}
        </li>
      ))}
      {withProgress && (
        <li className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-brand-600" /> Your progress
        </li>
      )}
    </ul>
  );
}
