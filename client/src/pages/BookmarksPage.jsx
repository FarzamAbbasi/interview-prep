import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { HiOutlineBookmark } from 'react-icons/hi';
import api, { getErrorMessage } from '../api/axios';
import useLanguages from '../hooks/useLanguages';
import QuestionCard from '../components/questions/QuestionCard';
import LanguageIcon from '../components/languages/LanguageIcon';
import Button from '../components/ui/Button';
import PageLoader from '../components/ui/PageLoader';
import usePageTitle from '../hooks/usePageTitle';

/**
 * /bookmarks — saved Q&A grouped by language (paid users; the route guard handles others).
 * Removing a question hides it at once and offers "Undo".
 */
export default function BookmarksPage() {
  usePageTitle('Bookmarks');
  const { languages } = useLanguages(); // icons and topic names
  const [reloadCount, setReloadCount] = useState(0);
  const [result, setResult] = useState({ key: -1, questions: [], error: '' });
  const [removed, setRemoved] = useState(() => new Set()); // ids hidden after "remove"
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get('/bookmarks')
      .then(({ data }) => !cancelled && setResult({ key: reloadCount, questions: data.data.questions, error: '' }))
      .catch((err) => !cancelled && setResult({ key: reloadCount, questions: [], error: getErrorMessage(err) }));
    return () => {
      cancelled = true;
    };
  }, [reloadCount]);

  const langInfo = useMemo(() => new Map(languages.map((l) => [l.slug, l])), [languages]);

  const groups = useMemo(() => {
    const map = new Map();
    result.questions
      .filter((q) => !removed.has(q._id))
      .forEach((q) => {
        const key = q.language?.slug || 'other';
        if (!map.has(key)) map.set(key, { language: q.language, questions: [] });
        map.get(key).questions.push(q);
      });
    return [...map.values()].sort((a, b) => (a.language?.name || '').localeCompare(b.language?.name || ''));
  }, [result.questions, removed]);

  const setHidden = (id, hidden) =>
    setRemoved((prev) => {
      const next = new Set(prev);
      if (hidden) next.add(id);
      else next.delete(id);
      return next;
    });

  // The API toggles: first call removes, second call (undo) saves it again
  const toggle = async (question, hide) => {
    setBusyId(question._id);
    setHidden(question._id, hide);
    try {
      await api.post(`/bookmarks/${question._id}`);
      return true;
    } catch (err) {
      setHidden(question._id, !hide);
      toast.error(getErrorMessage(err));
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (question) => {
    if (!(await toggle(question, true))) return;
    toast(
      (t) => (
        <span className="flex items-center gap-3 text-sm">
          Removed from bookmarks
          <button
            type="button"
            className="font-semibold text-brand-600 hover:underline"
            onClick={() => {
              toast.dismiss(t.id);
              toggle(question, false);
            }}
          >
            Undo
          </button>
        </span>
      ),
      { duration: 5000 }
    );
  };

  if (result.key !== reloadCount) return <PageLoader text="Loading your bookmarks..." />;

  const total = groups.reduce((n, g) => n + g.questions.length, 0);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Bookmarks</h1>
        <p className="mt-1 text-sm text-slate-600">
          {total ? `${total} saved ${total === 1 ? 'question' : 'questions'}` : 'Questions you save will appear here.'}
        </p>
      </div>

      {result.error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-700">{result.error}</p>
          <Button variant="secondary" className="mt-4" onClick={() => setReloadCount((n) => n + 1)}>
            Try again
          </Button>
        </div>
      )}

      {!result.error && !total && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <HiOutlineBookmark className="mx-auto text-brand-600" size={40} />
          <h2 className="mt-3 text-lg font-semibold text-slate-900">No saved questions yet</h2>
          <p className="mt-1 text-sm text-slate-600">Tap the bookmark icon on any question to save it for later.</p>
          <Link to="/languages" className="mt-5 inline-block rounded-md bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
            Browse questions
          </Link>
        </div>
      )}

      <div className="space-y-10">
        {groups.map(({ language, questions }) => {
          const info = langInfo.get(language?.slug);
          const topicName = (slug) => info?.topics?.find((t) => t.slug === slug)?.name || '';
          return (
            <section key={language?.slug || 'other'} aria-labelledby={`group-${language?.slug}`}>
              <div className="mb-3 flex items-center gap-3">
                <LanguageIcon icon={info?.icon} name={language?.name} size={22} className="h-9 w-9" />
                <h2 id={`group-${language?.slug}`} className="text-lg font-bold text-slate-900">
                  {language?.name || 'Other'} <span className="text-sm font-normal text-slate-500">({questions.length})</span>
                </h2>
                {language?.slug && (
                  <Link to={`/languages/${language.slug}`} className="ml-auto text-sm font-semibold text-brand-600 hover:underline">
                    All {language.name} questions
                  </Link>
                )}
              </div>
              <div className="space-y-4">
                {questions.map((q, i) => (
                  <QuestionCard
                    key={q._id}
                    question={q}
                    number={i + 1}
                    topicName={topicName(q.topic)}
                    showBookmark
                    bookmarked
                    bookmarkBusy={busyId === q._id}
                    onBookmark={() => remove(q)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
