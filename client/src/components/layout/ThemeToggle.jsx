import { useSyncExternalStore } from 'react';
import { HiOutlineMoon, HiOutlineSun } from 'react-icons/hi';
import { getTheme, setTheme, subscribeTheme } from '../../utils/theme';

// Light / dark switch in the navbar (IPP-1401)
export default function ThemeToggle({ className = '' }) {
  const theme = useSyncExternalStore(subscribeTheme, getTheme);
  const dark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
      className={`flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-100 ${className}`}
    >
      {dark ? <HiOutlineSun size={18} /> : <HiOutlineMoon size={18} />}
    </button>
  );
}
