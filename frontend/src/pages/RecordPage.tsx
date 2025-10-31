import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { ramblesApi } from '../api/rambles';

export default function RecordPage() {
  const navigate = useNavigate();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    isRecording,
    isPaused,
    recordingTime,
    audioLevel,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    cancelRecording,
  } = useAudioRecorder({
    onStop: handleRecordingStop,
  });

  async function handleRecordingStop(audioBlob: Blob) {
    try {
      setIsUploading(true);
      setError(null);

      const ramble = await ramblesApi.create(audioBlob, {
        durationSeconds: recordingTime,
      });

      navigate(`/processing/${ramble.id}`);
    } catch (err: any) {
      console.error('Failed to upload ramble:', err);
      setError(err.response?.data?.message || 'Failed to upload recording. Please try again.');
      setIsUploading(false);
    }
  }

  const handleStart = async () => {
    try {
      setError(null);
      await startRecording();
    } catch (err) {
      setError('Failed to access microphone. Please grant permission.');
    }
  };

  const handleCancel = () => {
    cancelRecording();
    navigate('/');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <button
          onClick={handleCancel}
          className="text-gray-600 hover:text-gray-900 touch-target"
          disabled={isUploading}
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
        <h1 className="text-lg font-semibold text-gray-900">Record Ramble</h1>
        <div className="w-6" />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm max-w-md">
            {error}
          </div>
        )}

        {!isRecording && !isUploading && (
          <div className="text-center">
            <p className="text-gray-600 mb-8">Tap to start recording</p>
            <button
              onClick={handleStart}
              className="w-32 h-32 rounded-full bg-red-500 hover:bg-red-600 active:scale-95 transition-all shadow-lg flex items-center justify-center"
            >
              <svg className="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
            </button>
          </div>
        )}

        {isRecording && (
          <div className="w-full max-w-md">
            {/* Time Display */}
            <div className="text-center mb-8">
              <div className="text-5xl font-mono font-bold text-gray-900 mb-2">
                {formatTime(recordingTime)}
              </div>
              {recordingTime > 1800 && (
                <p className="text-sm text-amber-600">
                  Long recording detected. Consider splitting into shorter segments.
                </p>
              )}
            </div>

            {/* Waveform Visualization */}
            <div className="h-32 bg-gray-200 rounded-lg mb-8 flex items-center justify-center relative overflow-hidden">
              <div
                className="absolute left-0 bottom-0 bg-primary-500 transition-all duration-100"
                style={{
                  height: `${audioLevel}%`,
                  width: '100%',
                  opacity: 0.3,
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex space-x-1">
                  {[...Array(20)].map((_, i) => (
                    <div
                      key={i}
                      className="w-1 bg-primary-600 rounded-full transition-all duration-100"
                      style={{
                        height: `${Math.random() * audioLevel + 20}%`,
                        opacity: isPaused ? 0.3 : 1,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center space-x-6">
              {/* Pause/Resume */}
              <button
                onClick={isPaused ? resumeRecording : pauseRecording}
                className="w-16 h-16 rounded-full bg-gray-300 hover:bg-gray-400 active:scale-95 transition-all shadow flex items-center justify-center"
              >
                {isPaused ? (
                  <svg className="w-8 h-8 text-gray-700" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                ) : (
                  <svg className="w-8 h-8 text-gray-700" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                )}
              </button>

              {/* Stop */}
              <button
                onClick={stopRecording}
                disabled={isUploading}
                className="w-24 h-24 rounded-full bg-red-500 hover:bg-red-600 active:scale-95 transition-all shadow-lg flex items-center justify-center disabled:opacity-50"
              >
                <div className="w-10 h-10 bg-white rounded" />
              </button>

              {/* Cancel */}
              <button
                onClick={handleCancel}
                disabled={isUploading}
                className="w-16 h-16 rounded-full bg-gray-300 hover:bg-gray-400 active:scale-95 transition-all shadow flex items-center justify-center"
              >
                <svg className="w-8 h-8 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <p className="text-center text-sm text-gray-500 mt-6">
              {isPaused ? 'Recording paused' : 'Recording...'}
            </p>
          </div>
        )}

        {isUploading && (
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary-200 border-t-primary-600 mx-auto mb-4" />
            <p className="text-gray-600">Uploading recording...</p>
          </div>
        )}
      </div>

      {/* Hint */}
      {!isRecording && !isUploading && (
        <div className="p-4 text-center text-sm text-gray-500">
          <p>Tap, talk, tidy. Your thoughts — cleaned.</p>
        </div>
      )}
    </div>
  );
}
