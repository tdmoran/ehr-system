import { useState, useEffect } from 'react';
import { api, PendingReferral } from '../../api/client';
import { ReferralReviewModal } from './ReferralReviewModal';

interface ReferralReviewListProps {
  refreshTrigger: number;
  onResolved: () => void;
}

export function ReferralReviewList({ refreshTrigger, onResolved }: ReferralReviewListProps) {
  const [referrals, setReferrals] = useState<PendingReferral[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedReferral, setSelectedReferral] = useState<PendingReferral | null>(null);

  const fetchReferrals = async () => {
    const { data, error: apiError } = await api.getPendingReferrals();
    if (apiError) {
      setError(apiError);
    } else if (data) {
      setReferrals(data.referrals);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchReferrals();
  }, [refreshTrigger]);

  // Poll for updates while there are referrals being processed
  useEffect(() => {
    const interval = setInterval(() => {
      fetchReferrals();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleModalClose = () => {
    setSelectedReferral(null);
  };

  const handleResolved = () => {
    setSelectedReferral(null);
    fetchReferrals();
    onResolved();
  };

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getConfidenceColor = (confidence: number | null): string => {
    if (!confidence) return 'text-gray-500 dark:text-gray-400';
    if (confidence >= 0.8) return 'text-green-600 dark:text-green-400';
    if (confidence >= 0.5) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getConfidenceLabel = (confidence: number | null): string => {
    if (!confidence) return 'Unknown';
    if (confidence >= 0.8) return 'High Match';
    if (confidence >= 0.5) return 'Possible Match';
    return 'Low Match';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-500 dark:text-gray-400">Loading pending referrals...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <button
          onClick={() => {
            setError(null);
            setLoading(true);
            fetchReferrals();
          }}
          className="mt-2 text-sm text-red-700 dark:text-red-300 hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (referrals.length === 0) {
    return (
      <div className="text-center py-12">
        <DocumentIcon className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-3" />
        <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
          No pending referrals
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Upload referral letters above to start processing
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Pending Referrals ({referrals.length})
          </h3>
          <button
            onClick={() => {
              setLoading(true);
              fetchReferrals();
            }}
            className="text-sm text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1"
          >
            <RefreshIcon className="w-4 h-4" />
            Refresh
          </button>
        </div>

        <div className="grid gap-3">
          {referrals.map((referral) => (
            <div
              key={referral.id}
              onClick={() => setSelectedReferral(referral)}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-teal-500 dark:hover:border-teal-500 cursor-pointer transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* Patient name */}
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-gray-900 dark:text-white truncate">
                      {referral.patientFirstName && referral.patientLastName
                        ? `${referral.patientFirstName} ${referral.patientLastName}`
                        : 'Unknown Patient'}
                    </h4>
                    {referral.patientDob && (
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        DOB: {formatDate(referral.patientDob)}
                      </span>
                    )}
                  </div>

                  {/* File info */}
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 truncate">
                    {referral.originalName}
                  </p>

                  {/* Referring info */}
                  {(referral.referringPhysician || referral.referringFacility) && (
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
                      Referred by:{' '}
                      {[referral.referringPhysician, referral.referringFacility]
                        .filter(Boolean)
                        .join(' at ')}
                    </p>
                  )}

                  {/* Reason for referral */}
                  {referral.reasonForReferral && (
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">
                      Reason: {referral.reasonForReferral}
                    </p>
                  )}
                </div>

                {/* Match status */}
                <div className="flex-shrink-0 text-right">
                  {referral.matchedPatientId ? (
                    <div className="space-y-1">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getConfidenceColor(
                          referral.matchConfidence
                        )} bg-gray-100 dark:bg-gray-700`}
                      >
                        <UserCheckIcon className="w-3 h-3" />
                        {getConfidenceLabel(referral.matchConfidence)}
                      </span>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {referral.matchedPatientFirstName} {referral.matchedPatientLastName}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        MRN: {referral.matchedPatientMrn}
                      </p>
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                      <UserPlusIcon className="w-3 h-3" />
                      New Patient
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Review Modal */}
      {selectedReferral && (
        <ReferralReviewModal
          referral={selectedReferral}
          onClose={handleModalClose}
          onResolved={handleResolved}
        />
      )}
    </>
  );
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
      />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}

function UserCheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
      />
    </svg>
  );
}

function UserPlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
      />
    </svg>
  );
}
