"use client";

import React from "react";
import { Mail, MapPin, BadgeCheck, FileText, X } from "lucide-react";
import type { User } from "../types";

interface UserProfileModalProps {
  user: User;
  onClose: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ user, onClose }) => {
  const initial = (user.name || "?").charAt(0).toUpperCase();
  const email = user.email?.trim() || "Not provided";
  const title = user.title?.trim() || user.role || "Member";
  const location = user.location?.trim() || "Not provided";
  const bio = user.bio?.trim() || "No bio yet.";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-950/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-profile-modal-title"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          aria-label="Close profile"
        >
          <X size={18} />
        </button>

        <div className="border-b border-gray-100 bg-gradient-to-br from-blue-50 to-white px-6 pb-6 pt-8">
          <div className="flex items-center gap-4">
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="h-16 w-16 rounded-full border-2 border-white object-cover shadow-sm"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-white bg-blue-100 text-xl font-bold text-blue-700 shadow-sm">
                {initial}
              </div>
            )}
            <div className="min-w-0">
              <h2 id="user-profile-modal-title" className="truncate text-xl font-bold text-gray-900">
                {user.name || "Unknown member"}
              </h2>
              <p className="mt-0.5 truncate text-sm font-medium text-gray-500">{title}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4 px-6 py-5">
          <ProfileField icon={<Mail size={16} />} label="Email" value={email} />
          <ProfileField icon={<BadgeCheck size={16} />} label="Title" value={title} />
          <ProfileField icon={<MapPin size={16} />} label="Location" value={location} />
          <ProfileField icon={<FileText size={16} />} label="Short bio" value={bio} multiline />
        </div>
      </div>
    </div>
  );
};

function ProfileField({
  icon,
  label,
  value,
  multiline = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-500">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{label}</p>
        <p
          className={
            multiline
              ? "mt-1 whitespace-pre-wrap text-sm font-medium leading-relaxed text-gray-800"
              : "mt-0.5 truncate text-sm font-semibold text-gray-800"
          }
        >
          {value}
        </p>
      </div>
    </div>
  );
}
