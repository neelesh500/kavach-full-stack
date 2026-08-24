import { useEffect, useState } from 'react';

function useHashRoute() {
  const getRoute = () => (window.location.hash || '#/custodian').replace(/^#/, '');
  const [route, setRoute] = useState(getRoute());

  useEffect(() => {
    const onHash = () => setRoute(getRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  return route;
}

export default useHashRoute;
