import { HiOutlineLockClosed, HiOutlineOfficeBuilding } from 'react-icons/hi';
import DifficultyBar from '../languages/DifficultyBar';

// IPP-1732: URL value of the "Company questions" tab (?topic=company-questions)
export const COMPANY_TAB = 'company-questions';

/**
 * IPP-1732: first card in the topic strip: all company ("Asked at ...") questions of the language.
 * counts = language.companyQuestions { qaCount, difficulty }. Company questions are never free,
 * so without full access the card shows a lock (the tab still opens and shows the locked list).
 */
export default function CompanyTabCard({ counts, selected, hasFullAccess, onSelect }) {
  const { qaCount = 0, difficulty } = counts || {};
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      title="Company interview questions"
      className={`relative flex w-[72%] shrink-0 snap-start flex-col rounded-xl border px-3.5 py-3 text-left transition sm:w-[calc((100%-24px)/3)] lg:w-[calc((100%-36px)/4)] xl:w-[calc((100%-48px)/5)] ${
        selected ? 'border-brand-600 ring-1 ring-inset ring-brand-600' : 'border-brand-100 hover:border-brand-600'
      } bg-brand-50`}
    >
      <span className="flex items-center gap-2">
        <HiOutlineOfficeBuilding className="shrink-0 text-brand-600" size={17} aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-slate-900">Company questions</span>
      </span>
      <span className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
        {!hasFullAccess && <HiOutlineLockClosed />}
        {qaCount} {qaCount === 1 ? 'question' : 'questions'}
        {!hasFullAccess && ' · full access'}
      </span>
      <DifficultyBar difficulty={difficulty} className="mt-2.5" />
    </button>
  );
}
