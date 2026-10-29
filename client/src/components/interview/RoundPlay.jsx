import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api, { getErrorMessage } from '../../api/axios';
import Button from '../ui/Button';
import ConfirmDialog from '../ui/ConfirmDialog';
import RoundHeader from './RoundHeader';
import QaStep from './QaStep';
import { MIN_ANSWER_CHARS } from '../../utils/answerCheck';
import CodingStep from './CodingStep';
import { loadRoundState, saveRoundStep, clearRoundState } from '../../utils/interviewStorage';

/**
 * IPP-1725: a running round, one question at a time.
 * - Every answer is saved on the server right away (PATCH), so a refresh / another device continues.
 * - Each question has its own timer (Q&A 3 min -> answer opens; coding 10 min -> code is submitted).
 * - The whole round also ends at the server's expiresAt.
 * - After the last question the round is finished and onDone(report) is called.
 * Timers use server time (serverTime fixes a wrong computer clock).
 */
export default function RoundPlay({ round, onDone, onReload }) {
  const [offset] = useState(() => new Date(round.serverTime).getTime() - Date.now());
  const [items, setItems] = useState(round.items);
  const [step, setStep] = useState(() => {
    const open = round.items.findIndex((i) => !i.answeredAt);
    const index = open < 0 ? round.items.length : open; // length = all answered
    const saved = loadRoundState(round._id)?.step;
    return saved?.index === index ? saved : { index, startedAt: Date.now() + offset, draft: '' };
  });
  const [now, setNow] = useState(() => Date.now() + offset);
  const [busy, setBusy] = useState(false);
  const [endOpen, setEndOpen] = useState(false);

  const doneRef = useRef(false); // finish was sent
  const submittingRef = useRef(false); // coding answer is being collected / saved
  const codingRef = useRef(null); // CodingStep handle: collect()
  const autoSubmittedRef = useRef(null); // index of the question already auto-submitted at time up (once each)
  const tickRef = useRef(null);

  const item = items[step.index]; // undefined when every question is answered
  const endsAt = new Date(round.expiresAt).getTime();
  const itemLeft = item ? item.seconds - (now - step.startedAt) / 1000 : 0;
  const secondsLeft = Math.min(itemLeft, (endsAt - now) / 1000);

  useEffect(() => {
    saveRoundStep(round._id, step);
  }, [round._id, step]);

  const finish = async (reason) => {
    if (doneRef.current) return;
    doneRef.current = true;
    setBusy(true);
    try {
      const { data: res } = await api.post(`/interview/${round._id}/finish`);
      clearRoundState();
      if (reason === 'timeout') toast("Time's up! Your round was finished", { icon: '⏰' });
      onDone(res.data);
    } catch (err) {
      doneRef.current = false;
      setBusy(false);
      toast.error(getErrorMessage(err));
    }
  };

  // Go to the next question, or finish after the last one
  const next = (index) => {
    setStep({ index: index + 1, startedAt: Date.now() + offset, draft: '' });
    if (index + 1 >= items.length) finish('done');
  };

  // Save one answer. false = not saved (the error is shown, or the round is already over)
  const save = async (index, body) => {
    setBusy(true);
    try {
      const { data: res } = await api.patch(`/interview/${round._id}/items/${index}`, body);
      setItems((list) => list.map((it, i) => (i === index ? { ...it, ...res.data.item } : it)));
      setBusy(false);
      return true;
    } catch (err) {
      setBusy(false);
      const code = err.response?.data?.code;
      if (code === 'ROUND_EXPIRED' || code === 'ROUND_FINISHED') {
        clearRoundState();
        toast(getErrorMessage(err), { icon: '⏰' });
        onReload(); // shows the finished round
        return false;
      }
      toast.error(getErrorMessage(err));
      return false;
    }
  };

  const skip = async () => {
    if (busy || !item) return;
    const index = step.index;
    if (await save(index, { rating: 'skipped' })) next(index);
  };

  // IPP-1730: submit the typed answer. The server asks the AI (a few seconds) and keeps the result for the report.
  // then = 'next' (normal) or 'finish' (End round). Too short (time up / End round) = skipped.
  const submitQa = async (text, then = 'next') => {
    if (submittingRef.current || !item) return;
    submittingRef.current = true;
    const index = step.index;
    let ok;
    if (text.length < MIN_ANSWER_CHARS) ok = await save(index, { rating: 'skipped' });
    else {
      setBusy(true);
      try {
        await api.post(`/interview/${round._id}/items/${index}/answer`, { answer: text });
        setItems((list) => list.map((it, i) => (i === index ? { ...it, userAnswer: text, answeredAt: new Date().toISOString() } : it)));
        ok = true;
      } catch (err) {
        ok = false;
        const code = err.response?.data?.code;
        if (code === 'ROUND_EXPIRED' || code === 'ROUND_FINISHED') {
          clearRoundState();
          toast(getErrorMessage(err), { icon: '⏰' });
          onReload();
        } else if (code === 'ALREADY_ANSWERED') ok = true;
        else toast.error(getErrorMessage(err));
      }
      setBusy(false);
    }
    submittingRef.current = false;
    if (!ok) return;
    if (then === 'finish') finish('ended');
    else next(index);
  };

  // Coding: answer = { code, passed }. then = 'next' (normal) or 'finish' (End round)
  const submitCoding = async (answer, then = 'next') => {
    if (submittingRef.current || !item) return;
    submittingRef.current = true;
    const index = step.index;
    const result = answer || (await codingRef.current?.collect()) || { code: '', passed: 0 };
    const ok = await save(index, result);
    submittingRef.current = false;
    if (!ok) return;
    if (then === 'finish') finish('ended');
    else next(index);
  };

  const endRound = () => {
    setEndOpen(false);
    if (item?.kind === 'coding' && item.problem) submitCoding(null, 'finish');
    else if (item?.kind === 'qa') submitQa((step.draft || '').trim(), 'finish');
    else finish('ended');
  };

  // Every 250 ms: move the clock; when time runs out submit the typed answer / the code, or finish
  useEffect(() => {
    tickRef.current = () => {
      const t = Date.now() + offset;
      setNow(t);
      if (doneRef.current || submittingRef.current || busy) return;
      const roundOver = t >= endsAt;
      const itemOver = item && t - step.startedAt >= item.seconds * 1000;
      if (item && (itemOver || roundOver)) {
        if (autoSubmittedRef.current === step.index) {
          if (roundOver) finish('timeout');
          return;
        }
        autoSubmittedRef.current = step.index; // once per question (then the buttons)
        if (item.kind === 'coding') {
          toast("Time's up! Your code was submitted", { icon: '⏰' });
          submitCoding(item.problem ? null : { code: '', passed: 0 });
        } else {
          const text = (step.draft || '').trim();
          toast(text.length >= MIN_ANSWER_CHARS ? "Time's up! Your answer was submitted" : "Time's up! Moving on", { icon: '⏰' });
          submitQa(text);
        }
      } else if (roundOver) finish('timeout');
    };
  });
  useEffect(() => {
    const id = setInterval(() => tickRef.current?.(), 250);
    return () => clearInterval(id);
  }, []);

  // Warn before closing the tab while the round runs
  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (doneRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  const isLast = step.index === items.length - 1;

  return (
    <div className={item?.kind === 'coding' ? '' : 'mx-auto max-w-3xl'}>
      <RoundHeader
        round={round}
        items={items}
        index={step.index}
        secondsLeft={item ? secondsLeft : null}
        warnAt={item?.kind === 'coding' ? 120 : 30}
        onEnd={() => setEndOpen(true)}
        busy={busy}
      />

      {!item ? (
        <div className="mx-auto mt-10 max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">All questions answered</h1>
          <p className="mt-1 text-sm text-slate-500">
            {busy ? 'Checking your answers and getting your report... (up to a minute)' : 'Finish the round to see your report.'}
          </p>
          <Button className="mt-5" loading={busy} onClick={() => finish('done')}>
            See my report
          </Button>
        </div>
      ) : item.kind === 'qa' ? (
        <QaStep
          key={step.index}
          item={item}
          draft={step.draft}
          onDraft={(draft) => setStep((s) => ({ ...s, draft }))}
          busy={busy}
          onSubmit={(text) => submitQa(text)}
          onSkip={skip}
        />
      ) : item.problem ? (
        <CodingStep
          key={step.index}
          roundId={round._id}
          item={item}
          isLast={isLast}
          busy={busy}
          onSubmit={(answer) => submitCoding(answer)}
          handleRef={codingRef}
        />
      ) : (
        <div className="mx-auto mt-6 max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center">
          <p className="text-sm text-slate-600">This coding problem was removed. It counts as 0 tests.</p>
          <Button className="mt-4" loading={busy} onClick={() => submitCoding({ code: '', passed: 0 })}>
            Continue
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={endOpen}
        title="End the round now?"
        text={
          item?.kind === 'coding'
            ? 'Your current code is submitted and the round ends.'
            : "Your typed answer is submitted. Questions you haven't answered count as skipped (0 points)."
        }
        confirmText="End round"
        cancelText="Keep going"
        loading={busy}
        onCancel={() => setEndOpen(false)}
        onConfirm={endRound}
      />
    </div>
  );
}
