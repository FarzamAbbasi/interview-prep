import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/layout/Layout';
import NotFound from './pages/NotFound';
import HomePage from './pages/HomePage';
import LanguagesPage from './pages/LanguagesPage';
import QuestionsPage from './pages/QuestionsPage';
import PricingPage from './pages/PricingPage';
import { ProtectedRoute, AdminRoute, PaidRoute } from './components/routes/RouteGuards';
import PageLoader from './components/ui/PageLoader';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import VerifyEmailPage from './pages/auth/VerifyEmailPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';

// Pages most visitors never open are loaded only when needed (smaller first download)
const QuizSetupPage = lazy(() => import('./pages/quiz/QuizSetupPage'));
const QuizPlayPage = lazy(() => import('./pages/quiz/QuizPlayPage'));
const QuizResultPage = lazy(() => import('./pages/quiz/QuizResultPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const BookmarksPage = lazy(() => import('./pages/BookmarksPage'));
const AdminLayout = lazy(() => import('./components/admin/AdminLayout'));
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'));
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'));
const AdminLanguagesPage = lazy(() => import('./pages/admin/AdminLanguagesPage'));
const AdminQuestionsPage = lazy(() => import('./pages/admin/AdminQuestionsPage'));
const AdminBackupPage = lazy(() => import('./pages/admin/AdminBackupPage'));
const AdminUploadPage = lazy(() => import('./pages/admin/AdminUploadPage'));

export default function App() {
  return (
    <>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route element={<Layout />}>
            {/* Public */}
            <Route path="/" element={<HomePage />} />
            <Route path="/languages" element={<LanguagesPage />} />
            <Route path="/languages/:slug" element={<QuestionsPage />} />
            <Route path="/pricing" element={<PricingPage />} />

            {/* Auth */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/verify-email/:token" element={<VerifyEmailPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password/:token" element={<ResetPasswordPage />} />

            {/* Logged-in users (guests are sent to /login) */}
            <Route element={<ProtectedRoute />}>
              {/* Quiz: unpaid users get the sample quiz, paid users the full quiz (IPP-801) */}
              <Route path="/quiz" element={<QuizSetupPage />} />
              <Route path="/quiz/play" element={<QuizPlayPage />} />
              <Route path="/quiz/result/:attemptId" element={<QuizResultPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />

              {/* Paid only (others see the upgrade prompt) */}
              <Route element={<PaidRoute />}>
                <Route path="/bookmarks" element={<BookmarksPage />} />
              </Route>
            </Route>

            {/* Admins only */}
            <Route path="/admin" element={<AdminRoute />}>
              <Route element={<AdminLayout />}>
                <Route index element={<AdminDashboardPage />} />
                <Route path="languages" element={<AdminLanguagesPage />} />
                <Route path="questions" element={<AdminQuestionsPage />} />
                <Route path="users" element={<AdminUsersPage />} />
                <Route path="upload" element={<AdminUploadPage />} />
                <Route path="backup" element={<AdminBackupPage />} />
              </Route>
            </Route>

            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>

      <Toaster position="top-center" />
    </>
  );
}
