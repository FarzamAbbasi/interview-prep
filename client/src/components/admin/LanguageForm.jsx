import { useState } from 'react';
import { HiChevronUp, HiChevronDown, HiOutlineTrash, HiPlus } from 'react-icons/hi';
import { ICON_KEYS } from '../languages/iconMap';
import LanguageIcon from '../languages/LanguageIcon';
import Input from '../ui/Input';
import Button from '../ui/Button';

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function validate(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = 'Name is required';
  else if (form.name.trim().length > 50) errors.name = 'Name cannot be more than 50 characters';
  if (form.slug && !slugPattern.test(form.slug)) errors.slug = 'Only small letters, numbers and dashes (e.g. c-plus-plus)';
  if (form.description.length > 500) errors.description = 'Description cannot be more than 500 characters';
  const names = form.topics.map((t) => t.name.trim().toLowerCase());
  if (names.some((n) => !n)) errors.topics = 'Every topic needs a name';
  else if (new Set(names).size !== names.length) errors.topics = 'Two topics have the same name';
  return errors;
}

/**
 * Add / edit a language with its topics.
 * Existing topics keep their slug (questions point to it), so renaming is safe.
 * onSubmit(body) must return a promise; server errors are shown at the top.
 */
export default function LanguageForm({ initial, onSubmit, onCancel }) {
  const isEdit = Boolean(initial?._id);
  const [form, setForm] = useState(() => ({
    name: initial?.name || '',
    slug: initial?.slug || '',
    icon: initial?.icon || '',
    description: initial?.description || '',
    isActive: initial?.isActive ?? true,
    topics: (initial?.topics || []).map((t) => ({ name: t.name, slug: t.slug, qaCount: t.qaCount, mcqCount: t.mcqCount })),
  }));
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (changes) => setForm((f) => ({ ...f, ...changes }));
  const setTopic = (i, changes) => set({ topics: form.topics.map((t, j) => (j === i ? { ...t, ...changes } : t)) });
  const moveTopic = (i, dir) => {
    const topics = [...form.topics];
    const j = i + dir;
    if (j < 0 || j >= topics.length) return;
    [topics[i], topics[j]] = [topics[j], topics[i]];
    set({ topics });
  };

  const submit = async (e) => {
    e.preventDefault();
    setServerError('');
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) return;

    const body = {
      name: form.name.trim(),
      icon: form.icon,
      description: form.description.trim(),
      isActive: form.isActive,
      topics: form.topics.map((t) => (t.slug ? { name: t.name.trim(), slug: t.slug } : { name: t.name.trim() })),
    };
    if (form.slug) body.slug = form.slug;

    setSaving(true);
    try {
      await onSubmit(body);
    } catch (message) {
      setServerError(String(message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      {serverError && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {serverError}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Name" name="name" value={form.name} onChange={(e) => set({ name: e.target.value })} error={errors.name} placeholder="e.g. JavaScript" />
        <div>
          <Input
            label="Slug (web address)"
            name="slug"
            value={form.slug}
            onChange={(e) => set({ slug: e.target.value.toLowerCase().trim() })}
            error={errors.slug}
            placeholder="made from the name if empty"
          />
          {isEdit && <p className="mt-1 text-xs text-slate-500">Changing the slug changes the page address /languages/{form.slug || '…'}</p>}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Logo</span>
          <select
            value={form.icon}
            onChange={(e) => set({ icon: e.target.value })}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
          >
            <option value="">No logo (first letters)</option>
            {ICON_KEYS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <LanguageIcon icon={form.icon} name={form.name || '?'} />
        </div>
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Description</span>
        <textarea
          value={form.description}
          onChange={(e) => set({ description: e.target.value })}
          rows={3}
          maxLength={500}
          className={`w-full rounded-md border bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 ${
            errors.description ? 'border-red-400 focus:ring-red-100' : 'border-slate-300 focus:border-brand-600 focus:ring-brand-100'
          }`}
        />
        <span className="mt-1 block text-right text-xs text-slate-400">{form.description.length}/500</span>
      </label>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={form.isActive} onChange={(e) => set({ isActive: e.target.checked })} className="h-4 w-4 accent-brand-600" />
        Active (shown on the site)
      </label>

      {/* Topics */}
      <fieldset>
        <legend className="text-sm font-medium text-slate-700">Topics</legend>
        <p className="mb-2 text-xs text-slate-500">In display order. A topic with questions cannot be removed.</p>
        {errors.topics && <p className="mb-2 text-xs text-red-600">{errors.topics}</p>}
        <ul className="space-y-2">
          {form.topics.map((t, i) => {
            const count = (t.qaCount || 0) + (t.mcqCount || 0);
            return (
              <li key={t.slug || `new-${i}`} className="flex items-center gap-2">
                <div className="flex flex-col">
                  <button type="button" onClick={() => moveTopic(i, -1)} disabled={i === 0} aria-label="Move up" className="text-slate-400 hover:text-slate-700 disabled:opacity-30">
                    <HiChevronUp />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveTopic(i, 1)}
                    disabled={i === form.topics.length - 1}
                    aria-label="Move down"
                    className="text-slate-400 hover:text-slate-700 disabled:opacity-30"
                  >
                    <HiChevronDown />
                  </button>
                </div>
                <input
                  value={t.name}
                  onChange={(e) => setTopic(i, { name: e.target.value })}
                  maxLength={50}
                  aria-label={`Topic ${i + 1} name`}
                  className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
                />
                <span className="hidden w-28 shrink-0 truncate text-xs text-slate-400 sm:block">{t.slug ? `${t.slug} · ${count} q` : 'new'}</span>
                <button
                  type="button"
                  onClick={() => set({ topics: form.topics.filter((_, j) => j !== i) })}
                  disabled={count > 0}
                  title={count > 0 ? 'Move its questions to another topic first' : 'Remove topic'}
                  aria-label="Remove topic"
                  className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <HiOutlineTrash />
                </button>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          onClick={() => set({ topics: [...form.topics, { name: '' }] })}
          className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline"
        >
          <HiPlus /> Add topic
        </button>
      </fieldset>

      <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
        <Button variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {isEdit ? 'Save changes' : 'Add language'}
        </Button>
      </div>
    </form>
  );
}
