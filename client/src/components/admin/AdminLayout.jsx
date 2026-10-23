import { NavLink, Outlet } from 'react-router-dom';
import {
  HiOutlineViewGrid,
  HiOutlineTranslate,
  HiOutlineQuestionMarkCircle,
  HiOutlineUsers,
  HiOutlineDatabase,
  HiOutlineCloudUpload,
} from 'react-icons/hi';

const links = [
  { to: '/admin', label: 'Dashboard', icon: HiOutlineViewGrid, end: true },
  { to: '/admin/languages', label: 'Languages', icon: HiOutlineTranslate },
  { to: '/admin/questions', label: 'Questions', icon: HiOutlineQuestionMarkCircle },
  { to: '/admin/upload', label: 'Bulk upload', icon: HiOutlineCloudUpload },
  { to: '/admin/users', label: 'Users', icon: HiOutlineUsers },
  { to: '/admin/backup', label: 'Backup', icon: HiOutlineDatabase },
];

const linkClass = ({ isActive }) =>
  `flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
    isActive ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
  }`;

// Admin pages: sidebar on desktop, scrollable tabs on mobile
export default function AdminLayout() {
  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <aside className="lg:w-52 lg:shrink-0">
        <p className="mb-2 hidden px-3 text-xs font-semibold uppercase tracking-wide text-slate-400 lg:block">Admin</p>
        <nav aria-label="Admin" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
          <div className="flex gap-1 lg:flex-col">
            {links.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={linkClass}>
                <Icon size={18} /> {label}
              </NavLink>
            ))}
          </div>
        </nav>
      </aside>
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
