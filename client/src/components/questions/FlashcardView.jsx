import { useEffect, useRef, useState } from 'react';

const difficultyText = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

/**
 * IPP-1603: "One by one" mode on the language page: one question per screen, like a flashcard.
 * Space shows the answer, ← → move. Logged-in users rate themselves:
 *   "I knew this" = mark as done + next, "Review again" = not done + next.
 */
export default function FlashcardView({ questions, isDone, onSetDone, loggedIn, total }) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const cardRef = useRef(null);
  const firstRender = useRef(true);

  // IPP-1606: after "Show answer" (or moving to another question) bring the card to the top of the screen,
  // so the answer is visible without scrolling by hand. Not on the first load of the page.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const card = cardRef.current;
    if (!card) return;
    const top = card.getBoundingClientRect().top;
    const needed = revealed ? top > 90 || top < 0 : top < 0;
    if (needed) {
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      card.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }
  }, [revealed, index]);
  const q = questions[index];
  const last = index >= questions.length - 1;

  const go = (next) => {
    setIndex(Math.max(0, Math.min(questions.length - 1, next)));
    setRevealed(false);
  };
  const rate = (knew) => {
    onSetDone(q, knew);
    if (!last) go(index + 1);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'A'].includes(e.target.tagName) && e.key === ' ') return;
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.key === ' ') {
        e.preventDefault();
        setRevealed((r) => !r);
      } else if (e.key === 'ArrowRight') {
        setIndex((i) => Math.min(questions.length - 1, i + 1));
        setRevealed(false);
      } else if (e.key === 'ArrowLeft') {
        setIndex((i) => Math.max(0, i - 1));
        setRevealed(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [questions.length]);

  if (!q) return null;
  const navBtn = 'text-sm font-medium text-slate-500 hover:text-slate-900 disabled:opacity-40 disabled:hover:text-slate-500';

  return (
    <section aria-label="One question at a time">
      {/* One segment per question: done = violet, current = dark violet */}
      <div className="mb-5 flex gap-1" aria-hidden="true">
        {questions.map((item, i) => (
          <button
            key={item._id}
            type="button"
            tabIndex={-1}
            onClick={() => go(i)}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i === index ? 'bg-brand-800' : isDone(item) ? 'bg-brand-600' : 'bg-slate-200 hover:bg-slate-300'
            }`}
          />
        ))}
      </div>

      <article ref={cardRef} className="scroll-mt-20 rounded-[22px] border border-slate-200 bg-white p-6 shadow-[0_30px_60px_-35px_rgb(72_47_156/0.45)] sm:p-10">
        <p className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <b className="text-brand-600">
            Question {index + 1} of {questions.length}
          </b>
          <span>{difficultyText[q.difficulty] || q.difficulty}</span>
          {loggedIn && isDone(q) && <span className="font-semibold text-brand-600">✓ Done</span>}
        </p>
        <h3 className="mt-4 text-2xl font-bold leading-tight tracking-tight text-slate-900 sm:text-[30px]">{q.question}</h3>

        <div className="mt-6 border-t-2 border-dashed border-slate-200 pt-6" aria-live="polite">
          {revealed ? (
            <div className="space-y-4">
              <p className="max-w-[75ch] whitespace-pre-line text-base leading-relaxed text-slate-700">{q.answer}</p>
              {q.codeSnippet && (
                <pre className="code-block text-sm">
                  <code>{q.codeSnippet}</code>
                </pre>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setRevealed(true)}
              className="h-12 w-full rounded-xl border-2 border-dashed border-slate-300 text-[15px] font-semibold text-brand-600 hover:border-brand-600 hover:bg-brand-50"
            >
              Show answer
            </button>
          )}
        </div>

        {revealed && (
          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
            {loggedIn ? (
              <>
                <button
                  type="button"
                  onClick={() => rate(false)}
                  className="h-12 rounded-xl sm:flex-1 border border-slate-200 bg-white text-[15px] font-semibold text-slate-800 hover:bg-slate-100"
                >
                  Review again
                </button>
                <button
                  type="button"
                  onClick={() => rate(true)}
                  className="h-12 rounded-xl sm:flex-1 bg-brand-600 text-[15px] font-semibold text-white hover:bg-brand-700"
                >
                  I knew this
                </button>
              </>
            ) : (
              !last && (
                <button
                  type="button"
                  onClick={() => go(index + 1)}
                  className="h-12 rounded-xl sm:flex-1 bg-brand-600 text-[15px] font-semibold text-white hover:bg-brand-700"
                >
                  Next question
                </button>
              )
            )}
          </div>
        )}
        {revealed && last && (
          <p className="mt-4 text-center text-sm text-slate-500">
            That was the last question{total > questions.length ? ' here' : ''}.
          </p>
        )}
      </article>

      <div className="mt-5 flex items-center justify-between gap-3">
        <button type="button" onClick={() => go(index - 1)} disabled={index === 0} className={navBtn}>
          ‹ Previous
        </button>
        <span className="hidden items-center gap-1.5 text-sm text-slate-500 sm:flex">
          <kbd className="rounded border border-slate-200 bg-white px-1.5 font-mono text-xs">Space</kbd> show answer ·
          <kbd className="rounded border border-slate-200 bg-white px-1.5 font-mono text-xs">←</kbd>
          <kbd className="rounded border border-slate-200 bg-white px-1.5 font-mono text-xs">→</kbd> move
        </span>
        <button type="button" onClick={() => go(index + 1)} disabled={last} className={navBtn}>
          Next ›
        </button>
      </div>
    </section>
  );
}
