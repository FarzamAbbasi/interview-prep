// TEMPORARY page used until each real page is built in its own ticket
export default function PlaceholderPage({ title, ticket }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
      <p className="mt-2 text-slate-500">This page is coming soon{ticket ? ` (${ticket})` : ''}.</p>
    </div>
  );
}
