"use client";

import React from "react";
import { useAuth } from "../context/AuthContext";

export const AuthGate: React.FC = () => {
  const { signInWithGoogle, configError } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-indigo-50 p-6">
      <div className="max-w-md w-full bg-white rounded-[2rem] border border-indigo-100 shadow-xl shadow-indigo-100/50 p-10 text-center space-y-6">
        <div>
          <h1 className="text-3xl font-black text-indigo-900 tracking-tight">Nexus</h1>
          <p className="text-slate-500 font-medium mt-2">Sign in to load your workspace data.</p>
        </div>
        {configError && (
          <p className="text-sm text-rose-600 font-medium">
            Missing Firebase environment variables. Copy `.env.example` to `.env.local` and fill in your
            Firebase web app keys.
          </p>
        )}
        <button
          type="button"
          onClick={() => void signInWithGoogle()}
          disabled={configError}
          className="w-full flex items-center justify-center gap-3 bg-white border-2 border-slate-200 hover:border-indigo-300 text-slate-800 font-bold py-3.5 px-6 rounded-2xl transition-colors disabled:opacity-50 shadow-sm"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden>
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Continue with Google
        </button>
      </div>
    </div>
  );
};
