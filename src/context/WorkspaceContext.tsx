"use client";

import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { doc, getDoc, getDocFromServer, setDoc, serverTimestamp, arrayUnion } from "firebase/firestore";
import { getFirebaseDb } from "../lib/firebase";
import { acceptProjectInvite } from "../lib/acceptProjectInvite";
import { parsePendingInvite, PENDING_INVITE_KEY } from "../lib/pendingInvite";
import { useAuth } from "./AuthContext";

interface WorkspaceContextType {
  workspaceId: string | null;
  ready: boolean;
  error: string | null;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

function toWorkspaceSelection(raw: Record<string, unknown>) {
  const workspaceIds = Array.isArray(raw.workspaceIds) ? (raw.workspaceIds as string[]) : [];
  const defaultWid = typeof raw.defaultWorkspaceId === "string" ? raw.defaultWorkspaceId : null;
  return { workspaceIds, defaultWid };
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading, configError } = useAuth();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (configError) {
      setError("Firebase is not configured. Set NEXT_PUBLIC_FIREBASE_* in .env.local.");
      setReady(true);
      setWorkspaceId(null);
      return;
    }

    if (authLoading) return;

    if (!user) {
      setWorkspaceId(null);
      setReady(true);
      setError(null);
      return;
    }

    const db = getFirebaseDb();
    if (!db) {
      setError("Firestore unavailable.");
      setReady(true);
      setWorkspaceId(null);
      return;
    }

    let cancelled = false;

    (async () => {
      setReady(false);
      setError(null);

      try {
        const userRef = doc(db, "users", user.uid);
        const pendingInvite = parsePendingInvite(sessionStorage.getItem(PENDING_INVITE_KEY));

        // Always process a pending invite first — even if the user already has a personal workspace.
        if (pendingInvite) {
          try {
            const idToken = await user.getIdToken();
            const accepted = await acceptProjectInvite(
              idToken,
              pendingInvite.workspaceId,
              pendingInvite.token
            );
            sessionStorage.removeItem(PENDING_INVITE_KEY);

            if (!cancelled) {
              setWorkspaceId(accepted.workspaceId);
              setReady(true);
            }
            return;
          } catch (inviteError) {
            sessionStorage.removeItem(PENDING_INVITE_KEY);
            if (!cancelled) {
              setError(
                inviteError instanceof Error ? inviteError.message : "Failed to accept invite."
              );
              setWorkspaceId(null);
              setReady(true);
            }
            return;
          }
        }

        let snap = await getDocFromServer(userRef).catch(() => getDoc(userRef));
        const data = snap.exists() ? (snap.data() as Record<string, unknown>) : {};
        const { workspaceIds, defaultWid } = toWorkspaceSelection(data);

        if (workspaceIds.length > 0) {
          const wid = defaultWid && workspaceIds.includes(defaultWid) ? defaultWid : workspaceIds[0]!;

          if (wid !== user.uid) {
            const memberSnap = await getDoc(doc(db, "workspaces", wid, "members", user.uid));
            if (!memberSnap.exists()) {
              if (!cancelled) {
                setError(
                  "You do not have access to this workspace yet. Open the invite link again or ask the project owner for a new invite."
                );
                setWorkspaceId(null);
                setReady(true);
              }
              return;
            }
          }

          if (user.email) {
            try {
              await setDoc(
                doc(db, "workspaces", wid, "members", user.uid),
                { email: user.email },
                { merge: true }
              );
            } catch {
              // non-fatal: rules may temporarily reject; settings page can still update later.
            }
          }

          if (!cancelled) {
            setWorkspaceId(wid);
            setReady(true);
          }
          return;
        }

        if (cancelled) return;

        const displayName = user.displayName ?? "My workspace";
        const photoURL = user.photoURL ?? "";
        const email = user.email ?? "";
        const wid = user.uid;

        await setDoc(
          doc(db, "workspaces", wid),
          {
            name: `${(displayName.split(" ")[0] ?? "My")}'s workspace`,
            createdAt: serverTimestamp(),
            createdBy: user.uid,
          },
          { merge: true }
        );
        if (cancelled) return;

        await setDoc(
          doc(db, "workspaces", wid, "members", user.uid),
          {
            role: "owner",
            xp: 0,
            level: 1,
            badges: [],
            joinedAt: serverTimestamp(),
            displayName,
            photoURL,
            name: displayName,
            email,
          },
          { merge: true }
        );
        if (cancelled) return;

        await setDoc(
          userRef,
          {
            displayName,
            photoURL,
            email,
            workspaceIds: arrayUnion(wid),
            defaultWorkspaceId: wid,
          },
          { merge: true }
        );

        if (!cancelled) {
          setWorkspaceId(wid);
          setReady(true);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Workspace bootstrap failed");
          setWorkspaceId(null);
          setReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading, configError]);

  return (
    <WorkspaceContext.Provider value={{ workspaceId, ready, error }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
