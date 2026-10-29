import { useState } from 'react';
import { Link } from 'react-router-dom';
import { HiOutlineLockClosed } from 'react-icons/hi';
import api, { getErrorMessage } from '../../api/axios';
import Button from '../ui/Button';
import { checksLeftText } from '../../utils/answerCheck';

const MIN_CHARS = 10;
const MAX_CHARS = 2000;

const VERDICT = {
  right: { title: '✅ Right', box: 'border-green-300 bg-green-50', text: 'text-green-700' },
  partly: { title: '🤏 Partly right', box: 'border-amber-300 bg-amber-50', text: 'text-amber-700' },
  wrong: { title: '❌ Not quite', box: 'border-red-300 bg-red-50', text: 'text-red-700' },
};

/** Green / amber / red box with the AI's verdict and points */
export function VerdictBox({ result }) {
  const v = VERDICT[result.verdict] || VERDICT.wrong;
  return (
    <div className={`rounded-xl border p-4 ${v.box}`} role="status">
      <b className={v.text}>{v.title}</b>
      {result.points?.length > 0 && (
        <ul className="mt-1.5 space-y-1 text-sm text-slate-800">
          {result.points.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Daily limit used up (free users get the upgrade link) */
export function LimitBox({ usage, onShowAnswer }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
      <p className="flex items-center gap-2 font-semibold">
        <HiOutlineLockClosed /> You&apos;ve used today&apos;s {usage.limit} {usage.plan === 'free' ? 'free ' : ''}
        {usage.kind || 'answer'} checks.
      </p>
      <p className="mt-1 text-sm">They reset at midnight.{usage.plan === 'free' ? ' Full access gives more checks every day.' : ''}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {usage.plan === 'free' && (
          <Link to="/pricing" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
            Get full access
          </Link>
        )}
        {onShowAnswer && (
          <button
            type="button"
            onClick={onShowAnswer}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Show answer
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * IPP-1729: "write it in your own words, then check" for one Q&A question.
 *   usage = { kind, limit, used, remaining, plan } (shared by the page), onUsage(newUsage) after each check
 *   onReveal() = show the model answer (after a check, or "Show answer")
 *   source = "questions" (practice, language pages) or "interview" (separate daily counts)
 */
export default function AnswerChecker({ questionId, usage, onUsage, revealed, onReveal, source = 'questions' }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [limitHit, setLimitHit] = useState(false);

  const tooShort = text.trim().length < MIN_CHARS;
  const noChecks = limitHit || usage.remaining <= 0;

  const check = async () => {
    if (busy || tooShort || noChecks) return;
    setBusy(true);
    setError('');
    try {
      const { data: res } = await api.post('/answer-check', { question: questionId, answer: text.trim(), source });
      setResult(res.data);
      onUsage(res.data.usage);
      onReveal();
    } catch (err) {
      const code = err.response?.data?.code;
      if (code === 'ANSWER_CHECK_LIMIT') {
        setLimitHit(true);
        onUsage({ ...usage, used: usage.limit, remaining: 0 });
      } else setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl bg-slate-50 p-3 text-sm">
          <p className="font-semibold text-slate-900">Your answer</p>
          <p className="mt-1 whitespace-pre-line text-slate-700">{text}</p>
        </div>
        <VerdictBox result={result} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="secondary" onClick={() => setResult(null)} disabled={usage.remaining <= 0}>
            Try again
          </Button>
          <span className="text-xs text-slate-500">{checksLeftText(usage)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label htmlFor={`own-${questionId}`} className="text-sm font-semibold text-slate-900">
        Your answer
      </label>
      <textarea
        id={`own-${questionId}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) check();
        }}
        maxLength={MAX_CHARS}
        rows={4}
        placeholder="Write it in your own words, like you would say it in an interview..."
        className="w-full rounded-lg border-[1.5px] border-slate-300 bg-white p-3 text-[15px] text-slate-900 outline-none focus:border-brand-600"
      />

      {noChecks ? (
        <LimitBox usage={usage} onShowAnswer={revealed ? null : onReveal} />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1">
            <Button onClick={check} loading={busy} disabled={tooShort}>
              ✨ Check my answer
            </Button>
            {!revealed && (
              <button type="button" onClick={onReveal} className="px-3 py-2 text-sm font-semibold text-brand-700 hover:underline">
                Show answer
              </button>
            )}
          </div>
          <span className="text-xs text-slate-500">{checksLeftText(usage)}</span>
        </div>
      )}
      {error && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <p className="text-xs text-slate-500">
        Your answer is sent to our AI provider and compared with the model answer. AI can be wrong sometimes, so read the model answer too.
      </p>
    </div>
  );
}
