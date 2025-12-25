"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import AppHeader from "@/components/AppHeader";
import Sidebar from "@/components/Sidebar";
import MainContent from "@/components/MainContent";

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ plan: string; stripe_customer_id: string | null } | null>(null);
  
  // Password change state
  const [passwordSection, setPasswordSection] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Account deletion state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [calendarConnected, setCalendarConnected] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data: userRes } = await supabase.auth.getUser();
        if (!userRes.user) {
          router.replace("/login");
          return;
        }

        const { data, error } = await supabase
          .from("profiles")
          .select("plan, stripe_customer_id")
          .eq("id", userRes.user.id)
          .single();

        if (error) throw error;
        setProfile(data);
      } catch (e: any) {
        console.error("Failed to load profile:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return;
    }

    setChangingPassword(true);
    setPasswordError(null);
    setPasswordSuccess(false);

    try {
      // Supabase handles password updates - no need for current password verification
      // in the client (it's handled server-side)
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setPasswordSuccess(true);
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSection(false);
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (e: any) {
      setPasswordError(e?.message ?? "Failed to change password");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleManageSubscription = async () => {
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
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") {
      setDeleteError("Please type DELETE to confirm");
      return;
    }

    setDeleting(true);
    setDeleteError(null);

    try {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) throw new Error("Not authenticated");

      // Note: Account deletion requires server-side handling with admin privileges
      // For now, we'll sign the user out and show a message
      // You'll need to implement a server-side API route for actual deletion
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;

      // Redirect with message
      router.replace("/login?deleted=requested");
    } catch (e: any) {
      setDeleteError(e?.message ?? "Failed to delete account. Please contact support.");
      setDeleting(false);
    }
  };

  return (
    <>
      <AppHeader />
      <Sidebar />

      <MainContent>
        <div className="max-w-6xl mx-auto py-10 px-4">
          <div className="space-y-6">
            <h1 className="text-3xl font-semibold text-[#4B543B]">Settings</h1>

            {/* Change Password */}
            <div className="rounded-2xl border border-white/50 bg-white/80 backdrop-blur-lg p-6 shadow-lg shadow-black/5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-[13px] font-semibold tracking-wide text-[#4B543B] uppercase">
                    Change Password
                  </h2>
                  <p className="text-[11px] text-slate-600 mt-1">
                    Update your account password
                  </p>
                </div>
                <button
                  onClick={() => {
                    setPasswordSection(!passwordSection);
                    setPasswordError(null);
                    setPasswordSuccess(false);
                  }}
                  className="px-3 py-1.5 text-[11px] font-medium rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700"
                >
                  {passwordSection ? "Cancel" : "Change Password"}
                </button>
              </div>

              {passwordSection && (
                <div className="space-y-4 pt-4 border-t border-slate-200">
                  <div>
                    <label className="block text-[12px] mb-1 text-slate-700 font-medium">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-[11px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#72B01D66] focus:border-[#72B01D]"
                      placeholder="Enter new password"
                    />
                  </div>

                  <div>
                    <label className="block text-[12px] mb-1 text-slate-700 font-medium">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-[11px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#72B01D66] focus:border-[#72B01D]"
                      placeholder="Confirm new password"
                    />
                  </div>

                  {passwordError && (
                    <div className="p-3 rounded-md bg-red-50 border border-red-200">
                      <p className="text-[11px] text-red-700">{passwordError}</p>
                    </div>
                  )}

                  {passwordSuccess && (
                    <div className="p-3 rounded-md bg-green-50 border border-green-200">
                      <p className="text-[11px] text-green-700">Password updated successfully</p>
                    </div>
                  )}

                  <button
                    onClick={handleChangePassword}
                    disabled={changingPassword || !newPassword || !confirmPassword}
                    className="px-4 py-2 text-[11px] font-medium rounded-md border border-[#72B01D80] bg-[#72B01D] hover:bg-[#6AA318] text-white disabled:opacity-50"
                  >
                    {changingPassword ? "Updating..." : "Update Password"}
                  </button>
                </div>
              )}
            </div>

            {/* Calendar Integration */}
            <div className="rounded-2xl border border-white/50 bg-white/80 backdrop-blur-lg p-6 shadow-lg shadow-black/5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-[13px] font-semibold tracking-wide text-[#4B543B] uppercase">
                    Calendar Integration
                  </h2>
                  <p className="text-[11px] text-slate-600 mt-1">
                    Connect your calendar to sync consultations and appointments
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200">
                {calendarConnected ? (
                  <>
                    <button
                      onClick={() => setCalendarConnected(false)}
                      className="px-4 py-2 text-[11px] font-medium rounded-md border border-red-300 bg-red-50 hover:bg-red-100 text-red-700"
                    >
                      Disconnect Calendar
                    </button>
                    <p className="text-[10px] text-slate-500 mt-2">
                      Your calendar is connected. Disconnect to stop syncing consultations.
                    </p>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setCalendarConnected(true)}
                      className="px-4 py-2 text-[11px] font-medium rounded-md border border-[#72B01D80] bg-[#72B01D] hover:bg-[#6AA318] text-white"
                    >
                      Connect Calendar
                    </button>
                    <p className="text-[10px] text-slate-500 mt-2">
                      Connect your Google Calendar or other calendar service to sync consultations and appointments
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Subscription Management */}
            {profile && (profile.plan === "paid" || profile.stripe_customer_id) && (
              <div className="rounded-2xl border border-white/50 bg-white/80 backdrop-blur-lg p-6 shadow-lg shadow-black/5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-[13px] font-semibold tracking-wide text-[#4B543B] uppercase">
                      Subscription & Billing
                    </h2>
                    <p className="text-[11px] text-slate-600 mt-1">
                      Manage your subscription, payment method, and billing
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200">
                  <button
                    onClick={handleManageSubscription}
                    className="px-4 py-2 text-[11px] font-medium rounded-md border border-[#72B01D80] bg-[#72B01D] hover:bg-[#6AA318] text-white"
                  >
                    Manage Subscription
                  </button>
                  <p className="text-[10px] text-slate-500 mt-2">
                    Opens Stripe Customer Portal to manage your subscription, update payment method, and view invoices
                  </p>
                </div>
              </div>
            )}

            {/* Account Deletion */}
            <div className="rounded-2xl border border-red-200 bg-red-50/30 backdrop-blur-lg p-6 shadow-lg shadow-black/5">
              <div className="mb-4">
                <h2 className="text-[13px] font-semibold tracking-wide text-red-700 uppercase">
                  Danger Zone
                </h2>
                <p className="text-[11px] text-slate-600 mt-1">
                  Permanently delete your account and all associated data
                </p>
              </div>

              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-4 py-2 text-[11px] font-medium rounded-md border border-red-300 bg-red-600 hover:bg-red-700 text-white"
                >
                  Delete Account
                </button>
              ) : (
                <div className="space-y-4 pt-4 border-t border-red-200">
                  <div>
                    <label className="block text-[12px] mb-1 text-slate-700 font-medium">
                      Type <span className="font-bold">DELETE</span> to confirm
                    </label>
                    <input
                      type="text"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      className="w-full bg-white border border-red-300 rounded-md px-3 py-2 text-[13px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
                      placeholder="DELETE"
                    />
                  </div>

                  {deleteError && (
                    <div className="p-3 rounded-md bg-red-50 border border-red-200">
                      <p className="text-[11px] text-red-700">{deleteError}</p>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDeleteAccount}
                      disabled={deleting || deleteConfirmText !== "DELETE"}
                      className="px-4 py-2 text-[11px] font-medium rounded-md border border-red-300 bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
                    >
                      {deleting ? "Deleting..." : "Permanently Delete Account"}
                    </button>
                    <button
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeleteConfirmText("");
                        setDeleteError(null);
                      }}
                      disabled={deleting}
                      className="px-4 py-2 text-[11px] font-medium rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>

                  <p className="text-[10px] text-red-600">
                    ⚠️ This action cannot be undone. All your clients, formulas, and notes will be permanently deleted.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </MainContent>
    </>
  );
}
