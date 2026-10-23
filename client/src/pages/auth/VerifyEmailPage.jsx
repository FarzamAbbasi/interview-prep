import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { HiOutlineCheckCircle, HiOutlineXCircle } from 'react-icons/hi';
import api, { getErrorMessage } from '../../api/axios';
import AuthCard from '../../components/auth/AuthCard';
import ResendVerification from '../../components/auth/ResendVerification';
import usePageTitle from '../../hooks/usePageTitle';

// Opened from the email link: /verify-email/<token>
export default function VerifyEmailPage() {
  usePageTitle('Verify email');
  const { token } = useParams();
  const [status, setStatus] = useState('verifying'); // verifying | success | error
  const [message, setMessage] = useState('');
  // The link works only once; this stops React (dev mode) from sending it twice
  const sentFor = useRef(null);

  useEffect(() => {
    if (sentFor.current === token) return;
    sentFor.current = token;

    api
      .get(`/auth/verify-email/${token}`)
      .then(({ data }) => {
        setStatus('success');
        setMessage(data.message);
      })
      .catch((err) => {
        setStatus('error');
        setMessage(getErrorMessage(err));
      });
  }, [token]);

  if (status === 'verifying') {
    return (
      <AuthCard title="Verifying your email">
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
          Please wait a moment...
        </div>
      </AuthCard>
    );
  }

  if (status === 'success') {
    return (
      <AuthCard title="Email verified">
        <div className="flex flex-col items-center text-center">
          <HiOutlineCheckCircle size={56} className="text-green-600" />
          <p className="mt-3 text-sm text-slate-600">{message}</p>
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
    <AuthCard title="Verification failed">
      <div className="flex flex-col items-center text-center">
        <HiOutlineXCircle size={56} className="text-red-500" />
        <p className="mt-3 text-sm text-slate-600">{message}</p>
        <p className="mt-1 text-xs text-slate-500">
          Already verified? <Link to="/login" className="font-semibold text-brand-600 hover:underline">Log in</Link>
        </p>
      </div>
      <div className="mt-6 border-t border-slate-200 pt-6">
        <p className="mb-3 text-sm font-medium text-slate-700">Get a new verification link</p>
        <ResendVerification />
      </div>
    </AuthCard>
  );
}
