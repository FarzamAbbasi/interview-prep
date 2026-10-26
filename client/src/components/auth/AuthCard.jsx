// Centered white card used by all auth pages
export default function AuthCard({ title, subtitle, children, footer }) {
  return (
    <div className="mx-auto flex min-h-[calc(100svh-8rem-1px)] w-full max-w-md flex-col justify-center py-2">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
      {footer && (
        <div className="mt-4 text-center text-sm text-slate-600">{footer}</div>
      )}
    </div>
  );
}
