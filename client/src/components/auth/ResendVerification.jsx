import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api, { getErrorMessage } from '../../api/axios';
import Button from '../ui/Button';
import Input from '../ui/Input';

const COOLDOWN_SECONDS = 60; // same as the server

/**
 * "Resend verification email" button.
 * With `email`: just a button. Without: shows an email field first.
 */
export default function ResendVerification({ email: knownEmail, startWithCooldown = false }) {
  const [email, setEmail] = useState(knownEmail || '');
  const [sending, setSending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(startWithCooldown ? COOLDOWN_SECONDS : 0);

  // Count down once per second
  useEffect(() => {
    if (secondsLeft <= 0) return undefined;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const handleResend = async (e) => {
    e?.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      toast.error('Please enter a valid email');
      return;
    }
    setSending(true);
    try {
      const { data } = await api.post('/auth/resend-verification', { email });
      toast.success(data.message);
      setSecondsLeft(COOLDOWN_SECONDS);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const label = secondsLeft > 0 ? `Resend in ${secondsLeft}s` : 'Resend verification email';

  if (knownEmail) {
    return (
      <Button variant="secondary" className="w-full" loading={sending} disabled={secondsLeft > 0} onClick={handleResend}>
        {label}
      </Button>
    );
  }

  return (
    <form onSubmit={handleResend} className="space-y-3" noValidate>
      <Input
        label="Your email"
        name="resend-email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Button type="submit" variant="secondary" className="w-full" loading={sending} disabled={secondsLeft > 0}>
        {label}
      </Button>
    </form>
  );
}
