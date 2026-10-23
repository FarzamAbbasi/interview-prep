import { useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { HiOutlineMenu, HiOutlineX } from 'react-icons/hi';
import Logo from '../Logo';
import useAuth from '../../hooks/useAuth';

const guestLinks = [
  { to: '/', label: 'Home', end: true },
  { to: '/languages', label: 'Languages' },
  { to: '/pricing', label: 'Pricing' },
];

const userLinks = [
  { to: '/languages', label: 'Languages' },
  { to: '/quiz', label: 'Quiz' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/bookmarks', label: 'Bookmarks' },
];

// Active link = blue, others = grey
const linkClass = ({ isActive }) =>
  `block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
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
        className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
      >
        Logout
      </button>
    </>
  ) : (
    <>
      <NavLink to="/login" className={linkClass}>
        Login
      </NavLink>
      <Link
        to="/register"
        className="block rounded-md bg-brand-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-brand-700"
      >
        Register
      </Link>
    </>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Logo />

        {/* Desktop menu */}
        <div className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>
              {l.label}
            </NavLink>
          ))}
        </div>
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
      </nav>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-slate-200 bg-white px-4 py-3 md:hidden">
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
