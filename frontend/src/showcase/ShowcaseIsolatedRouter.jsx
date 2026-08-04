import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  UNSAFE_LocationContext as LocationContext,
  UNSAFE_NavigationContext as NavigationContext,
  UNSAFE_createMemoryHistory as createMemoryHistory,
} from "react-router";

/**
 * In-app memory navigation for the product showcase.
 * Overrides router contexts for descendants without mounting a nested <Router>
 * (React Router forbids <Router> inside <Router>).
 */
export function ShowcaseIsolatedRouter({
  children,
  initialEntries = ["/dashboard"],
  initialIndex,
  basename = "/",
}) {
  const historyRef = useRef(null);
  if (historyRef.current == null) {
    historyRef.current = createMemoryHistory({
      initialEntries,
      initialIndex,
      v5Compat: true,
    });
  }
  const history = historyRef.current;

  const [state, setStateImpl] = useState({
    action: history.action,
    location: history.location,
  });

  const setState = useCallback((next) => {
    React.startTransition(() => setStateImpl(next));
  }, []);

  useLayoutEffect(() => history.listen(setState), [history, setState]);

  const navigationContext = useMemo(
    () => ({
      basename,
      navigator: history,
      static: false,
      useTransitions: true,
      future: {},
    }),
    [basename, history]
  );

  const locationContext = useMemo(
    () => ({
      location: state.location,
      navigationType: state.action,
    }),
    [state.action, state.location]
  );

  return (
    <NavigationContext.Provider value={navigationContext}>
      <LocationContext.Provider value={locationContext}>{children}</LocationContext.Provider>
    </NavigationContext.Provider>
  );
}
