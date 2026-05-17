"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Mail, MapPin, BadgeCheck, User as UserIcon, FileText, Save, Lock, CheckCircle2 } from "lucide-react";
import { useAppContext } from "../context/AppContext";

interface FormState {
  name: string;
  title: string;
  location: string;
  bio: string;
}

const BIO_MAX = 280;

export const Settings: React.FC = () => {
  const { currentUser, updateProfile } = useAppContext();

  const initial = useMemo<FormState>(
    () => ({
      name: currentUser.name ?? "",
      title: currentUser.title ?? "",
      location: currentUser.location ?? "",
      bio: currentUser.bio ?? "",
    }),
    [currentUser.name, currentUser.title, currentUser.location, currentUser.bio]
  );

  const [form, setForm] = useState<FormState>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    setForm(initial);
  }, [initial]);

  const email = currentUser.email ?? "";
  const nameError = form.name.trim().length === 0 ? "Name is required." : null;
  const emailError = email.trim().length === 0 ? "Email is required." : null;
  const isDirty =
    form.name !== initial.name ||
    form.title !== initial.title ||
    form.location !== initial.location ||
    form.bio !== initial.bio;
  const canSubmit = !saving && !nameError && !emailError && isDirty;

  const handleChange = (field: keyof FormState) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = event.target.value;
      setForm((prev) => ({ ...prev, [field]: value }));
      if (savedAt) setSavedAt(null);
      if (error) setError(null);
    };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      await updateProfile({
        name: form.name,
        title: form.title,
        location: form.location,
        bio: form.bio,
      });
      setSavedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setForm(initial);
    setError(null);
    setSavedAt(null);
  };

  const initialChar = (currentUser.name || "?").charAt(0).toUpperCase();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-indigo-900 tracking-tight">Settings</h1>
          <p className="text-slate-500 mt-1 font-medium">
            Manage how your profile appears across Nexus.
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-[2.5rem] border border-indigo-50 shadow-xl shadow-indigo-100/50 overflow-hidden"
      >
        <div className="p-8 border-b border-indigo-50 flex items-center gap-5">
          {currentUser.avatar ? (
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-16 h-16 rounded-full border-2 border-white shadow-md object-cover"
            />
          ) : (
            <div
              className="w-16 h-16 rounded-full border-2 border-white shadow-md bg-indigo-200 text-indigo-900 font-black text-xl flex items-center justify-center"
              aria-hidden
            >
              {initialChar}
            </div>
          )}
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-indigo-900 truncate">
              {currentUser.name || "Your profile"}
            </h2>
            <p className="text-sm text-slate-500 truncate">
              {currentUser.title?.trim() || currentUser.role || "Member"}
            </p>
          </div>
        </div>

        <div className="p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Field
              label="Name"
              required
              icon={<UserIcon size={16} />}
              error={nameError}
            >
              <input
                type="text"
                value={form.name}
                onChange={handleChange("name")}
                placeholder="e.g. Shawn Campo"
                autoComplete="name"
                className="w-full bg-indigo-50/50 border-none rounded-2xl px-4 py-3 text-sm font-medium placeholder-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-shadow"
                aria-invalid={Boolean(nameError)}
                aria-required="true"
              />
            </Field>

            <Field
              label="Email address"
              required
              icon={<Mail size={16} />}
              hint="Synced from your Google account"
              trailing={<Lock size={14} className="text-slate-400" aria-hidden />}
              error={emailError}
            >
              <input
                type="email"
                value={email}
                readOnly
                disabled
                aria-readonly="true"
                aria-required="true"
                className="w-full bg-slate-100 text-slate-600 border-none rounded-2xl px-4 py-3 text-sm font-medium cursor-not-allowed select-text"
              />
            </Field>

            <Field label="Title" icon={<BadgeCheck size={16} />}>
              <input
                type="text"
                value={form.title}
                onChange={handleChange("title")}
                placeholder="e.g. Product Designer"
                className="w-full bg-indigo-50/50 border-none rounded-2xl px-4 py-3 text-sm font-medium placeholder-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-shadow"
              />
            </Field>

            <Field label="Location" icon={<MapPin size={16} />}>
              <input
                type="text"
                value={form.location}
                onChange={handleChange("location")}
                placeholder="e.g. Manila, Philippines"
                autoComplete="address-level2"
                className="w-full bg-indigo-50/50 border-none rounded-2xl px-4 py-3 text-sm font-medium placeholder-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-shadow"
              />
            </Field>
          </div>

          <Field
            label="Short bio"
            icon={<FileText size={16} />}
            hint={`${form.bio.length}/${BIO_MAX}`}
          >
            <textarea
              value={form.bio}
              onChange={handleChange("bio")}
              rows={4}
              maxLength={BIO_MAX}
              placeholder="A few words about you..."
              className="w-full bg-indigo-50/50 border-none rounded-2xl px-4 py-3 text-sm font-medium placeholder-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-shadow resize-none"
            />
          </Field>

          {error && (
            <div className="rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-semibold px-4 py-3">
              {error}
            </div>
          )}
        </div>

        <div className="px-8 py-5 bg-indigo-50/40 border-t border-indigo-50 flex items-center justify-between gap-4">
          <div className="text-sm font-medium text-slate-500 flex items-center gap-2 min-h-[20px]">
            {savedAt && !isDirty ? (
              <>
                <CheckCircle2 size={16} className="text-emerald-500" />
                Profile updated
              </>
            ) : isDirty ? (
              <span className="text-amber-600">Unsaved changes</span>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleReset}
              disabled={!isDirty || saving}
              className="px-4 py-2.5 rounded-full text-sm font-bold text-slate-600 hover:bg-indigo-100 disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
            >
              Reset
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold bg-indigo-600 text-white shadow-md shadow-indigo-300/40 hover:bg-indigo-700 disabled:bg-indigo-300 disabled:shadow-none disabled:cursor-not-allowed transition-colors"
            >
              <Save size={16} />
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

interface FieldProps {
  label: string;
  icon?: React.ReactNode;
  required?: boolean;
  hint?: string;
  trailing?: React.ReactNode;
  error?: string | null;
  children: React.ReactNode;
}

const Field: React.FC<FieldProps> = ({ label, icon, required, hint, trailing, error, children }) => {
  return (
    <label className="block">
      <div className="flex items-center justify-between mb-2">
        <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-indigo-900">
          {icon && <span className="text-indigo-400">{icon}</span>}
          {label}
          {required && <span className="text-rose-500">*</span>}
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400">
          {hint}
          {trailing}
        </span>
      </div>
      {children}
      {error && <p className="mt-1.5 text-xs font-semibold text-rose-600">{error}</p>}
    </label>
  );
};
