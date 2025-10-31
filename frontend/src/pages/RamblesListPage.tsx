import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ramblesApi } from '../api/rambles';
import { Ramble } from '../types';
import Header from '../components/Header';
import { useAuthStore } from '../store/authStore';

export default function RamblesListPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();
  const [rambles, setRambles] = useState<Ramble[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    // Wait for auth to load
    if (authLoading) return;

    loadRambles();
  }, [page, authLoading]);

  const loadRambles = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await ramblesApi.list(page, 20);
      setRambles(data.rambles);
      setTotalPages(data.pagination.totalPages);
    } catch (err: any) {
      console.error('Failed to load rambles:', err);
      setError(err.response?.data?.message || 'Failed to load rambles.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRambleClick = (id: string) => {
    navigate(`/result/${id}`);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return null;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (authLoading || isLoading) {
    return (
      <div className="h-full flex flex-col bg-gray-50">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-200 border-t-primary-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <Header />

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">My Rambles</h1>
            <button onClick={() => navigate('/record')} className="btn btn-primary">
              + New Ramble
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Guest Notice */}
          {!isAuthenticated && rambles.length > 0 && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start space-x-3">
                <svg
                  className="w-5 h-5 text-amber-600 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <div>
                  <p className="text-sm text-amber-800 font-medium mb-1">Guest Session</p>
                  <p className="text-sm text-amber-700">
                    These rambles will expire in 24 hours.{' '}
                    <button
                      onClick={() => (window.location.href = '/api/auth/google')}
                      className="underline font-medium hover:text-amber-900"
                    >
                      Sign in to save them permanently
                    </button>
                    .
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Empty State */}
          {rambles.length === 0 && !isLoading && (
            <div className="text-center py-12">
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-12 h-12 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">No rambles yet</h2>
              <p className="text-gray-600 mb-6">Start by recording your first ramble!</p>
              <button onClick={() => navigate('/record')} className="btn btn-primary">
                Start Rambly
              </button>
            </div>
          )}

          {/* Rambles List */}
          {rambles.length > 0 && (
            <div className="space-y-3">
              {rambles.map((ramble) => (
                <div
                  key={ramble.id}
                  onClick={() => handleRambleClick(ramble.id)}
                  className="card p-4 cursor-pointer hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1 truncate">
                        {ramble.title || 'Untitled Ramble'}
                      </h3>

                      {ramble.excerpt && (
                        <p className="text-sm text-gray-600 line-clamp-2 mb-2">{ramble.excerpt}</p>
                      )}

                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span>{formatDate(ramble.createdAt)}</span>
                        {ramble.durationSeconds && <span>{formatDuration(ramble.durationSeconds)}</span>}
                        {ramble.status === 'processing' && (
                          <span className="text-primary-600 font-medium">Processing...</span>
                        )}
                        {ramble.status === 'failed' && (
                          <span className="text-red-600 font-medium">Failed</span>
                        )}
                      </div>
                    </div>

                    <div className="ml-4">
                      <svg
                        className="w-5 h-5 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center space-x-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
