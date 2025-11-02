
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithPopup, User } from 'firebase/auth';
import { auth, googleProvider } from '../services/firebase';
import ErrorDisplay from '../components/ErrorDisplay';
import { useAuth } from '../hooks/useAuth';

const Login: React.FC = () => {
  const [error, setError] = useState<string | null>(null);
  const [unauthorizedDomain, setUnauthorizedDomain] = useState<boolean>(false);
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  
  if (!loading && user) {
      navigate('/');
      return null;
  }

  const handleLogin = async () => {
    setError(null);
    setUnauthorizedDomain(false);
    try {
      await signInWithPopup(auth, googleProvider);
      navigate('/');
    } catch (err: any) {
      if (err.code === 'auth/unauthorized-domain') {
        setUnauthorizedDomain(true);
      } else {
        console.error("Login error:", err);
        setError(err.message || "An unexpected error occurred.");
      }
    }
  };

  const UnauthorizedDomainError = () => (
    <ErrorDisplay
      title="Unauthorized Domain"
      message={
        <div className="text-sm">
          <p>This domain is not authorized to use Firebase Authentication.</p>
          <p className="mt-2">To fix this, please follow these steps:</p>
          <ol className="list-decimal list-inside mt-2 space-y-1">
            <li>
              Go to your{' '}
              <a
                href={`https://console.firebase.google.com/u/0/project/${auth.app.options.projectId}/authentication/settings`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline"
              >
                Firebase Authentication Settings
              </a>.
            </li>
            <li>Click on the "Authorized domains" tab.</li>
            <li>Click "Add domain".</li>
            <li>Copy and paste the following domain:</li>
          </ol>
          <pre className="bg-gray-800 text-pink-300 p-2 rounded-md mt-2 text-center select-all">
            {window.location.hostname}
          </pre>
        </div>
      }
    />
  );


  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-120px)]">
      <div className="w-full max-w-md p-8 space-y-8 bg-gray-800 rounded-2xl shadow-2xl">
        <h2 className="text-3xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
          Welcome to Character Studio
        </h2>
        <div className="text-center text-gray-400">
          Sign in to create and manage your characters.
        </div>

        {error && <ErrorDisplay title="Login Failed" message={error} />}
        {unauthorizedDomain && <UnauthorizedDomainError />}
        
        <button
          onClick={handleLogin}
          className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-transform transform hover:scale-105"
        >
          <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Sign in with Google
        </button>
      </div>
    </div>
  );
};

export default Login;
