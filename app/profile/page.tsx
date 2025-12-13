"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  plan: "free" | "lifetime" | "paid";
  trial_ends_at: string | null;
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

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
          .select("id, full_name, email, plan, trial_ends_at")
          .eq("id", userRes.user.id)
          .single();

        if (error) throw error;
        setProfile(data as Profile);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load profile");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Profile</h1>
        <Link href="/app" className="text-sm underline opacity-80 hover:opacity-100">
          Back to Workspace
        </Link>
      </div>

      <div className="rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-lg">
        {loading ? (
          <p className="opacity-80">Loading…</p>
        ) : err ? (
          <p className="text-red-400">{err}</p>
        ) : profile ? (
          <div className="space-y-3 text-sm">
            <div>
              <div className="opacity-70">Email</div>
              <div>{profile.email ?? "-"}</div>
            </div>

            <div>
              <div className="opacity-70">Full name</div>
              <div>{profile.full_name ?? "-"}</div>
            </div>

            <div>
              <div className="opacity-70">Plan</div>
              <div className="inline-flex items-center gap-2">
                <span className="rounded-full border border-white/20 px-3 py-1">
                  {profile.plan}
                </span>
                {profile.plan === "free" && (
                  <span className="opacity-70">
                    Free access: Digestion + Liver conditions only
                  </span>
                )}
              </div>
            </div>

            {profile.trial_ends_at && (
              <div>
                <div className="opacity-70">Trial ends</div>
                <div>{new Date(profile.trial_ends_at).toLocaleString()}</div>
              </div>
            )}
          </div>
        ) : (
          <p className="opacity-80">No profile found.</p>
        )}
      </div>
    </div>
  );
}
