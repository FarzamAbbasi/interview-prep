import { Link } from 'react-router-dom';
import { HiOutlineLockClosed } from 'react-icons/hi';

// Shown instead of a paid-only feature for users without full access
export default function UpgradePrompt({
  title = 'This feature needs full access',
  text = 'Get full access to unlock all questions and answers, full quizzes and bookmarks.',
}) {
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600">
        <HiOutlineLockClosed size={28} />
      </span>
      <h1 className="mt-4 text-xl font-bold text-slate-900">{title}</h1>
      <p className="mt-2 text-sm text-slate-600">{text}</p>
      <Link
        to="/pricing"
        className="mt-6 inline-block rounded-md bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
      >
        Get full access
      </Link>
    </div>
  );
}
