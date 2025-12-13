"use client";

import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/lib/supabaseClient";

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8 bg-[#F7F8F3]">
      <div className="w-full max-w-md rounded-2xl border border-white/60 bg-white/80 backdrop-blur-lg p-6 shadow-lg shadow-black/5">
        <h1 className="text-2xl font-semibold mb-2 text-slate-900">
          Set a new password
        </h1>
        <p className="text-sm text-slate-600 mb-4">
          Set your new password below.
        </p>

        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          view="update_password"
        />
      </div>
    </main>
  );
}
