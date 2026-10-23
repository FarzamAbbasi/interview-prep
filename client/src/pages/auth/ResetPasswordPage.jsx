import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { HiOutlineCheckCircle } from 'react-icons/hi';
import api, { getErrorMessage } from '../../api/axios';
import useAuth from '../../hooks/useAuth';
import { validateNewPassword, fieldErrorsFromServer } from '../../utils/validation';
import AuthCard from '../../components/auth/AuthCard';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import usePageTitle from '../../hooks/usePageTitle';

// Opened from the email link: /reset-password/<token>
export default function ResetPasswordPage() {
  usePageTitle('Reset password');
  const { token } = useParams();
  const { user, logout } = useAuth();
  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [linkInvalid, setLinkInvalid] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: undefined });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const found = validateNewPassword(form);
    setErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    try {
      await api.post(`/auth/reset-password/${token}`, { password: form.password });
      // Old login tokens stop working after a reset, so end any session in this browser
      if (user) logout();
      setDone(true);
    } catch (err) {
      const fieldErrors = fieldErrorsFromServer(err);
      setErrors(fieldErrors);
      // A broken/expired link is not a password problem: show the "request a new link" box
      if (err.response?.status === 400 && !fieldErrors.password) setLinkInvalid(true);
      setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <AuthCard title="Password changed">
        <div className="flex flex-col items-center text-center">
          <HiOutlineCheckCircle size={56} className="text-green-600" />
          <p className="mt-3 text-sm text-slate-600">Your password has been changed. Please log in with your new password.</p>
          <Link
            to="/login"
            className="mt-6 w-full rounded-md bg-brand-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-brand-700"
          >
            Log in
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Choose a new password" subtitle="Enter a new password for your account.">
      {formError && (
        <div role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {formError}
          {linkInvalid && (
            <>
              {' '}
              <Link to="/forgot-password" className="font-semibold underline">
                Request a new link
              </Link>
            </>
          )}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Input
          label="New password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 6 characters"
          value={form.password}
          onChange={handleChange}
          error={errors.password}
        />
        <Input
          label="Confirm new password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          value={form.confirmPassword}
          onChange={handleChange}
          error={errors.confirmPassword}
        />
        <Button type="submit" className="w-full" loading={saving}>
          Change password
        </Button>
      </form>
    </AuthCard>
  );
}
