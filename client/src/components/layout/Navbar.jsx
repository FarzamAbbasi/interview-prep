import { useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { HiOutlineMenu, HiOutlineX } from 'react-icons/hi';
import Logo from '../Logo';
import ThemeToggle from './ThemeToggle';
import useAuth from '../../hooks/useAuth';

const guestLinks = [
  { to: '/languages', label: 'Languages' },
  { to: '/pricing', label: 'Pricing' },
];

const userLinks = [
  { to: '/languages', label: 'Languages' },
  { to: '/quiz', label: 'Quiz' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/bookmarks', label: 'Bookmarks' },
];

// Active link = dark text with a brand underline, others = grey
const linkClass = ({ isActive }) =>
  `block rounded-md px-3 py-2 text-[15px] font-medium transition-colors md:rounded-none md:border-b-2 md:px-1 md:py-5 ${
    isActive
      ? 'bg-brand-50 text-slate-900 md:border-brand-600 md:bg-transparent'
      : 'text-slate-600 hover:text-slate-900 md:border-transparent'
  }`;

export default function Navbar() {
  const { user, loading, isAdmin, logout } = useAuth();
  const { pathname } = useLocation();

  // Mobile menu: remember on which page it was opened.
  // Going to another page closes it automatically.
  const [openOnPath, setOpenOnPath] = useState(null);
  const open = openOnPath === pathname;
  const toggleMenu = () => setOpenOnPath(open ? null : pathname);

  const links = user ? [...userLinks] : guestLinks;
  if (isAdmin) links.push({ to: '/admin', label: 'Admin' });

  // While checking a saved login on page load, show nothing (avoids a flash of "Login")
  const authButtons = loading ? null : user ? (
    <>
      <span className="px-3 py-2 text-sm text-slate-500">Hi, {user.name.split(' ')[0]}</span>
      <button
        type="button"
        onClick={() => logout('You have been logged out')}
        className="rounded-md px-3 py-2 text-left text-[15px] font-medium text-slate-600 hover:text-slate-900"
      >
        Log out
      </button>
    </>
  ) : (
    <>
      <Link to="/login" className="block rounded-md px-3 py-2 text-[15px] font-medium text-slate-600 hover:text-slate-900">
        Log in
      </Link>
      <Link
        to="/register"
        className="block rounded-lg bg-brand-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-brand-700"
      >
        Create free account
      </Link>
    </>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-slate-50/90 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-4">
        <Logo />

        {/* Desktop menu */}
        <div className="hidden items-center gap-6 md:flex">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>
              {l.label}
            </NavLink>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <div className="hidden items-center gap-2 md:flex">{authButtons}</div>

          {/* Mobile hamburger button */}
          <button
            type="button"
            onClick={toggleMenu}
            className="rounded-md p-2 text-slate-700 hover:bg-slate-100 md:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
          >
            {open ? <HiOutlineX size={24} /> : <HiOutlineMenu size={24} />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>
                {l.label}
              </NavLink>
            ))}
          </div>
          <div className="mt-3 flex flex-col gap-2 border-t border-slate-200 pt-3">{authButtons}</div>
        </div>
      )}
    </header>
  );
}
