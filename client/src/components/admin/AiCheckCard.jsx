import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { HiOutlineSparkles } from 'react-icons/hi';
import api, { getErrorMessage } from '../../api/axios';
import Button from '../ui/Button';

const GROUPS = [
  { key: 'practice', label: 'Practice (language pages)' },
  { key: 'interview', label: 'Interview Mode' },
];

function Stat({ label, value, note }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      {note && <p className="text-xs text-slate-500">{note}</p>}
    </div>
  );
}

/**
 * IPP-1730: Admin dashboard card for the AI answer check (GET / PATCH /api/admin/answer-check).
 * Connected or not (provider + model from the server .env; the key is never shown), today's and this month's
 * checks, and the daily limits per user (practice and interview, free and paid; 0 = off).
 */
export default function AiCheckCard() {
  const [reload, setReload] = useState(0);
  const [state, setState] = useState({ key: -1 });
  const [form, setForm] = useState(null); // edited limits; null = not changed yet
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get('/admin/answer-check')
      .then(({ data: res }) => !cancelled && setState({ key: reload, data: res.data }))
      .catch((err) => !cancelled && setState({ key: reload, error: getErrorMessage(err) }));
    return () => {
      cancelled = true;
    };
  }, [reload]);

  if (state.key !== reload && !state.data) {
    return <section className="h-40 animate-pulse rounded-xl border border-slate-200 bg-white" aria-label="Loading AI answer check" />;
  }
  if (state.error) {
    return (
      <section className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700" role="alert">
        AI answer check: {state.error}
      </section>
    );
  }

  const { ai, limits, today, month } = state.data;
  const values = form || limits;
  const setValue = (group, plan, value) =>
    setForm({ ...values, [group]: { ...values[group], [plan]: value === '' ? '' : Math.max(0, Math.min(500, Number(value))) } });
  const valid = GROUPS.every((g) => ['free', 'paid'].every((p) => Number.isInteger(values[g.key][p])));

  const save = async () => {
    setSaving(true);
    try {
      const { data: res } = await api.patch('/admin/answer-check', values);
      toast.success(res.message);
      setForm(null);
      setReload((n) => n + 1);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5" aria-labelledby="ai-check-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="ai-check-heading" className="flex items-center gap-2 text-lg font-bold text-slate-900">
          <HiOutlineSparkles className="text-brand-600" /> AI answer check
        </h2>
        {ai.configured ? (
          <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-700">
            Connected · {ai.provider} · {ai.model}
          </span>
        ) : (
          <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
            Off · set AI_PROVIDER and AI_API_KEY in the server .env
          </span>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Stat label="Checks today" value={today.checks} note={`${today.practice} practice · ${today.interview} interview`} />
        <Stat label="Users today" value={today.users} note={`${today.right} right · ${today.partly} partly · ${today.wrong} wrong`} />
        <Stat label="This month" value={month.checks} note="Pakistan time" />
      </div>

      <div className="mt-5">
        <p className="text-sm font-semibold text-slate-900">Daily checks per user</p>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {GROUPS.map((g) => (
            <fieldset key={g.key} className="rounded-lg border border-slate-200 p-3">
              <legend className="px-1 text-xs font-semibold text-slate-600">{g.label}</legend>
              <div className="flex flex-wrap gap-3">
                {['free', 'paid'].map((plan) => (
                  <label key={plan} className="flex items-center gap-2 text-sm text-slate-700">
                    <span className="capitalize">{plan}</span>
                    <input
                      type="number"
                      min="0"
                      max="500"
                      value={values[g.key][plan]}
                      onChange={(e) => setValue(g.key, plan, e.target.value)}
                      className="w-20 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-brand-600"
                    />
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button onClick={save} loading={saving} disabled={!form || !valid}>
            Save limits
          </Button>
          <span className="text-xs text-slate-500">0 switches the check off for that group. Counts reset at midnight (Pakistan time).</span>
        </div>
      </div>
    </section>
  );
}
