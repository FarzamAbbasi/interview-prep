import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api, { getErrorMessage } from '../../api/axios';
import usePageTitle from '../../hooks/usePageTitle';
import PageLoader from '../../components/ui/PageLoader';
import RoundPlay from '../../components/interview/RoundPlay';
import InterviewReport from '../../components/interview/InterviewReport';

/**
 * /interview/:roundId   (IPP-1725, logged in, own round)
 * Running round -> the questions (also after a refresh). Finished round -> the result.
 * The start page passes the new round in the link state, so it opens without a second request.
 */
export default function InterviewRoundPage() {
  const { roundId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState(0);
  const key = `${roundId}|${attempt}`;
  const [result, setResult] = useState(() => {
    const round = location.state?.round;
    return round?._id === roundId ? { key, data: round } : { key: null };
  });

  // The link state is used once: a browser refresh keeps it, but by then it is old (answers, timer)
  const hasLinkState = Boolean(location.state?.round);
  useEffect(() => {
    if (hasLinkState) navigate(`/interview/${roundId}`, { replace: true, state: null });
  }, [hasLinkState, navigate, roundId]);

  const have = result.key === key;
  useEffect(() => {
    if (have) return undefined;
    let cancelled = false;
    api
      .get(`/interview/${roundId}`)
      .then(({ data: res }) => !cancelled && setResult({ key, data: res.data }))
      .catch((err) => !cancelled && setResult({ key, error: getErrorMessage(err), status: err.response?.status }));
    return () => {
      cancelled = true;
    };
  }, [have, key, roundId]);

  const data = have ? result.data : null;

  // IPP-1730: answers still 'pending' may get their AI result from the background queue a bit later:
  // look again every 10 s (6 times at most) while the report is open
  const [polls, setPolls] = useState(0);
  const waiting = data?.status === 'completed' && data.pending > 0 && polls < 6;
  useEffect(() => {
    if (!waiting) return undefined;
    let cancelled = false;
    const timer = setTimeout(() => {
      api
        .get(`/interview/${roundId}`)
        .then(({ data: res }) => !cancelled && setResult({ key, data: res.data }))
        .catch(() => {})
        .finally(() => !cancelled && setPolls((n) => n + 1));
    }, 10000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [waiting, polls, roundId, key]);
  usePageTitle(data?.status === 'completed' ? 'Interview report' : 'Interview in progress');

  if (!have) return <PageLoader text="Loading round..." />;
  if (result.error) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="text-slate-600">{result.status === 404 ? 'This round does not exist.' : result.error}</p>
        {result.status === 404 ? (
          <Link to="/interview" className="mt-4 inline-block rounded-md bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
            Start a round
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="mt-4 rounded-md bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Try again
          </button>
        )}
      </div>
    );
  }

  if (data.status === 'in-progress') {
    return (
      <RoundPlay
        key={data._id}
        round={data}
        onDone={(report) => setResult({ key, data: report })}
        onReload={() => setAttempt((n) => n + 1)}
      />
    );
  }
  // IPP-1730: rate an answer the AI could not check -> the server returns the updated report
  const rateItem = async (index, rating) => {
    try {
      const { data: res } = await api.patch(`/interview/${roundId}/items/${index}/rate`, { rating });
      setResult({ key, data: res.data });
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };
  // IPP-1730: "Check with AI again" for a pending answer -> updated report
  const recheckItem = async (index) => {
    try {
      const { data: res } = await api.post(`/interview/${roundId}/items/${index}/recheck`);
      setResult({ key, data: res.data });
      toast.success(res.message);
    } catch (err) {
      toast.error(`${getErrorMessage(err)}. You can rate it yourself.`);
    }
  };
  return <InterviewReport report={data} onRate={rateItem} onRecheck={recheckItem} checking={waiting} />;
}
