import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-slate-500 sm:flex-row">
        <p>&copy; {new Date().getFullYear()} Interview Prep Portal. All rights reserved.</p>
        <div className="flex gap-4">
          <Link to="/languages" className="hover:text-slate-900">Languages</Link>
          <Link to="/pricing" className="hover:text-slate-900">Pricing</Link>
        </div>
      </div>
    </footer>
  );
}
