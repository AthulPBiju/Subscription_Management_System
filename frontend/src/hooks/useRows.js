import { useState, useEffect, useCallback } from 'react';
import api from '../api';

/**
 * Lightweight data-fetching hook.
 * Keeps rows, loading, and error state in sync with the given API endpoint.
 *
 * @param {string} endpoint  e.g. '/customers'
 * @returns {{ rows, setRows, load, loading, error }}
 */
export function useRows(endpoint) {
  const [rows,    setRows]    = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get(endpoint);
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.response?.data?.detail || `Failed to load ${endpoint}`);
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => { load(); }, [load]);

  return { rows, setRows, load, loading, error };
}

