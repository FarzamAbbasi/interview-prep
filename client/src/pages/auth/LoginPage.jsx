import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import useAuth from '../../hooks/useAuth';
import { getErrorMessage } from '../../api/axios';
import { validateLogin, fieldErrorsFromServer } from '../../utils/validation';
import AuthCard from '../../components/auth/AuthCard';
import ResendVerification from '../../components/auth/ResendVerification';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import usePageTitle from '../../hooks/usePageTitle';

export default function LoginPage() {
  usePageTitle('Log in');
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Where to go after login (set by the route guards in IPP-605)
  const from = location.state?.from;
  const goTo = from ? `${from.pathname}${from.search || ''}` : '/dashboard';

  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to={goTo} replace />;

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: undefined });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setUnverifiedEmail('');

    const found = validateLogin(form);
    setErrors(found);
    if (Object.keys(found).length) return;

    setSubmitting(true);
    try {
      const loggedIn = await login(form.email.trim(), form.password);
      toast.success(`Welcome back, ${loggedIn.name.split(' ')[0]}!`);
      navigate(goTo, { replace: true });
    } catch (err) {
      const code = err.response?.data?.code;
      if (code === 'EMAIL_NOT_VERIFIED') setUnverifiedEmail(form.email.trim());
      setErrors(fieldErrorsFromServer(err));
      setFormError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthCard
      title="Log in"
      subtitle="Welcome back! Continue your interview preparation."
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link to="/register" className="font-semibold text-brand-600 hover:underline">
            Register
          </Link>
        </>
      }
    >
      {formError && (
        <div role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {formError}
        </div>
      )}

      {unverifiedEmail && (
        <div className="mb-4">
          <ResendVerification email={unverifiedEmail} />
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Input
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={handleChange}
          error={errors.email}
        />
        <div>
          <Input
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={form.password}
            onChange={handleChange}
            error={errors.password}
          />
          <div className="mt-1 text-right">
            <Link to="/forgot-password" className="text-xs font-medium text-brand-600 hover:underline">
              Forgot password?
            </Link>
          </div>
        </div>
        <Button type="submit" className="w-full" loading={submitting}>
          Log in
        </Button>
      </form>
    </AuthCard>
  );
}
