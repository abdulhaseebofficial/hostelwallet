import { useCallback, useState } from 'react';

/** useState that survives a reload. Falls back to memory in private mode. */
export default function useLocalStorage(key, initialValue) {
  const [stored, setStored] = useState(() => {
    try {
      const item = localStorage.getItem(key);
      return item !== null ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value) => {
      setStored((current) => {
        const next = value instanceof Function ? value(current) : value;
        try {
          localStorage.setItem(key, JSON.stringify(next));
        } catch {
          /* storage full or blocked - keep the in-memory value */
        }
        return next;
      });
    },
    [key]
  );

  return [stored, setValue];
}
