import { Link } from 'react-router-dom';

const TAG = {
  knew: ['Knew', 'bg-green-50 text-green-700'],
  partly: ['Partly', 'bg-amber-50 text-amber-700'],
  didnt: ["Didn't know", 'bg-red-50 text-red-700'],
  skipped: ['Skipped', 'bg-slate-100 text-slate-600'],
};

/**
 * IPP-1725: short result of a finished round (score + answers).
 * IPP-1726 replaces it with the full report (score ring, review, solution, study next).
 */
export default function RoundSummary({ report }) {
  return (
    <div className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm text-slate-500">
        {report.language?.name} · <span className="capitalize">{report.level}</span>
        {report.isTrial ? ' · Free round' : ''}
      </p>
      <h1 className="mt-1 text-3xl font-bold text-slate-900">{report.percentage}%</h1>
      <p className="text-sm text-slate-500">
        {report.score} of {report.total} points · {Math.round(report.timeTaken / 60)} min
      </p>

      <ul className="mt-5 divide-y divide-slate-100">
        {report.items.map((it) => {
          const [label, cls] =
            it.kind === 'coding'
              ? [`${it.passed} / ${it.total} tests`, it.points === 1 ? TAG.knew[1] : it.points > 0 ? TAG.partly[1] : TAG.didnt[1]]
              : TAG[it.rating] || TAG.skipped;
          return (
            <li key={it.index} className="flex items-center gap-3 py-3 text-sm">
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>
              <span className="min-w-0 flex-1 text-slate-800">{it.kind === 'coding' ? `Coding: ${it.title}` : it.question}</span>
              <span className="hidden shrink-0 text-xs text-slate-500 sm:inline">{it.topic.name}</span>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link to="/interview" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
          Try another round
        </Link>
        <Link to="/dashboard" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          Dashboard
        </Link>
      </div>
    </div>
  );
}
