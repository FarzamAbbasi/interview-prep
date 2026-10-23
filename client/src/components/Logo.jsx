import { Link } from 'react-router-dom';

// Text logo until the real name/logo is decided
export default function Logo({ onClick }) {
  return (
    <Link to="/" onClick={onClick} className="flex items-center gap-2 font-bold text-slate-900">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm text-white">
        IP
      </span>
      <span className="text-lg">Interview Prep</span>
    </Link>
  );
}
