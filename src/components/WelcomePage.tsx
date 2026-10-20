import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { SpeakBloomLogo } from './SpeakBloomLogo';

export const WelcomePage: React.FC = () => {
  const { signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    try {
      setLoading(true);
      setError(null);
      await signInWithGoogle();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Authentication was interrupted. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#FAF9FC] px-6 select-none">
      <div className="w-full max-w-sm flex flex-col items-center text-center">
        {/* Speak Bloom Minimal Audio Logo & Wordmark */}
        <div className="mb-10 flex flex-col items-center">
          <div className="mb-5 transition-transform hover:scale-105 duration-300">
            <SpeakBloomLogo size="xl" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[#16151E]">
            Speak <span className="text-[#6546D7]">Bloom</span>
          </h1>
        </div>

        {/* Real Google Sign-In Button */}
        <button
          onClick={handleSignIn}
          disabled={loading}
          aria-label="Continue with Google"
          className="w-full h-13 px-6 rounded-2xl bg-white hover:bg-[#F3F2F8] active:scale-[0.98] border border-[#E3E1EB] shadow-sm hover:shadow transition-all duration-200 flex items-center justify-center gap-3.5 text-[#1D1B26] font-medium text-[15px] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-[#6546D7] border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3h3.86c2.26-2.09 3.685-5.17 3.685-9.09z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.26v3.09C3.25 21.3 7.31 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.26C.46 8.23 0 10.06 0 12s.46 3.77 1.26 5.38l4.01-3.09z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.7 1.26 6.62l4.01 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
              />
            </svg>
          )}
          <span>{loading ? 'Connecting...' : 'Continue with Google'}</span>
        </button>

        {error && (
          <p className="mt-4 text-xs text-rose-600 bg-rose-50 border border-rose-200/60 rounded-xl py-2 px-3">
            {error}
          </p>
        )}
      </div>
    </div>
  );
};
