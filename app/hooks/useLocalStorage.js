import { useCallback } from 'react';

export function useLocalStorage() {
  // Add a value to localStorage by key
  const addLocalStorageItem = useCallback((key, value) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(key, value);
    }
  }, []);

  // Get a value from localStorage by key
  const getLocalStorageItem = useCallback((key) => {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem(key);
    }
    return null;
  }, []);

  return { addLocalStorageItem, getLocalStorageItem };
}
