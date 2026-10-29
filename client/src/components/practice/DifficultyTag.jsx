// IPP-1716: small "Easy / Medium / Hard" pill (same colors as the Q&A list)
const DIFFICULTY_STYLE = {
  easy: 'bg-green-50 text-green-700',
  medium: 'bg-amber-50 text-amber-700',
  hard: 'bg-red-50 text-red-700',
};

export default function DifficultyTag({ difficulty, className = '' }) {
  return (
    <span
      className={`inline-block shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${DIFFICULTY_STYLE[difficulty] || ''} ${className}`}
    >
      {difficulty}
    </span>
  );
}
