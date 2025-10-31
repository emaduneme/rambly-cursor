import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ramblesApi } from '../api/rambles';
import { RambleDetail } from '../types';

export default function ResultPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [ramble, setRamble] = useState<RambleDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');

  useEffect(() => {
    if (!id) {
      navigate('/');
      return;
    }

    loadRamble();
  }, [id, navigate]);

  const loadRamble = async () => {
    try {
      setIsLoading(true);
      const data = await ramblesApi.get(id!);
      setRamble(data);
      setEditedTitle(data.title || '');
    } catch (err: any) {
      console.error('Failed to load ramble:', err);
      setError(err.response?.data?.message || 'Failed to load ramble.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveTitle = async () => {
    if (!id || !editedTitle.trim()) return;

    try {
      await ramblesApi.update(id, { title: editedTitle });
      setRamble((prev) => (prev ? { ...prev, title: editedTitle } : null));
      setIsEditingTitle(false);
    } catch (err) {
      console.error('Failed to update title:', err);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    if (!confirm('Are you sure you want to delete this ramble? This cannot be undone.')) return;

    try {
      await ramblesApi.delete(id);
      navigate('/rambles');
    } catch (err) {
      console.error('Failed to delete ramble:', err);
      alert('Failed to delete ramble. Please try again.');
    }
  };

  const handleExport = async () => {
    if (!id) return;
    try {
      await ramblesApi.export(id);
    } catch (err) {
      console.error('Failed to export ramble:', err);
      alert('Failed to export ramble. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-200 border-t-primary-600" />
      </div>
    );
  }

  if (error || !ramble) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-4">
        <div className="text-center max-w-md">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Ramble Not Found</h2>
          <p className="text-gray-600 mb-6">{error || 'This ramble could not be found.'}</p>
          <button onClick={() => navigate('/')} className="btn btn-primary">
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => navigate('/rambles')}
              className="text-primary-600 hover:text-primary-700 font-medium touch-target"
            >
              ← Back
            </button>
            <div className="flex space-x-2">
              <button
                onClick={handleExport}
                className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900 touch-target"
                title="Export"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-sm text-red-600 hover:text-red-700 touch-target"
                title="Delete"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Title */}
          {isEditingTitle ? (
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                className="flex-1 text-xl font-semibold border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveTitle();
                  if (e.key === 'Escape') setIsEditingTitle(false);
                }}
              />
              <button onClick={handleSaveTitle} className="text-primary-600 hover:text-primary-700">
                Save
              </button>
              <button
                onClick={() => setIsEditingTitle(false)}
                className="text-gray-600 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-semibold text-gray-900 flex-1">
                {ramble.title || 'Untitled Ramble'}
              </h1>
              <button
                onClick={() => setIsEditingTitle(true)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                  />
                </svg>
              </button>
            </div>
          )}

          {/* Metadata */}
          <div className="flex items-center space-x-4 text-sm text-gray-500 mt-2">
            <span>{new Date(ramble.createdAt).toLocaleDateString()}</span>
            {ramble.durationSeconds && (
              <span>
                {Math.floor(ramble.durationSeconds / 60)}:
                {(ramble.durationSeconds % 60).toString().padStart(2, '0')}
              </span>
            )}
            {ramble.language && <span>{ramble.language.toUpperCase()}</span>}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
          {/* Polished Note */}
          {ramble.polishedNote && (
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <svg
                  className="w-5 h-5 text-primary-600 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Polished Note
              </h2>
              <div className="prose prose-sm max-w-none">
                <div className="text-gray-800 whitespace-pre-wrap leading-relaxed">
                  {ramble.polishedNote.content}
                </div>
              </div>
            </div>
          )}

          {/* Original Transcript */}
          {ramble.transcript && (
            <div className="card">
              <button
                onClick={() => setShowTranscript(!showTranscript)}
                className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
              >
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <svg
                    className="w-5 h-5 text-gray-600 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  Original Transcript
                </h2>
                <svg
                  className={`w-5 h-5 text-gray-400 transform transition-transform ${
                    showTranscript ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {showTranscript && (
                <div className="px-6 pb-6 border-t border-gray-200">
                  <div className="mt-4 text-gray-700 whitespace-pre-wrap leading-relaxed text-sm">
                    {ramble.transcript.rawText}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* New Ramble CTA */}
          <div className="text-center py-8">
            <button onClick={() => navigate('/record')} className="btn btn-primary">
              Create Another Ramble
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
