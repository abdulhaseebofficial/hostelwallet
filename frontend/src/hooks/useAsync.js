import { useCallback, useEffect, useRef, useState } from 'react';
import { getErrorMessage } from '../services/api';

/**
 * Broadcast that something was written, so every screen currently on display
 * refetches. The quick-add button lives in the app shell and can fire while
 * any page is mounted; without this the student adds an expense and the
 * numbers behind the dialog stay stale until they navigate away and back.
 */
export const DATA_CHANGED_EVENT = 'hw:data-changed';
export const notifyDataChanged = () => window.dispatchEvent(new CustomEvent(DATA_CHANGED_EVENT));

/**
 * Runs an async loader and tracks { data, loading, error }.
 * Handles the two things every screen otherwise re-implements: not setting
 * state after unmount, and re-running when a dependency changes.
 *
 *   const { data, loading, error, reload } = useAsync(() => svc.list(page), [page]);
 */
export default function useAsync(loader, deps = [], { immediate = true, refreshOnDataChange = true } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);

  const mounted = useRef(true);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async (...args) => {
    setLoading(true);
    setError(null);
    try {
      const result = await loaderRef.current(...args);
      if (mounted.current) setData(result);
      return result;
    } catch (err) {
      if (mounted.current) setError(getErrorMessage(err));
      return null;
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (immediate) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    if (!refreshOnDataChange) return undefined;
    const onChanged = () => run();
    window.addEventListener(DATA_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(DATA_CHANGED_EVENT, onChanged);
  }, [run, refreshOnDataChange]);

  return { data, loading, error, reload: run, setData };
}
