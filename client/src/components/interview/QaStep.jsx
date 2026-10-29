import Button from '../ui/Button';
import DifficultyTag from '../practice/DifficultyTag';
import { MIN_ANSWER_CHARS } from '../../utils/answerCheck';

/**
 * IPP-1725 / IPP-1730: one Q&A question of a round, like a real interview:
 * the user types the answer and submits it, then the next question comes. No model answer and no verdict here:
 * the AI checks the answer in the background and everything is shown in the report.
 *   draft / onDraft: the typed text (kept by the round, so a refresh does not lose it)
 *   onSubmit(text), onSkip()
 * Ctrl + Enter = submit.
 */
export default function QaStep({ item, draft, onDraft, busy, onSubmit, onSkip }) {
  const text = draft || '';
  const ready = text.trim().length >= MIN_ANSWER_CHARS;

  return (
    <section className="mt-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6" aria-labelledby="qa-question">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">{item.topic.name}</span>
        <DifficultyTag difficulty={item.difficulty} />
      </div>
      <h1 id="qa-question" className="mt-3 text-xl font-semibold text-slate-900">
        {item.question}
      </h1>
      {item.codeSnippet && (
        <pre className="code-block mt-4 text-sm">
          <code>{item.codeSnippet}</code>
        </pre>
      )}

      <textarea
        value={text}
        onChange={(e) => onDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && ready && !busy) onSubmit(text.trim());
        }}
        maxLength={2000}
        rows={6}
        disabled={busy}
        autoFocus
        aria-label="Your answer"
        placeholder="Type your answer like you would say it to the interviewer..."
        className="mt-5 w-full rounded-xl border-[1.5px] border-slate-300 bg-white p-3 text-[15px] text-slate-900 outline-none focus:border-brand-600 disabled:opacity-70"
      />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
          <Button onClick={() => onSubmit(text.trim())} loading={busy} disabled={!ready}>
            {busy ? 'Saving...' : 'Submit answer'}
          </Button>
          <button type="button" onClick={onSkip} disabled={busy} className="px-3 py-2.5 text-sm font-semibold text-brand-700 hover:underline">
            Skip question
          </button>
        </div>
        <span className="text-xs text-slate-500">
          {ready ? 'Ctrl + Enter to submit' : `Write at least a sentence (${MIN_ANSWER_CHARS}+ letters)`}
        </span>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        AI checks your answer in the background. You&apos;ll see the result and the model answer in the report at the end.
      </p>
    </section>
  );
}
