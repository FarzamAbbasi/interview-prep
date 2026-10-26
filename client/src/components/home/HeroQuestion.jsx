import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const TIME = 30; // seconds, same as a real quiz question

// A real PHP interview MCQ, answered right on the home page (IPP-1402)
const QUESTION = {
  language: 'PHP',
  topic: 'Operators & Types',
  difficulty: 'Medium',
  text: 'What does this print?',
  code: 'var_dump("10" == "1e1");',
  options: ['bool(true)', 'bool(false)', 'Error', 'NULL'],
  correct: 0,
  why: 'Both strings look like numbers, so == compares them as numbers: "10" is 10 and "1e1" is 1 × 10¹ = 10. Use === to compare the strings exactly as they are.',
};
const LETTERS = ['A', 'B', 'C', 'D'];

function TimerRing({ left }) {
  const r = 9;
  const length = 2 * Math.PI * r;
  return (
    <span className="ml-auto flex items-center gap-1.5 font-mono text-sm tabular-nums text-slate-500" aria-label={`${left} seconds left`}>
      <svg width="22" height="22" viewBox="0 0 22 22" className="-rotate-90" aria-hidden="true">
        <circle cx="11" cy="11" r={r} fill="none" stroke="var(--color-slate-200)" strokeWidth="3" />
        <circle
          cx="11"
          cy="11"
          r={r}
          fill="none"
          stroke={left <= 5 ? 'var(--color-red-600)' : 'var(--color-brand-600)'}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={length}
          strokeDashoffset={length * (1 - left / TIME)}
          className="transition-[stroke-dashoffset] duration-1000 ease-linear"
        />
      </svg>
      0:{String(left).padStart(2, '0')}
    </span>
  );
}

export default function HeroQuestion({ nextLink, nextText }) {
  const [picked, setPicked] = useState(null); // index of the chosen option
  const [left, setLeft] = useState(TIME);
  const timedOut = picked === null && left === 0;
  const done = picked !== null || timedOut;

  useEffect(() => {
    if (done) return undefined;
    const timer = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [left, done]);

  const optionClass = (i) => {
    const base =
      'flex w-full items-center gap-3 rounded-lg border px-3.5 py-3 text-left font-mono text-[15px] transition-colors disabled:cursor-default';
    if (!done) return `${base} border-slate-200 bg-white text-slate-900 hover:border-brand-600 hover:bg-brand-50`;
    if (i === QUESTION.correct) return `${base} border-mark bg-mark text-mark-ink`;
    if (i === picked) return `${base} border-red-500 bg-white text-red-600 line-through`;
    return `${base} border-slate-200 bg-white text-slate-500`;
  };

  return (
    <section
      aria-label="Try a question"
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_24px_48px_-28px_rgb(23_32_51/0.35)] sm:p-6"
    >
      <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
        <span className="rounded-full bg-brand-50 px-2.5 py-1 text-brand-700">{QUESTION.language}</span>
        <span className="hidden rounded-full border border-slate-200 px-2.5 py-1 text-slate-600 sm:inline">{QUESTION.topic}</span>
        <span className="rounded-full border border-slate-200 px-2.5 py-1 text-slate-600">{QUESTION.difficulty}</span>
        {done ? (
          <span className="ml-auto text-sm font-semibold text-slate-500">
            {timedOut ? "Time's up" : picked === QUESTION.correct ? 'Correct' : 'Not quite'}
          </span>
        ) : (
          <TimerRing left={left} />
        )}
      </div>

      <h2 className="mt-4 text-xl font-bold tracking-tight text-slate-900">{QUESTION.text}</h2>
      <pre className="code-block mt-3 text-[15px]">
        <code>{QUESTION.code}</code>
      </pre>

      <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
        {QUESTION.options.map((option, i) => (
          <button key={option} type="button" disabled={done} onClick={() => setPicked(i)} className={optionClass(i)}>
            <kbd
              className={`rounded border px-1.5 font-sans text-xs font-semibold ${
                done && i === QUESTION.correct ? 'border-mark-ink/30 text-mark-ink' : 'border-slate-200 text-slate-500'
              }`}
            >
              {LETTERS[i]}
            </kbd>
            {option}
          </button>
        ))}
      </div>

      <div aria-live="polite">
        {done && (
          <div className="mt-4 border-t border-dashed border-slate-200 pt-4 text-[15px] leading-relaxed text-slate-600">
            <p>
              <strong className="text-slate-900">{QUESTION.options[QUESTION.correct]}.</strong> {QUESTION.why}
            </p>
            <Link to={nextLink} className="mt-2 inline-block font-semibold text-brand-600 hover:underline">
              {nextText}
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
