import { useAuthStore } from '../store/authStore';
import { authApi } from '../api/auth';

export default function Header() {
  const { isAuthenticated, user, logout } = useAuthStore();

  const handleSignIn = () => {
    authApi.loginWithGoogle();
  };

  const handleLogout = async () => {
    await logout();
    window.location.href = '/';
  };

  return (
    <header className="w-full bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <a href="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">R</span>
            </div>
            <span className="text-xl font-bold text-gray-900">Rambly</span>
          </a>

          {/* Auth section */}
          <div className="flex items-center space-x-4">
            {isAuthenticated ? (
              <>
                <a
                  href="/rambles"
                  className="text-gray-700 hover:text-primary-600 font-medium touch-target"
                >
                  My Rambles
                </a>
                <button
                  onClick={handleLogout}
                  className="text-gray-700 hover:text-primary-600 font-medium touch-target"
                >
                  Sign Out
                </button>
                {user?.settings.picture && (
                  <img
                    src={user.settings.picture}
                    alt="Profile"
                    className="w-8 h-8 rounded-full"
                  />
                )}
              </>
            ) : (
              <button
                onClick={handleSignIn}
                className="text-primary-600 hover:text-primary-700 font-medium touch-target"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
