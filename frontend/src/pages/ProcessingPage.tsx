import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ramblesApi } from '../api/rambles';
import { RambleStatus } from '../types';

export default function ProcessingPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<RambleStatus>(RambleStatus.PROCESSING);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('Uploading audio...');

  useEffect(() => {
    if (!id) {
      navigate('/');
      return;
    }

    let pollInterval: NodeJS.Timeout;

    const pollStatus = async () => {
      try {
        const ramble = await ramblesApi.getStatus(id);

        setStatus(ramble.status);

        // Update progress message based on status
        switch (ramble.status) {
          case RambleStatus.UPLOADING:
            setProgress('Uploading audio...');
            break;
          case RambleStatus.PROCESSING:
            setProgress('Transcribing and generating your polished note...');
            break;
          case RambleStatus.READY:
            setProgress('Complete!');
            // Navigate to result page after a short delay
            setTimeout(() => {
              navigate(`/result/${id}`);
            }, 500);
            break;
          case RambleStatus.FAILED:
            setError('Processing failed. Please try recording again.');
            break;
        }
      } catch (err: any) {
        console.error('Failed to poll status:', err);
        setError(err.response?.data?.message || 'Failed to check processing status.');
      }
    };

    // Initial poll
    pollStatus();

    // Poll every 2 seconds
    pollInterval = setInterval(pollStatus, 2000);

    return () => {
      clearInterval(pollInterval);
    };
  }, [id, navigate]);

  const handleCancel = () => {
    navigate('/');
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-primary-50 to-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <div className="w-6" />
        <h1 className="text-lg font-semibold text-gray-900">Processing</h1>
        <button
          onClick={handleCancel}
          className="text-gray-600 hover:text-gray-900 touch-target"
          disabled={status === RambleStatus.READY}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        {error ? (
          <div className="text-center max-w-md">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Processing Failed</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button onClick={() => navigate('/record')} className="btn btn-primary">
              Try Again
            </button>
          </div>
        ) : (
          <div className="text-center max-w-md">
            {/* Spinner */}
            <div className="relative mb-8">
              <div className="animate-spin rounded-full h-24 w-24 border-4 border-primary-200 border-t-primary-600 mx-auto" />
              {/* Pulse effect */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 bg-primary-100 rounded-full animate-ping opacity-20" />
              </div>
            </div>

            {/* Progress Message */}
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {status === RambleStatus.READY ? 'Ready!' : 'Processing your ramble...'}
            </h2>
            <p className="text-gray-600 mb-8">{progress}</p>

            {/* Status Steps */}
            <div className="space-y-4 text-left">
              <div className="flex items-center space-x-3">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    status !== RambleStatus.UPLOADING
                      ? 'bg-green-500'
                      : 'bg-primary-200 animate-pulse'
                  }`}
                >
                  {status !== RambleStatus.UPLOADING && (
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
                <span className="text-sm text-gray-700">Audio uploaded</span>
              </div>

              <div className="flex items-center space-x-3">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    status === RambleStatus.READY
                      ? 'bg-green-500'
                      : status === RambleStatus.PROCESSING
                      ? 'bg-primary-200 animate-pulse'
                      : 'bg-gray-200'
                  }`}
                >
                  {status === RambleStatus.READY && (
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
                <span className="text-sm text-gray-700">Transcribing speech</span>
              </div>

              <div className="flex items-center space-x-3">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    status === RambleStatus.READY ? 'bg-green-500' : 'bg-gray-200'
                  }`}
                >
                  {status === RambleStatus.READY && (
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
                <span className="text-sm text-gray-700">Generating polished note</span>
              </div>
            </div>

            <p className="text-sm text-gray-500 mt-8">This usually takes 10-30 seconds...</p>
          </div>
        )}
      </div>
    </div>
  );
}
