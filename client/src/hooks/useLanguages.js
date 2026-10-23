import { useCallback, useEffect, useState } from 'react';
import api, { getErrorMessage } from '../api/axios';

/**
 * Active languages from GET /api/languages.
 *   const { languages, loading, error, reload } = useLanguages();
 */
export default function useLanguages() {
  const [languages, setLanguages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0); // bump to load again

  useEffect(() => {
    let cancelled = false;
    api
      .get('/languages')
      .then(({ data }) => {
        if (!cancelled) {
          setLanguages(data.data.languages);
          setError('');
        }
      })
      .catch((err) => !cancelled && setError(getErrorMessage(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const reload = useCallback(() => {
    setLoading(true);
    setAttempt((n) => n + 1);
  }, []);

  return { languages, loading, error, reload };
}
