import { useEffect } from 'react';

const SITE = 'AskedIn';

// Sets the browser tab title: usePageTitle('Pricing') -> "Pricing · AskedIn"
export default function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · ${SITE}` : `${SITE} · Interview questions and quizzes`;
  }, [title]);
}
