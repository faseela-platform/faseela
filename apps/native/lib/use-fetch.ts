import Constants from "expo-constants";
import { useCallback, useEffect, useState } from "react";

import { apiFetch, PROD_FALLBACK, resolveBaseUrl } from "./api";

/** Resolved once — the impure reads live here, not in the pure functions. */
const baseUrl = resolveBaseUrl({
  envUrl: process.env.EXPO_PUBLIC_API_URL,
  hostUri: Constants.expoConfig?.hostUri,
  isDev: __DEV__,
  fallback: PROD_FALLBACK,
});

type FetchState<T> = { data: T | null; error: string | null; loading: boolean };

const LOADING = { data: null, error: null, loading: true } as const;

/** Fetch a `/api/v1/*` path. `error` is the machine code — the UI localizes it. */
export function useApi<T>(path: string) {
  const [state, setState] = useState<FetchState<T>>(LOADING);
  const [attempt, setAttempt] = useState(0);

  // Adjust-during-render: a path change restarts the request, so show loading
  // immediately without a setState inside the effect body.
  const [lastPath, setLastPath] = useState(path);
  if (lastPath !== path) {
    setLastPath(path);
    setState(LOADING);
  }

  useEffect(() => {
    let cancelled = false;
    apiFetch<T>(baseUrl, path).then((result) => {
      if (cancelled) return;
      if (result.ok) setState({ data: result.data, error: null, loading: false });
      else setState({ data: null, error: result.code, loading: false });
    });
    return () => {
      cancelled = true;
    };
  }, [path, attempt]);

  const retry = useCallback(() => {
    setState(LOADING);
    setAttempt((n) => n + 1);
  }, []);

  return { ...state, retry };
}
