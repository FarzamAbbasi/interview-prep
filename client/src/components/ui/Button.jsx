// Primary button with a loading spinner.
//   <Button type="submit" loading={saving}>Save</Button>
//   <Button variant="secondary" onClick={...}>Cancel</Button>
const variants = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-600/60',
  secondary: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-60',
};

export default function Button({
  children,
  loading = false,
  variant = 'primary',
  className = '',
  disabled,
  type = 'button',
  ref,
  ...props
}) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      {...props}
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
}
