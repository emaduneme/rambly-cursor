import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { fetchUser } = useAuthStore();

  useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');

    if (success === 'true') {
      // Fetch user data and redirect to rambles list
      fetchUser().then(() => {
        navigate('/rambles');
      });
    } else if (error) {
      // Show error and redirect to home
      alert(`Authentication failed: ${error}`);
      navigate('/');
    } else {
      // No params, redirect to home
      navigate('/');
    }
  }, [searchParams, navigate, fetchUser]);

  return (
    <div className="h-full flex items-center justify-center bg-gradient-to-br from-primary-50 to-white">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-200 border-t-primary-600 mx-auto mb-4" />
        <p className="text-gray-600">Completing sign in...</p>
      </div>
    </div>
  );
}
