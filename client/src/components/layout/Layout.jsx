import { Suspense, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import PageLoader from '../ui/PageLoader';

// Shared frame for every page: navbar on top, footer at the bottom
export default function Layout() {
  const { pathname } = useLocation();
  // IPP-1717: the Solve page uses the full screen width
  const wide = /^\/practice\/[^/]+\/[^/]+/.test(pathname);

  // Start each new page at the top
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className={wide ? 'w-full flex-1 px-3 py-3' : 'mx-auto w-full max-w-6xl flex-1 px-4 py-8'}>
        {/* Navbar and footer stay visible while a page's code is loading */}
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
