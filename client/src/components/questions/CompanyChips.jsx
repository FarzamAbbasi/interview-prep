/**
 * IPP-1732: "Asked at Amazon, Arbisoft" under a question (companies where candidates reported it).
 * Renders nothing for a normal question.
 */
export default function CompanyChips({ companies, className = '' }) {
  if (!companies?.length) return null;
  return (
    <p className={`flex flex-wrap items-center gap-1.5 text-xs ${className}`}>
      <span className="text-slate-500">Asked at</span>
      {companies.map((name) => (
        <span key={name} className="rounded-full bg-brand-50 px-2 py-0.5 font-semibold text-brand-700">
          {name}
        </span>
      ))}
    </p>
  );
}
