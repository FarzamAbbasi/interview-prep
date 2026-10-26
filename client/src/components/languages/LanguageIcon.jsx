import { ICONS } from './iconMap';

// Unknown icons show the first letters of the name
// box: size + corner classes (IPP-1602 cards use a bigger box)
export default function LanguageIcon({ icon, name, size = 28, box = 'h-12 w-12 rounded-lg', className = '' }) {
  const Icon = ICONS[String(icon || '').toLowerCase()];
  return (
    <span
      className={`flex shrink-0 items-center justify-center bg-brand-50 text-brand-700 ${box} ${className}`}
      aria-hidden="true"
    >
      {Icon ? <Icon size={size} /> : <span className="text-sm font-bold">{String(name || '?').slice(0, 2).toUpperCase()}</span>}
    </span>
  );
}
