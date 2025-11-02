import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithRedirect, getRedirectResult } from 'firebase/auth';
import { auth, googleProvider } from '../services/firebase';
import ErrorDisplay from '../components/ErrorDisplay';
import { useAuth } from '../hooks/useAuth';
import Loader from '../components/Loader';

const Login: React.FC = () => {
  const [error, setError] = useState<string | null>(null);
  const [unauthorizedDomainInfo, setUnauthorizedDomainInfo] = useState<{show: boolean; domain: string}>({show: false, domain: ''});
  const [copied, setCopied] = useState(false);
  const [isProcessing, setIsProcessing] = useState(true); // Start as true to handle initial redirect check
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    const processRedirect = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result) {
          // User successfully signed in.
          navigate('/');
        }
      } catch (err: any) {
        // Handle errors from the redirect
         if (err.code === 'auth/unauthorized-domain') {
          const detectedDomain = window.location.hostname || 'aistudio.google.com';
          setUnauthorizedDomainInfo({show: true, domain: detectedDomain});
        } else {
          console.error("Login error from redirect:", err);
          setError(err.message || "An unexpected error occurred during sign-in.");
        }
      } finally {
        setIsProcessing(false); // Finished processing, show login UI
      }
    };
    
    // Only process redirect if the main auth state isn't loading and no user is found yet
    if (!loading && !user) {
        processRedirect();
    } else {
        setIsProcessing(false);
    }
  }, [navigate, user, loading]);
  
  if (!loading && user) {
      navigate('/');
      return null;
  }

  const handleLogin = async () => {
    setError(null);
    setUnauthorizedDomainInfo({show: false, domain: ''});
    setCopied(false);
    setIsProcessing(true); // Show loader while redirecting
    await signInWithRedirect(auth, googleProvider); // This will navigate away
  };

  const handleCopy = () => {
    if(unauthorizedDomainInfo.domain){
        navigator.clipboard.writeText(unauthorizedDomainInfo.domain);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
    }
  };

  const UnauthorizedDomainError: React.FC<{domain: string}> = ({domain}) => (
    <ErrorDisplay
      title="Unauthorized Domain"
      message={
        <div className="text-sm">
          <p>This domain is not authorized for Firebase Authentication.</p>
          <p className="mt-2">To fix this, please add the following domain to your project's settings:</p>
          <ol className="list-decimal list-inside my-2 space-y-1">
            <li>
              Open your{' '}
              <a
                href={`https://console.firebase.google.com/u/0/project/${auth.app.options.projectId}/authentication/settings`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline font-semibold"
              >
                Firebase Authentication Settings
              </a>.
            </li>
            <li>Go to the "Authorized domains" section.</li>
            <li>Click "Add domain" and paste the value below.</li>
          </ol>
          <div className="relative bg-gray-800 p-3 rounded-md mt-2 flex items-center justify-between">
            <code className="text-pink-300 select-all font-mono">
              {domain}
            </code>
            <button 
              onClick={handleCopy}
              disabled={!domain}
              className="bg-gray-700 hover:bg-gray-600 text-gray-200 font-bold py-1 px-3 rounded-md text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      }
    />
  );
  
  // While checking for redirect result or if the app is still loading auth state
  if (loading || isProcessing) {
      return (
          <div className="flex items-center justify-center min-h-[calc(100vh-120px)]">
              <Loader text="Authenticating..."/>
          </div>
      )
  }

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
        {unauthorizedDomainInfo.show && <UnauthorizedDomainError domain={unauthorizedDomainInfo.domain}/>}
        
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