"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/login?mode=signup");
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#F7F8F3]">
      <p className="text-sm text-slate-600">Redirecting…</p>
    </main>
  );
}
