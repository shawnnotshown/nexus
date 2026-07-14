"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { useUserProfile } from "../context/UserProfileContext";
import type { User } from "../types";

interface UserAvatarButtonProps {
  user: User;
  className?: string;
  imgClassName?: string;
  title?: string;
  style?: React.CSSProperties;
  stopPropagation?: boolean;
}

export const UserAvatarButton: React.FC<UserAvatarButtonProps> = ({
  user,
  className,
  imgClassName,
  title,
  style,
  stopPropagation = true,
}) => {
  const { openUserProfile } = useUserProfile();
  const initial = (user.name || "?").charAt(0).toUpperCase();

  return (
    <button
      type="button"
      onClick={(event) => {
        if (stopPropagation) event.stopPropagation();
        openUserProfile(user);
      }}
      className={cn(
        "rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2",
        className
      )}
      title={title ?? `View ${user.name}'s profile`}
      aria-label={`View ${user.name}'s profile`}
      style={style}
    >
      {user.avatar ? (
        <img
          src={user.avatar}
          alt={user.name}
          className={cn("rounded-full object-cover", imgClassName)}
        />
      ) : (
        <span
          className={cn(
            "flex items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700",
            imgClassName
          )}
          aria-hidden
        >
          {initial}
        </span>
      )}
    </button>
  );
};
