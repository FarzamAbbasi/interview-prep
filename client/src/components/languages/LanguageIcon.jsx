import { ICONS } from './iconMap';

// Unknown icons show the first letters of the name
export default function LanguageIcon({ icon, name, size = 28, className = '' }) {
  const Icon = ICONS[String(icon || '').toLowerCase()];
  return (
    <span
      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 ${className}`}
      aria-hidden="true"
    >
      {Icon ? <Icon size={size} /> : <span className="text-sm font-bold">{String(name || '?').slice(0, 2).toUpperCase()}</span>}
    </span>
  );
}
