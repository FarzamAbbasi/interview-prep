import { useState } from 'react';
import { Link } from 'react-router-dom';
import { HiOutlineLockClosed, HiOutlineLightBulb } from 'react-icons/hi';
import AnswerText from '../questions/AnswerText';
import ConfirmDialog from '../ui/ConfirmDialog';
import DifficultyTag from './DifficultyTag';

const SOLUTION_AFTER_FAILS = 3; // the solution opens by itself after this many failed submits

// Same rule as the server's slugify, for the link to the Q&A topic ("Basics & Types" -> "basics-types")
const topicSlug = (name) =>
  String(name || '')
    .toLowerCase()
    .replace(/\+/g, '-plus')
    .replace(/#/g, '-sharp')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const Label = ({ children }) => (
  <p className="mb-1.5 mt-5 font-mono text-[11px] font-semibold uppercase tracking-wider text-brand-600">{children}</p>
);

/**
 * IPP-1717: left side of the Solve page: Description / Hints / Solution.
 * Hints open one by one. The solution opens after solving, after 3 failed submits,
 * or when the user insists ("Show anyway"). Without access to the language: 1 hint, no solution.
 */
export default function ProblemPanel({ problem, language, hasAccess, index, tab, onTab, stats, revealed, onReveal }) {
  const [shownHints, setShownHints] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const lockedHints = Math.max(0, (problem.hintsTotal || 0) - problem.hints.length);
  const solutionOpen = hasAccess && (stats.solved || stats.fails >= SOLUTION_AFTER_FAILS || revealed);
  const hintNudge = !stats.solved && stats.fails >= 2 && shownHints === 0;

  const tabs = [
    { key: 'description', label: 'Description' },
    { key: 'hints', label: `Hints (${problem.hintsTotal || problem.hints.length})`, dot: hintNudge },
    { key: 'solution', label: 'Solution', locked: !hasAccess },
  ];

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex shrink-0 gap-5 overflow-x-auto border-b border-slate-200 px-4 text-sm" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => onTab(t.key)}
            className={`flex shrink-0 items-center gap-1 border-b-2 py-2.5 ${
              tab === t.key ? 'border-brand-600 font-semibold text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            {t.label}
            {t.locked && <HiOutlineLockClosed size={13} aria-label="Full access" />}
            {t.dot && <span className="h-2 w-2 rounded-full bg-amber-500" aria-label="A hint may help" />}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {tab === 'description' && (
          <div className="text-[15px] leading-relaxed text-slate-700">
            <h1 className="text-xl font-bold text-slate-900">
              {index}. {problem.title}
            </h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <DifficultyTag difficulty={problem.difficulty} />
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">{problem.topic}</span>
            </div>
            {problem.scenario && (
              <p className="mt-4 rounded-lg border-l-[3px] border-brand-600 bg-brand-50 px-3 py-2 text-sm italic text-slate-700">
                {problem.scenario}
              </p>
            )}
            <p className="mt-4 whitespace-pre-line">{problem.description}</p>

            {problem.examples.map((ex, i) => (
              <div key={i}>
                <Label>Example {i + 1}</Label>
                <pre className="overflow-x-auto rounded-lg bg-slate-100 p-3 font-mono text-[13px] text-slate-900">
                  {`Input:  ${ex.input}\nOutput: ${ex.output}`}
                </pre>
                {ex.explanation && <p className="mt-1.5 text-sm text-slate-500">{ex.explanation}</p>}
              </div>
            ))}

            {problem.constraints.length > 0 && (
              <>
                <Label>Constraints</Label>
                <ul className="list-disc space-y-0.5 pl-5 text-sm">
                  {problem.constraints.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </>
            )}

            {problem.relatedTopic && (
              <p className="mt-6 text-sm text-slate-500">
                Theory for this problem:{' '}
                <Link
                  to={`/languages/${language.slug}?topic=${topicSlug(problem.relatedTopic)}`}
                  className="font-medium text-brand-700 hover:underline"
                >
                  {language.name} › {problem.relatedTopic} Q&amp;A
                </Link>
              </p>
            )}
          </div>
        )}

        {tab === 'hints' && (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">Open one hint at a time. Try again after each one.</p>
            {problem.hints.map((hint, i) => (
              <div key={i} className="rounded-lg border border-slate-200 p-3">
                {i < shownHints ? (
                  <p className="flex gap-2 text-[15px] text-slate-700">
                    <HiOutlineLightBulb className="mt-1 shrink-0 text-amber-500" />
                    <span>
                      <b className="text-slate-900">Hint {i + 1}:</b> {hint}
                    </span>
                  </p>
                ) : (
                  <button
                    type="button"
                    disabled={i > shownHints}
                    onClick={() => setShownHints(i + 1)}
                    className="text-sm font-medium text-brand-700 hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
                  >
                    Show hint {i + 1}
                  </button>
                )}
              </div>
            ))}
            {lockedHints > 0 && (
              <Link to="/pricing" className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500 hover:border-brand-600">
                <HiOutlineLockClosed /> {lockedHints} more hint{lockedHints === 1 ? '' : 's'} with full access
              </Link>
            )}
          </div>
        )}

        {tab === 'solution' &&
          (!hasAccess ? (
            <div className="rounded-xl border border-slate-200 p-6 text-center">
              <HiOutlineLockClosed className="mx-auto text-slate-400" size={28} />
              <p className="mt-3 font-semibold text-slate-900">Solution and explanation need full access</p>
              <p className="mt-1 text-sm text-slate-500">Step-by-step explanation, common mistake and interview tip.</p>
              <Link to="/pricing" className="mt-4 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
                See plans
              </Link>
            </div>
          ) : !solutionOpen ? (
            <div className="rounded-xl border border-slate-200 p-6 text-center">
              <p className="font-semibold text-slate-900">Try it yourself first</p>
              <p className="mt-1 text-sm text-slate-500">
                The solution opens when you solve the problem or after {SOLUTION_AFTER_FAILS} submits
                {stats.fails ? ` (${stats.fails} so far)` : ''}. Hints usually help more.
              </p>
              <button type="button" onClick={() => setConfirmOpen(true)} className="mt-4 text-sm font-medium text-brand-700 hover:underline">
                Show the solution anyway
              </button>
            </div>
          ) : (
            <div>
              <pre className="overflow-x-auto rounded-lg bg-[#1d1934] p-4 font-mono text-[13px] leading-relaxed text-[#ece9fb]">
                {problem.solution.code}
              </pre>
              <AnswerText text={problem.solution.explanation} className="mt-5 text-[15px]" />
              {problem.followUp && (
                <div className="mt-5 rounded-lg border border-slate-200 p-3 text-[15px] text-slate-700">
                  <b className="text-slate-900">Follow-up:</b> {problem.followUp}
                </div>
              )}
            </div>
          ))}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Show the solution?"
        text="Seeing the answer first makes it harder to remember. You can still solve it afterwards."
        confirmText="Show solution"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          onReveal();
        }}
      />
    </section>
  );
}
