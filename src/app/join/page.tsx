"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { WorkspaceProvider, useWorkspace } from "@/context/WorkspaceContext";
import { PENDING_INVITE_KEY, serializePendingInvite } from "@/lib/pendingInvite";

function JoinProjectScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading, signInWithGoogle, configError } = useAuth();
  const { workspaceId: acceptedWorkspaceId, ready, error: workspaceError } = useWorkspace();
  const [status, setStatus] = useState("Preparing your invite...");
  const [error, setError] = useState<string | null>(null);

  const workspaceIdParam = useMemo(() => searchParams.get("w")?.trim() ?? "", [searchParams]);
  const inviteToken = useMemo(() => searchParams.get("t")?.trim() ?? "", [searchParams]);

  useEffect(() => {
    if (!inviteToken || !workspaceIdParam) return;
    sessionStorage.setItem(
      PENDING_INVITE_KEY,
      serializePendingInvite(workspaceIdParam, inviteToken)
    );
  }, [inviteToken, workspaceIdParam]);

  useEffect(() => {
    if (!inviteToken || !workspaceIdParam) {
      setError(
        inviteToken && !workspaceIdParam
          ? "This invite link is outdated (missing workspace). Ask the project owner for a new invite."
          : "Invite link is invalid or incomplete."
      );
      return;
    }
    setError(null);

  }, [inviteToken, workspaceIdParam]);

  // WorkspaceContext handles accepting the invite based on `PENDING_INVITE_KEY`.
  // Here we only redirect once that bootstrap completes.
  useEffect(() => {
    if (!inviteToken || !workspaceIdParam) return;
    if (loading || !user || !ready) return;
    if (!acceptedWorkspaceId) return;

    setStatus("Invite accepted. Redirecting...");
    router.replace("/");
  }, [inviteToken, workspaceIdParam, acceptedWorkspaceId, ready, loading, user, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-indigo-50 p-6">
      <div className="max-w-md w-full bg-white rounded-[2rem] border border-indigo-100 shadow-xl shadow-indigo-100/50 p-10 text-center space-y-6">
        <div>
          <h1 className="text-3xl font-black text-indigo-900 tracking-tight">Join Nexus Project</h1>
          <p className="text-slate-500 font-medium mt-2">
            Sign in with Google to accept this project invitation.
          </p>
        </div>
        {configError && (
          <p className="text-sm text-rose-600 font-medium">
            Firebase environment variables are missing. Configure them before accepting invites.
          </p>
        )}
        {!inviteToken || !workspaceIdParam ? (
          <p className="text-sm font-semibold text-rose-600">
            {error ?? "This invite link is invalid. Ask your project owner for a new one."}
          </p>
        ) : !user ? (
          <button
            type="button"
            onClick={() => void signInWithGoogle()}
            disabled={loading || configError}
            className="w-full flex items-center justify-center gap-3 bg-white border-2 border-slate-200 hover:border-indigo-300 text-slate-800 font-bold py-3.5 px-6 rounded-2xl transition-colors disabled:opacity-50 shadow-sm"
          >
            Continue with Google
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-indigo-700">{status}</p>
            {(workspaceError || error) && (
              <p className="text-sm font-semibold text-rose-600">{workspaceError ?? error}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function JoinPageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-indigo-50 p-6">
      <div className="max-w-md w-full bg-white rounded-[2rem] border border-indigo-100 shadow-xl shadow-indigo-100/50 p-10 text-center">
        <p className="text-sm font-semibold text-indigo-700">Loading invite...</p>
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <AuthProvider>
      <WorkspaceProvider>
        <Suspense fallback={<JoinPageFallback />}>
          <JoinProjectScreen />
        </Suspense>
      </WorkspaceProvider>
    </AuthProvider>
  );
}
