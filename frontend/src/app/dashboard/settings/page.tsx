"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";

type CustomerProfile = {
  id: number;
  name: string | null;
  email: string;
  photo_url: string | null;
  email_verified: boolean;
  role: "customer";
};

export default function ProfileSettingsPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [photoSuccess, setPhotoSuccess] = useState("");

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        const data = (await apiRequest(
          "/customer/profile"
        )) as CustomerProfile;

        if (!active) return;

        setProfile(data);
        setName(data.name ?? "");
      } catch {
        if (active) {
          setError("Unable to load your profile. Please sign in again.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadProfile();

    return () => {
      active = false;
    };
  }, []);


  function handlePhotoChange(file: File | undefined) {
  setPhotoError("");
  setPhotoSuccess("");
  setSelectedPhoto(null);
  setPhotoPreview(null);

  if (!file) return;

  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  const maxSize = 2 * 1024 * 1024;

  if (!allowedTypes.includes(file.type)) {
    setPhotoError("Choose a JPEG, PNG, or WebP image.");
    return;
  }

  if (file.size > maxSize) {
    setPhotoError("Image must be 2 MB or smaller.");
    return;
  }

  setSelectedPhoto(file);
  setPhotoPreview(URL.createObjectURL(file));
}

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = name.trim();

    if (!trimmedName) {
      setError("Name cannot be empty.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const updated = (await apiRequest("/customer/profile", {
        method: "PATCH",
        body: JSON.stringify({ name: trimmedName }),
      })) as CustomerProfile;

      setProfile(updated);
      setName(updated.name ?? "");
      setSuccess("Your profile has been updated.");
    } catch {
      setError("Unable to update your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePhotoUpload() {
  if (!selectedPhoto) {
    setPhotoError("Please select an image first.");
    return;
  }

  setUploadingPhoto(true);
  setPhotoError("");
  setPhotoSuccess("");

  try {
    const formData = new FormData();
    formData.append("file", selectedPhoto);

    const updated = (await apiRequest("/customer/profile/photo", {
      method: "POST",
      body: formData,
    })) as CustomerProfile;

    setProfile(updated);
    setSelectedPhoto(null);
    setPhotoPreview(null);
    setPhotoSuccess("Profile photo updated successfully.");
  } catch {
    setPhotoError("Unable to upload the photo. Please try again.");
  } finally {
    setUploadingPhoto(false);
  }
}

  if (loading) {
    return (
      <div className="p-6 text-sm text-slate-400">
        Loading profile...
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <p className="text-sm text-red-400">{error}</p>
        <button
          type="button"
          onClick={() => router.push("/login")}
          className="mt-4 rounded-lg bg-amber-500 px-4 py-2 font-medium text-slate-950 hover:bg-amber-400"
        >
          Go to login
        </button>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">
          Profile Settings
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Manage your personal account information.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-700 bg-slate-800 text-2xl font-semibold text-amber-400">
            {photoPreview || profile.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={
                  photoPreview ||
                  `${process.env.NEXT_PUBLIC_API_URL}${profile.photo_url}`
                }
                alt="Profile preview"
                className="h-full w-full object-cover"
              />
            ) : (
              (profile.name?.trim().charAt(0) || profile.email.charAt(0))
                .toUpperCase()
            )}
          </div>

          <div className="flex-1">
            <h2 className="font-medium text-white">
              {profile.name || "Customer"}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {profile.email}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className="cursor-pointer rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 transition hover:border-amber-400">
                Choose photo
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(event) =>
                    handlePhotoChange(event.target.files?.[0])
                  }
                />
              </label>

              <button
                type="button"
                onClick={handlePhotoUpload}
                disabled={!selectedPhoto || uploadingPhoto}
                className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {uploadingPhoto ? "Uploading..." : "Upload photo"}
              </button>
            </div>

            <p className="mt-2 text-xs text-slate-500">
              JPEG, PNG, or WebP. Maximum size: 2 MB.
            </p>

            {photoError && (
              <p role="alert" className="mt-2 text-sm text-red-400">
                {photoError}
              </p>
            )}

            {photoSuccess && (
              <p role="status" className="mt-2 text-sm text-emerald-400">
                {photoSuccess}
              </p>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="profile-name"
              className="mb-2 block text-sm font-medium text-slate-300"
            >
              Full name
            </label>
            <input
              id="profile-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={100}
              required
              autoComplete="name"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
              placeholder="Enter your full name"
            />
          </div>

          <div>
            <label
              htmlFor="profile-email"
              className="mb-2 block text-sm font-medium text-slate-300"
            >
              Email address
            </label>
            <input
              id="profile-email"
              type="email"
              value={profile.email}
              readOnly
              className="w-full cursor-not-allowed rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-3 text-slate-400"
            />
            <p className="mt-2 text-xs text-slate-500">
              Email changes will require an email verification flow.
            </p>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-slate-300">
              Email verification
            </p>
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                profile.email_verified
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-amber-500/10 text-amber-400"
              }`}
            >
              {profile.email_verified
                ? "Verified"
                : "Not verified"}
            </span>
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-400">
              {error}
            </p>
          )}

          {success && (
            <p role="status" className="text-sm text-emerald-400">
              {success}
            </p>
          )}

          <div className="flex justify-end border-t border-slate-800 pt-5">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-amber-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
