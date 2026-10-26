import { Link } from 'react-router-dom';

// AskedIn mark: a speech bubble with a question mark (same drawing as public/favicon.svg)
export function LogoMark({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
      <path d="M7 2h18a5 5 0 0 1 5 5v15a5 5 0 0 1-5 5H11l-6 4v-4.4A5 5 0 0 1 2 22V7a5 5 0 0 1 5-5z" fill="var(--color-brand-600)" />
      <path
        d="M12.2 11.4a3.9 3.9 0 0 1 7.6 1.2c0 2.6-3.8 3.2-3.8 5.6"
        fill="none"
        stroke="var(--color-white)"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <circle cx="16" cy="22.2" r="1.7" fill="var(--color-mark)" />
    </svg>
  );
}

export default function Logo({ onClick }) {
  return (
    <Link to="/" onClick={onClick} className="flex items-center gap-2 rounded-md text-slate-900" aria-label="AskedIn home">
      <LogoMark />
      <span className="text-xl font-extrabold tracking-tight">AskedIn</span>
    </Link>
  );
}
