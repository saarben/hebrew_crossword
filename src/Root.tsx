import React, { useEffect, useState } from 'react';
import App from './App';
import WelcomePage from './WelcomePage';
import FirstStepsGame from './firstSteps/FirstStepsGame';
import { trackEvent } from './analytics';

type Route = 'welcome' | 'first-steps' | 'grade1';

function currentRoute(): Route {
  const hash = window.location.hash;
  // The German edition of the grade-1 games keeps its existing URLs.
  if (window.location.pathname.includes('/german') || hash.includes('/german') || hash.includes('/grade1')) {
    return 'grade1';
  }
  if (hash.includes('/first-steps')) return 'first-steps';
  return 'welcome';
}

const TITLES: Record<Route, string | null> = {
  welcome: 'משחקי למידה',
  'first-steps': 'צעדים ראשונים',
  grade1: null, // App sets its own (Hebrew / German) title
};

/** Top-level hash router: welcome page → first steps area, or the grade-1 games. */
export default function Root() {
  const [route, setRoute] = useState<Route>(currentRoute);

  useEffect(() => {
    const onChange = () => {
      setRoute(currentRoute());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  useEffect(() => {
    const title = TITLES[route];
    if (title) {
      document.title = title;
      document.documentElement.lang = 'he';
      document.documentElement.dir = 'rtl';
    }
    if (route === 'first-steps') trackEvent('select_game', { game_name: 'first_steps' });
  }, [route]);

  if (route === 'first-steps') return <FirstStepsGame />;
  if (route === 'grade1') return <App />;
  return <WelcomePage />;
}
