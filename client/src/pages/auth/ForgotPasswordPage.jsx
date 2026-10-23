import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { HiOutlineMail } from 'react-icons/hi';
import api, { getErrorMessage } from '../../api/axios';
import { isValidEmail } from '../../utils/validation';
import AuthCard from '../../components/auth/AuthCard';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import usePageTitle from '../../hooks/usePageTitle';

const COOLDOWN_SECONDS = 60; // same as the server

export default function ForgotPasswordPage() {
  usePageTitle('Forgot password');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState(''); // email shown on the "check your inbox" screen
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (secondsLeft <= 0) return undefined;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const sendLink = async (e) => {
    e?.preventDefault();
    setFormError('');
    const target = (sentTo || email).trim();
    if (!isValidEmail(target)) {
      setError('Please enter a valid email');
      return;
    }

    setSending(true);
    try {
      await api.post('/auth/forgot-password', { email: target });
      setSentTo(target);
      setSecondsLeft(COOLDOWN_SECONDS);
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  if (sentTo) {
    return (
      <AuthCard title="Check your email">
        <div className="flex flex-col items-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <HiOutlineMail size={28} />
          </span>
          <p className="mt-4 text-sm text-slate-600">
            If <strong className="text-slate-900">{sentTo}</strong> is registered, we sent a link to reset your
            password. The link expires in 1 hour.
          </p>
          <p className="mt-2 text-xs text-slate-500">Can&apos;t find it? Check your spam folder.</p>
        </div>
        {formError && <p className="mt-4 text-center text-sm text-red-600">{formError}</p>}
        <div className="mt-6 space-y-3">
          <Button variant="secondary" className="w-full" loading={sending} disabled={secondsLeft > 0} onClick={sendLink}>
            {secondsLeft > 0 ? `Send again in ${secondsLeft}s` : 'Send again'}
          </Button>
          <button
            type="button"
            onClick={() => setSentTo('')}
            className="block w-full text-center text-sm text-slate-500 hover:text-slate-800"
          >
            Use a different email
          </button>
          <Link to="/login" className="block text-center text-sm font-semibold text-brand-600 hover:underline">
            Back to login
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Forgot password?"
      subtitle="Enter your email and we will send you a link to choose a new password."
      footer={
        <Link to="/login" className="font-semibold text-brand-600 hover:underline">
          Back to login
        </Link>
      }
    >
      {formError && (
        <div role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {formError}
        </div>
      )}
      <form onSubmit={sendLink} className="space-y-4" noValidate>
        <Input
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError('');
          }}
          error={error}
        />
        <Button type="submit" className="w-full" loading={sending}>
          Send reset link
        </Button>
      </form>
    </AuthCard>
  );
}
