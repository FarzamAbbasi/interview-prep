import { useEffect } from 'react';

const SITE = 'Interview Prep';

// Sets the browser tab title: usePageTitle('Pricing') -> "Pricing · Interview Prep"
export default function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · ${SITE}` : `${SITE} Portal`;
  }, [title]);
}
