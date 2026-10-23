import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { HiOutlineMail } from 'react-icons/hi';
import useAuth from '../../hooks/useAuth';
import api, { getErrorMessage } from '../../api/axios';
import { validateRegister, fieldErrorsFromServer } from '../../utils/validation';
import AuthCard from '../../components/auth/AuthCard';
import ResendVerification from '../../components/auth/ResendVerification';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import usePageTitle from '../../hooks/usePageTitle';

const emptyForm = { name: '', email: '', password: '', confirmPassword: '' };

export default function RegisterPage() {
  usePageTitle('Create account');
  const { user } = useAuth();
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null); // { email, emailSent } after success

  if (user) return <Navigate to="/dashboard" replace />;

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: undefined });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const found = validateRegister(form);
    setErrors(found);
    if (Object.keys(found).length) return;

    setSubmitting(true);
    try {
      const { data } = await api.post('/auth/register', {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      setDone({ email: data.data.user.email, emailSent: data.data.emailSent });
    } catch (err) {
      setErrors(fieldErrorsFromServer(err));
      setFormError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  // ---- After registering: "check your email" screen ----
  if (done) {
    return (
      <AuthCard title="Check your email">
        <div className="flex flex-col items-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <HiOutlineMail size={28} />
          </span>
          {done.emailSent ? (
            <p className="mt-4 text-sm text-slate-600">
              We sent a verification link to <strong className="text-slate-900">{done.email}</strong>. Open it to
              activate your account. The link expires in 24 hours.
            </p>
          ) : (
            <p className="mt-4 text-sm text-red-600">
              Your account was created, but we could not send the email. Please use the button below.
            </p>
          )}
          <p className="mt-2 text-xs text-slate-500">Can&apos;t find it? Check your spam folder.</p>
        </div>
        <div className="mt-6 space-y-3">
          <ResendVerification email={done.email} startWithCooldown={done.emailSent} />
          <Link to="/login" className="block text-center text-sm font-semibold text-brand-600 hover:underline">
            Go to login
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Create your account"
      subtitle="Start with free questions and a sample quiz."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-brand-600 hover:underline">
            Log in
          </Link>
        </>
      }
    >
      {formError && (
        <div role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {formError}
          {formError.includes('already registered') && (
            <>
              {' '}
              <Link to="/login" className="font-semibold underline">
                Log in
              </Link>
            </>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Input label="Full name" name="name" autoComplete="name" value={form.name} onChange={handleChange} error={errors.name} />
        <Input
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={handleChange}
          error={errors.email}
        />
        <Input
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 6 characters"
          value={form.password}
          onChange={handleChange}
          error={errors.password}
        />
        <Input
          label="Confirm password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          value={form.confirmPassword}
          onChange={handleChange}
          error={errors.confirmPassword}
        />
        <Button type="submit" className="w-full" loading={submitting}>
          Create account
        </Button>
      </form>
    </AuthCard>
  );
}
