"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import AppHeader from "@/components/AppHeader";
import Sidebar from "@/components/Sidebar";
import MainContent from "@/components/MainContent";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  company_name: string | null;
  phone: string | null;
  profile_picture: string | null;
  plan: "free" | "lifetime" | "paid";
  trial_ends_at: string | null;
  stripe_customer_id: string | null;
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editCompanyName, setEditCompanyName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data: userRes } = await supabase.auth.getUser();
        if (!userRes.user) {
          window.location.href = "/login";
          return;
        }

        const { data, error } = await supabase
          .from("profiles")
          .select("id, full_name, email, company_name, phone, profile_picture, plan, trial_ends_at, stripe_customer_id")
          .eq("id", userRes.user.id)
          .single();

        if (error) throw error;
        setProfile(data as Profile);
        setEditName(data.full_name || "");
        setEditEmail(data.email || "");
        setEditCompanyName(data.company_name || "");
        setEditPhone(data.phone || "");
        setProfilePicture(data.profile_picture || null);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load profile");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    if (!profile) return;

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) throw new Error("Not authenticated");

      // Update email in auth (requires re-authentication for security)
      if (editEmail !== profile.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: editEmail.trim(),
        });
        if (emailError) throw emailError;
      }

      // Update profile in database
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: editName.trim() || null,
          email: editEmail.trim() || null,
          company_name: editCompanyName.trim() || null,
          phone: editPhone.trim() || null,
        })
        .eq("id", profile.id);

      if (profileError) throw profileError;

      // Update local state
      setProfile({
        ...profile,
        full_name: editName.trim() || null,
        email: editEmail.trim() || null,
        company_name: editCompanyName.trim() || null,
        phone: editPhone.trim() || null,
      });

      setSaveSuccess(true);
      setIsEditing(false);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e: any) {
      setSaveError(e?.message ?? "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (profile) {
      setEditName(profile.full_name || "");
      setEditEmail(profile.email || "");
      setEditCompanyName(profile.company_name || "");
      setEditPhone(profile.phone || "");
    }
    setIsEditing(false);
    setSaveError(null);
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !profile) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setSaveError("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setSaveError("Image must be less than 5MB");
      return;
    }

    setUploadingImage(true);
    setSaveError(null);

    try {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) throw new Error("Not authenticated");

      const fileExt = file.name.split('.').pop();
      const fileName = `${userRes.user.id}/${Date.now()}.${fileExt}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('profile-pictures')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        if (uploadError.message?.includes('not found') || uploadError.message?.includes('Bucket')) {
          // Try one more time to create the bucket
          try {
            const createRes = await fetch('/api/storage/create-bucket', {
              method: 'POST',
            });
            const createData = await createRes.json();
            
            if (createRes.ok) {
              // Retry the upload after bucket creation
              const { data: retryUpload, error: retryError } = await supabase.storage
                .from('profile-pictures')
                .upload(fileName, file, {
                  cacheControl: '3600',
                  upsert: true
                });
              
              if (retryError) throw retryError;
              // Continue with getting the URL
              const { data: urlData } = supabase.storage
                .from('profile-pictures')
                .getPublicUrl(fileName);
              const imageUrl = urlData.publicUrl;
              
              const { error: updateError } = await supabase
                .from("profiles")
                .update({ profile_picture: imageUrl })
                .eq("id", profile.id);
              
              if (updateError) throw updateError;
              
              setProfilePicture(imageUrl);
              setProfile({ ...profile, profile_picture: imageUrl });
              setSaveSuccess(true);
              setTimeout(() => setSaveSuccess(false), 3000);
              setUploadingImage(false);
              return;
            }
          } catch (retryErr) {
            // Fall through to show error
          }
          
          throw new Error(
            "Storage bucket 'profile-pictures' not found. " +
            "Please create it manually: Go to Supabase Dashboard → Storage → New bucket → " +
            "Name: 'profile-pictures' → Set to Public → Save"
          );
        }
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('profile-pictures')
        .getPublicUrl(fileName);

      const imageUrl = urlData.publicUrl;

      // Update profile with image URL
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ profile_picture: imageUrl })
        .eq("id", profile.id);

      if (updateError) throw updateError;

      setProfilePicture(imageUrl);
      setProfile({ ...profile, profile_picture: imageUrl });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e: any) {
      setSaveError(e?.message ?? "Failed to upload image");
    } finally {
      setUploadingImage(false);
      // Allow re-selecting the same file again
      try {
        event.target.value = "";
      } catch {}
    }
  };

  const handleRemoveImage = async () => {
    if (!profile || !profilePicture) return;

    setUploadingImage(true);
    setSaveError(null);

    try {
      // Extract file path from URL
      const urlParts = profilePicture.split('/');
      const fileName = urlParts[urlParts.length - 1];
      const filePath = `${profile.id}/${fileName}`;

      // Delete from storage
      const { error: deleteError } = await supabase.storage
        .from('profile-pictures')
        .remove([filePath]);

      // Update profile (even if delete fails, we still want to remove the reference)
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ profile_picture: null })
        .eq("id", profile.id);

      if (updateError) throw updateError;

      setProfilePicture(null);
      setProfile({ ...profile, profile_picture: null });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e: any) {
      setSaveError(e?.message ?? "Failed to remove image");
    } finally {
      setUploadingImage(false);
    }
  };

  return (
    <>
      <AppHeader />
      <Sidebar />

      <MainContent>
        <div className="max-w-6xl mx-auto py-10 px-4">
          <div className="space-y-6">
            <h1 className="text-3xl font-semibold text-[#4B543B]">Profile</h1>

            <div className="rounded-2xl border border-white/50 bg-white/80 backdrop-blur-lg p-6 shadow-lg shadow-black/5">
              {loading ? (
                <p className="opacity-80">Loading…</p>
              ) : err ? (
                <p className="text-red-400">{err}</p>
              ) : profile ? (
                <div className="space-y-6">
                  {/* Profile Picture - Always Available */}
                  <div>
                    <h2 className="text-[13px] font-semibold tracking-wide text-[#4B543B] uppercase mb-4">
                      Profile Picture / Logo
                    </h2>
                    <div className="flex items-center gap-4">
                      {profilePicture ? (
                        <div className="relative">
                          <img
                            src={profilePicture}
                            alt="Profile"
                            className="h-20 w-20 rounded-full object-cover border-2 border-slate-200"
                          />
                          <button
                            onClick={handleRemoveImage}
                            disabled={uploadingImage}
                            className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center hover:bg-red-600 disabled:opacity-50"
                            title="Remove image"
                          >
                            ×
                          </button>
                        </div>
                      ) : (
                        <div className="h-20 w-20 rounded-full bg-[#2E332B] flex items-center justify-center text-white text-2xl font-semibold">
                          {profile.company_name ? profile.company_name.charAt(0).toUpperCase() : 
                           profile.full_name ? profile.full_name.charAt(0).toUpperCase() : 
                           profile.email ? profile.email.charAt(0).toUpperCase() : "U"}
                        </div>
                      )}
                      <div className="flex-1">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          disabled={uploadingImage}
                          className="hidden"
                          id="profile-picture-upload"
                        />
                        <label
                          htmlFor="profile-picture-upload"
                          className="inline-block px-4 py-2 text-[11px] font-medium rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer disabled:opacity-50"
                        >
                          {uploadingImage ? "Uploading..." : profilePicture ? "Change Picture" : "Upload Picture"}
                        </label>
                        <p className="mt-1 text-[10px] text-slate-500">
                          JPG, PNG or GIF. Max 5MB
                        </p>
                        {saveError && (
                          <div className="mt-2 p-2 rounded-md bg-red-50 border border-red-200">
                            <p className="text-[10px] text-red-700">{saveError}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Personal Information */}
                  <div className="border-t border-slate-200 pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-[13px] font-semibold tracking-wide text-[#4B543B] uppercase">
                        Personal Information
                      </h2>
                      {!isEditing && (
                        <button
                          onClick={() => setIsEditing(true)}
                          className="px-3 py-1.5 text-[11px] font-medium rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700"
                        >
                          Edit
                        </button>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-[10px] mb-1 text-slate-700 font-medium">
                            Company Name
                          </label>
                          <input
                            type="text"
                            value={editCompanyName}
                            onChange={(e) => setEditCompanyName(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-[13px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#72B01D66] focus:border-[#72B01D]"
                            placeholder="Enter your company name"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] mb-1 text-slate-700 font-medium">
                            Full Name
                          </label>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-[13px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#72B01D66] focus:border-[#72B01D]"
                            placeholder="Enter your full name"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] mb-1 text-slate-700 font-medium">
                            Email
                          </label>
                          <input
                            type="email"
                            value={editEmail}
                            onChange={(e) => setEditEmail(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-[13px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#72B01D66] focus:border-[#72B01D]"
                            placeholder="Enter your email"
                          />
                          <p className="mt-1 text-[10px] text-slate-500">
                            Changing your email will require verification
                          </p>
                        </div>

                        <div>
                          <label className="block text-[10px] mb-1 text-slate-700 font-medium">
                            Phone Number
                          </label>
                          <input
                            type="tel"
                            value={editPhone}
                            onChange={(e) => setEditPhone(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-[13px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#72B01D66] focus:border-[#72B01D]"
                            placeholder="Enter your phone number"
                          />
                        </div>

                        {saveError && (
                          <div className="p-3 rounded-md bg-red-50 border border-red-200">
                            <p className="text-[11px] text-red-700">{saveError}</p>
                          </div>
                        )}

                        {saveSuccess && (
                          <div className="p-3 rounded-md bg-green-50 border border-green-200">
                            <p className="text-[11px] text-green-700">Profile updated successfully</p>
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-4 py-2 text-[11px] font-medium rounded-md border border-[#72B01D80] bg-[#72B01D] hover:bg-[#6AA318] text-white disabled:opacity-50"
                          >
                            {saving ? "Saving..." : "Save Changes"}
                          </button>
                          <button
                            onClick={handleCancel}
                            disabled={saving}
                            className="px-4 py-2 text-[11px] font-medium rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3 text-sm">
                        <div>
                          <div className="opacity-70 text-[11px] mb-1">Company Name</div>
                          <div className="text-[13px]">{profile.company_name || "-"}</div>
                        </div>
                        <div>
                          <div className="opacity-70 text-[11px] mb-1">Full Name</div>
                          <div className="text-[13px]">{profile.full_name || "-"}</div>
                        </div>
                        <div>
                          <div className="opacity-70 text-[11px] mb-1">Email</div>
                          <div className="text-[13px]">{profile.email || "-"}</div>
                        </div>
                        <div>
                          <div className="opacity-70 text-[11px] mb-1">Phone Number</div>
                          <div className="text-[13px]">{profile.phone || "-"}</div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Subscription Info */}
                  <div className="border-t border-slate-200 pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-[13px] font-semibold tracking-wide text-[#4B543B] uppercase">
                        Subscription
                      </h2>
                      {(profile.plan === "paid" || profile.stripe_customer_id) && (
                        <button
                          onClick={async () => {
                            try {
                              const res = await fetch("/api/stripe/portal", { method: "POST" });
                              const data = await res.json();
                              if (!res.ok) {
                                alert(data?.error ?? "Failed to open customer portal");
                                return;
                              }
                              if (data?.url) {
                                window.location.href = data.url;
                              }
                            } catch (e: any) {
                              alert(e?.message ?? "Failed to open customer portal");
                            }
                          }}
                          className="px-3 py-1.5 text-[11px] font-medium rounded-md border border-[#72B01D80] bg-[#72B01D] hover:bg-[#6AA318] text-white"
                        >
                          Manage Subscription
                        </button>
                      )}
                    </div>
                    <div className="space-y-4">
                      <div>
                        <div className="opacity-70 text-[11px] mb-1">Plan</div>
                        <div className="inline-flex items-center gap-2">
                          <span className="rounded-full border border-white/20 px-3 py-1 text-[11px] font-medium">
                            {profile.plan === "paid" ? "Paid" : profile.plan === "lifetime" ? "Lifetime" : "Free"}
                          </span>
                          {profile.plan === "free" && (
                            <span className="opacity-70 text-[11px]">
                              Free access: Digestion + Liver conditions only
                            </span>
                          )}
                          {(profile.plan === "paid" || profile.plan === "lifetime") && (
                            <span className="opacity-70 text-[11px]">
                              Full access to all conditions and features
                            </span>
                          )}
                        </div>
                      </div>

                      {profile.trial_ends_at && (
                        <div>
                          <div className="opacity-70 text-[11px] mb-1">Trial ends</div>
                          <div className="text-[13px]">
                            {new Date(profile.trial_ends_at).toLocaleString()}
                          </div>
                        </div>
                      )}

                      {profile.plan === "free" && (
                        <div className="pt-2">
                          <Link
                            href="/app/upgrade"
                            className="inline-block px-4 py-2 text-[11px] font-medium rounded-md border border-[#72B01D80] bg-[#72B01D] hover:bg-[#6AA318] text-white"
                          >
                            Upgrade to Paid
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="opacity-80">No profile found.</p>
              )}
            </div>
          </div>
        </div>
      </MainContent>
    </>
  );
}
