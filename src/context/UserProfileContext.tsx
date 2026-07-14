"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAppContext } from "./AppContext";
import { UserProfileModal } from "../components/UserProfileModal";
import type { User } from "../types";

interface UserProfileContextType {
  openUserProfile: (userOrId: User | string) => void;
  closeUserProfile: () => void;
}

const UserProfileContext = createContext<UserProfileContextType | undefined>(undefined);

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const { users, currentUser } = useAppContext();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [fallbackUser, setFallbackUser] = useState<User | null>(null);

  const openUserProfile = useCallback((userOrId: User | string) => {
    if (typeof userOrId === "string") {
      setSelectedUserId(userOrId);
      setFallbackUser(null);
      return;
    }
    setSelectedUserId(userOrId.id);
    setFallbackUser(userOrId);
  }, []);

  const closeUserProfile = useCallback(() => {
    setSelectedUserId(null);
    setFallbackUser(null);
  }, []);

  const selectedUser = useMemo(() => {
    if (!selectedUserId) return null;
    if (currentUser.id === selectedUserId) return currentUser;
    const fromList = users.find((user) => user.id === selectedUserId);
    return fromList ?? fallbackUser;
  }, [selectedUserId, users, currentUser, fallbackUser]);

  useEffect(() => {
    if (!selectedUserId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeUserProfile();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selectedUserId, closeUserProfile]);

  const value = useMemo(
    () => ({ openUserProfile, closeUserProfile }),
    [openUserProfile, closeUserProfile]
  );

  return (
    <UserProfileContext.Provider value={value}>
      {children}
      {selectedUser && <UserProfileModal user={selectedUser} onClose={closeUserProfile} />}
    </UserProfileContext.Provider>
  );
}

export function useUserProfile() {
  const context = useContext(UserProfileContext);
  if (!context) {
    throw new Error("useUserProfile must be used within UserProfileProvider");
  }
  return context;
}
