import { useCallback, useEffect, useState } from 'react';
import profileService from '../api/profileApi';
import { CATEGORIES } from '../utils/constants';

/**
 * The student's full category list (built-ins plus their own).
 * Starts from the bundled defaults so dropdowns render instantly, then
 * replaces them with the authoritative list from the API.
 */
export default function useCategories() {
  const [categories, setCategories] = useState(CATEGORIES.map((c) => c.name));
  const [custom, setCustom] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await profileService.categories();
      setCategories(data.all);
      setCustom(data.custom);
    } catch {
      /* keep the defaults - the dropdown still works */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = useCallback(async (name) => {
    const all = await profileService.addCategory(name);
    setCategories(all);
    setCustom((current) => [...current, name]);
    return all;
  }, []);

  const remove = useCallback(async (name) => {
    const all = await profileService.deleteCategory(name);
    setCategories(all);
    setCustom((current) => current.filter((c) => c !== name));
    return all;
  }, []);

  return { categories, custom, loading, reload: load, add, remove };
}
