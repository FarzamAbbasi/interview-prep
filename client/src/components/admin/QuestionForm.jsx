import { useState } from 'react';
import Button from '../ui/Button';

const LETTERS = ['A', 'B', 'C', 'D'];
const fieldClass = (error) =>
  `w-full rounded-md border bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 ${
    error ? 'border-red-400 focus:ring-red-100' : 'border-slate-300 focus:border-brand-600 focus:ring-brand-100'
  }`;

function Field({ label, error, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

// Same rules as the server (questionAdminRoutes + checkQuestionShape)
function validate(form, topics) {
  const errors = {};
  if (!form.language) errors.language = 'Choose a language';
  if (topics.length && !form.topic) errors.topic = 'Choose a topic';
  if (!form.question.trim()) errors.question = 'Question text is required';
  else if (form.question.length > 2000) errors.question = 'Up to 2000 characters';
  if (!form.answer.trim()) errors.answer = form.type === 'mcq' ? 'Explanation is required' : 'Answer is required';
  else if (form.answer.length > 10000) errors.answer = 'Up to 10000 characters';
  if (form.codeSnippet.length > 5000) errors.codeSnippet = 'Up to 5000 characters';
  if (form.type === 'mcq') {
    const options = form.options.map((o) => o.trim());
    if (options.some((o) => !o)) errors.options = 'Fill in all 4 options';
    else if (new Set(options).size !== 4) errors.options = 'Options must all be different';
    if (form.correctOption === null) errors.correctOption = 'Choose the correct option';
  }
  const tags = splitTags(form.tags);
  if (tags.length > 10) errors.tags = 'Up to 10 tags';
  else if (tags.some((t) => t.length > 30)) errors.tags = 'Each tag can be up to 30 characters';
  const companies = splitCompanies(form.companies);
  if (companies.length > 10) errors.companies = 'Up to 10 companies';
  else if (companies.some((c) => c.length > 60)) errors.companies = 'Each company can be up to 60 characters';
  return errors;
}

const splitTags = (text) => [...new Set(text.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean))];
// IPP-1732: company names keep their case ("10Pearls", "NetSol")
const splitCompanies = (text) => [...new Set(text.split(',').map((c) => c.trim()).filter(Boolean))];

/**
 * Add / edit a Q&A or MCQ.
 * languages: all languages (with topics). onSubmit(body) returns a promise and throws the server message.
 */
export default function QuestionForm({ initial, languages, defaultLanguageId, onSubmit, onCancel }) {
  const isEdit = Boolean(initial?._id);
  const [form, setForm] = useState(() => ({
    language: initial?.language?._id || initial?.language || defaultLanguageId || languages[0]?._id || '',
    topic: initial?.topic || '',
    type: initial?.type || 'qa',
    question: initial?.question || '',
    answer: initial?.answer || '',
    codeSnippet: initial?.codeSnippet || '',
    options: initial?.options?.length === 4 ? [...initial.options] : ['', '', '', ''],
    correctOption: Number.isInteger(initial?.correctOption) ? initial.correctOption : null,
    difficulty: initial?.difficulty || 'easy',
    tags: (initial?.tags || []).join(', '),
    companies: (initial?.companies || []).join(', '),
    isFree: initial?.isFree ?? false,
    isActive: initial?.isActive ?? true,
  }));
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [saving, setSaving] = useState(false);

  const language = languages.find((l) => l._id === form.language);
  const topics = language?.topics || [];
  // Changing a field clears its error
  const set = (changes) => {
    setForm((f) => ({ ...f, ...changes }));
    setErrors((e) => {
      const next = { ...e };
      Object.keys(changes).forEach((k) => delete next[k]);
      if ('type' in changes) Object.keys(next).forEach((k) => delete next[k]);
      return next;
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    setServerError('');
    const found = validate(form, topics);
    setErrors(found);
    if (Object.keys(found).length) return;

    const body = {
      language: form.language,
      topic: form.topic,
      question: form.question.trim(),
      answer: form.answer.trim(),
      codeSnippet: form.codeSnippet,
      difficulty: form.difficulty,
      tags: splitTags(form.tags),
      companies: form.type === 'qa' ? splitCompanies(form.companies) : [],
      isFree: form.isFree,
      isActive: form.isActive,
    };
    if (!isEdit) body.type = form.type;
    if (form.type === 'mcq') {
      body.options = form.options.map((o) => o.trim());
      body.correctOption = form.correctOption;
    }

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

      {/* Type */}
      <fieldset>
        <legend className="mb-1 text-sm font-medium text-slate-700">Type</legend>
        <div className="flex gap-2">
          {[
            ['qa', 'Q&A (question + answer)'],
            ['mcq', 'MCQ (quiz question)'],
          ].map(([value, label]) => (
            <label
              key={value}
              className={`flex flex-1 cursor-pointer items-center gap-2 rounded-md border px-3 py-2.5 text-sm ${
                form.type === value ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-300 text-slate-700'
              } ${isEdit ? 'cursor-not-allowed opacity-70' : ''}`}
            >
              <input
                type="radio"
                name="type"
                value={value}
                checked={form.type === value}
                disabled={isEdit}
                onChange={() => set({ type: value })}
                className="accent-brand-600"
              />
              {label}
            </label>
          ))}
        </div>
        {isEdit && <p className="mt-1 text-xs text-slate-500">The type cannot be changed. Create a new question instead.</p>}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Language" error={errors.language}>
          <select value={form.language} onChange={(e) => set({ language: e.target.value, topic: '' })} className={fieldClass(errors.language)}>
            {languages.map((l) => (
              <option key={l._id} value={l._id}>
                {l.name}
                {l.isActive ? '' : ' (inactive)'}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Topic" error={errors.topic}>
          <select value={form.topic} onChange={(e) => set({ topic: e.target.value })} className={fieldClass(errors.topic)} disabled={!topics.length}>
            <option value="">{topics.length ? 'Choose a topic' : 'No topics'}</option>
            {topics.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Difficulty">
          <select value={form.difficulty} onChange={(e) => set({ difficulty: e.target.value })} className={fieldClass()}>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </Field>
      </div>

      <Field label="Question" error={errors.question}>
        <textarea rows={3} value={form.question} onChange={(e) => set({ question: e.target.value })} className={fieldClass(errors.question)} />
      </Field>

      <Field label="Code snippet (optional)" error={errors.codeSnippet} hint="Shown as code under the question. Keep spaces and new lines as you want them.">
        <textarea
          rows={4}
          value={form.codeSnippet}
          onChange={(e) => set({ codeSnippet: e.target.value })}
          spellCheck={false}
          className={`${fieldClass(errors.codeSnippet)} font-mono text-xs`}
        />
      </Field>

      {form.type === 'mcq' && (
        <fieldset>
          <legend className="mb-1 text-sm font-medium text-slate-700">Options (choose the correct one)</legend>
          <div className="space-y-2">
            {form.options.map((option, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="correctOption"
                  checked={form.correctOption === i}
                  onChange={() => set({ correctOption: i })}
                  aria-label={`Option ${LETTERS[i]} is correct`}
                  className="h-4 w-4 shrink-0 accent-green-600"
                />
                <span className="w-5 shrink-0 text-sm font-bold text-slate-500">{LETTERS[i]}</span>
                <input
                  value={option}
                  onChange={(e) => set({ options: form.options.map((o, j) => (j === i ? e.target.value : o)) })}
                  maxLength={500}
                  aria-label={`Option ${LETTERS[i]}`}
                  className={`${fieldClass(errors.options)} font-mono ${form.correctOption === i ? 'border-green-400 bg-green-50' : ''}`}
                />
              </div>
            ))}
          </div>
          {errors.options && <p className="mt-1 text-xs text-red-600">{errors.options}</p>}
          {errors.correctOption && <p className="mt-1 text-xs text-red-600">{errors.correctOption}</p>}
        </fieldset>
      )}

      <Field
        label={form.type === 'mcq' ? 'Explanation (shown after the quiz)' : 'Answer'}
        error={errors.answer}
      >
        <textarea rows={form.type === 'mcq' ? 3 : 6} value={form.answer} onChange={(e) => set({ answer: e.target.value })} className={fieldClass(errors.answer)} />
      </Field>

      <Field label="Tags (optional)" error={errors.tags} hint="Comma separated, e.g. oop, traits">
        <input value={form.tags} onChange={(e) => set({ tags: e.target.value })} className={fieldClass(errors.tags)} />
      </Field>

      {form.type === 'qa' && (
        <Field
          label="Asked at companies (optional)"
          error={errors.companies}
          hint="Comma separated, e.g. Amazon, Arbisoft. A question with companies is always locked for unpaid users, even in the free topic."
        >
          <input value={form.companies} onChange={(e) => set({ companies: e.target.value })} className={fieldClass(errors.companies)} />
        </Field>
      )}

      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {/* IPP-1607: no Free checkbox; guests and unpaid users get the first topic of every language */}
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={form.isActive} onChange={(e) => set({ isActive: e.target.checked })} className="h-4 w-4 accent-brand-600" />
          Active (shown on the site)
        </label>
      </div>

      <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
        <Button variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {isEdit ? 'Save changes' : 'Add question'}
        </Button>
      </div>
    </form>
  );
}
