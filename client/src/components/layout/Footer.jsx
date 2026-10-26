import { Link } from 'react-router-dom';
import { LogoMark } from '../Logo';

const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL || '';

export default function Footer() {
  return (
    <footer className="border-t border-slate-200">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <LogoMark size={22} />
          <p>&copy; {new Date().getFullYear()} AskedIn</p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
          <Link to="/languages" className="hover:text-slate-900">
            Languages
          </Link>
          <Link to="/pricing" className="hover:text-slate-900">
            Pricing
          </Link>
          {CONTACT_EMAIL && (
            <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-slate-900">
              Contact
            </a>
          )}
        </nav>
      </div>
    </footer>
  );
}
