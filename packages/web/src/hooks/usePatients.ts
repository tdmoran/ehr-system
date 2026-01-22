import { useState, useEffect, useCallback } from 'react';
import { api, Patient } from '../api/client';

export function usePatients(initialSearch = '') {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(initialSearch);

  const fetchPatients = useCallback(async (searchTerm?: string) => {
    setLoading(true);
    setError(null);

    const { data, error: apiError } = await api.getPatients(searchTerm);

    if (apiError) {
      setError(apiError);
    } else if (data) {
      setPatients(data.patients);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchPatients(search);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [search, fetchPatients]);

  return {
    patients,
    loading,
    error,
    search,
    setSearch,
    refetch: () => fetchPatients(search),
  };
}

export function usePatient(id: string) {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    api.getPatient(id).then(({ data, error: apiError }) => {
      if (apiError) {
        setError(apiError);
      } else if (data) {
        setPatient(data.patient);
      }
      setLoading(false);
    });
  }, [id]);

  return { patient, loading, error };
}
