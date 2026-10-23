// Full-width spinner while a page waits for data (e.g. checking the saved login)
export default function PageLoader({ text = 'Loading...' }) {
  return (
    <div className="flex items-center justify-center gap-3 py-20 text-sm text-slate-500">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
      {text}
    </div>
  );
}
