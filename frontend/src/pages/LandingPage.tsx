import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';

export default function LandingPage() {
  const navigate = useNavigate();

  const handleStartRambly = () => {
    navigate('/record');
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-primary-50 via-white to-primary-50">
      <Header />

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 -mt-16">
        <div className="max-w-3xl mx-auto text-center">
          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            Do you have something in mind?{' '}
            <span className="text-primary-600">Start Rambly.</span>
          </h1>

          {/* Subhead */}
          <p className="text-lg sm:text-xl text-gray-600 mb-4">
            Say it. We'll tidy it. Save it.
          </p>

          <p className="text-base sm:text-lg text-gray-500 mb-12">
            Get a clean, shareable note from your spoken ideas.
          </p>

          {/* CTA */}
          <button
            onClick={handleStartRambly}
            className="btn btn-primary text-lg sm:text-xl px-12 py-4 shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            Start Rambly
          </button>

          {/* Value Props */}
          <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-8 text-left">
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mb-4">
                <svg
                  className="w-6 h-6 text-primary-600"
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
              <h3 className="font-semibold text-gray-900 mb-2">Record quickly</h3>
              <p className="text-sm text-gray-600">
                Tap, talk, and capture your thoughts on your phone.
              </p>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mb-4">
                <svg
                  className="w-6 h-6 text-primary-600"
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
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Instant transcription</h3>
              <p className="text-sm text-gray-600">
                Your words are transcribed automatically and accurately.
              </p>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mb-4">
                <svg
                  className="w-6 h-6 text-primary-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Polished note</h3>
              <p className="text-sm text-gray-600">
                Get a clean, organized note you can save and share.
              </p>
            </div>
          </div>

          {/* Privacy Note */}
          <p className="mt-12 text-sm text-gray-500">
            Your recordings are private. Delete any time.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-sm text-gray-500">
        <p>© 2025 Rambly. Made with voice.</p>
      </footer>
    </div>
  );
}
