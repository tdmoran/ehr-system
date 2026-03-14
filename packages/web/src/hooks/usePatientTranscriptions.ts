import { useState, useEffect, useCallback } from 'react';
import { transcriptionsApi, TranscriptionSession } from '../api/transcriptions';

export function usePatientTranscriptions(patientId: string | null) {
  const [sessions, setSessions] = useState<TranscriptionSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    if (!patientId) return;

    setLoading(true);
    setError(null);

    const { data, error: apiError } = await transcriptionsApi.getPatientSessions(patientId);

    if (apiError) {
      setError(apiError);
    } else if (data) {
      const sorted = [...data.sessions].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setSessions(sorted);
    }

    setLoading(false);
  }, [patientId]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  return { sessions, loading, error, refetch: fetchSessions };
}
