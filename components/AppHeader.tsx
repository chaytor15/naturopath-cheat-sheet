"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [profileData, setProfileData] = useState<{
    company_name: string | null;
    full_name: string | null;
    email: string | null;
    profile_picture: string | null;
  } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sync = async () => {
      const { data } = await supabase.auth.getSession();
      setHasSession(!!data.session);
      if (data.session?.user) {
        setUserEmail(data.session.user.email || null);
        
        // Load profile data for display
        const { data: profile } = await supabase
          .from("profiles")
          .select("company_name, full_name, email, profile_picture")
          .eq("id", data.session.user.id)
          .single();
        
        if (profile) {
          setProfileData(profile);
        }
      } else {
        setProfileData(null);
      }
    };

    sync();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      sync();
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  // Determine what to display (priority: company_name > full_name > email)
  const displayName = profileData?.company_name || profileData?.full_name || userEmail || "User";
  
  // Get first letter for initial
  const displayInitial = displayName.charAt(0).toUpperCase();

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };

    if (userMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [userMenuOpen]);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      alert(error.message);
      return;
    }

    try {
      for (const k of Object.keys(localStorage)) {
        if (k.startsWith("sb-") && k.endsWith("-auth-token")) localStorage.removeItem(k);
      }
      for (const k of Object.keys(sessionStorage)) {
        if (k.startsWith("sb-") && k.endsWith("-auth-token")) sessionStorage.removeItem(k);
      }
    } catch {}

    router.replace("/login");
    router.refresh();
  };

  return (
    <header className="fixed top-0 inset-x-0 z-40 h-[60px] bg-white/40 backdrop-blur-md border-b border-white/60 shadow-sm">
      <div className="h-full px-4 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-xl bg-[#142200] flex items-center justify-center text-white text-xs font-semibold shadow-sm">
            t
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-tight text-[#2E332B]">
              tonic.
            </span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-[#7D8472]">
              Herbal workspace
            </span>
          </div>
        </Link>

        {/* User Menu */}
        <div className="relative" ref={menuRef}>
          {hasSession ? (
            <>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-black/5 transition-colors"
              >
                {profileData?.profile_picture ? (
                  <img
                    src={profileData.profile_picture}
                    alt="Profile"
                    className="h-8 w-8 rounded-full object-cover border border-slate-200"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-[#2E332B] flex items-center justify-center text-white text-xs font-semibold">
                    {displayInitial}
                  </div>
                )}
                <span className="text-[12px] text-[#4B543B] hidden sm:block">
                  {displayName}
                </span>
                <svg
                  className={`w-4 h-4 text-[#4B543B] transition-transform ${userMenuOpen ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg border border-white/60 shadow-lg py-1 z-50">
                  <Link
                    href="/profile"
                    onClick={() => setUserMenuOpen(false)}
                    className={`flex items-center gap-2 px-4 py-2 text-[12px] text-[#4B543B] hover:bg-black/5 transition-colors ${
                      pathname === "/profile" ? "bg-black/5" : ""
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Profile
                  </Link>
                  <Link
                    href="/settings"
                    onClick={() => setUserMenuOpen(false)}
                    className={`flex items-center gap-2 px-4 py-2 text-[12px] text-[#4B543B] hover:bg-black/5 transition-colors ${
                      pathname === "/settings" ? "bg-black/5" : ""
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Settings
                  </Link>
                  <div className="border-t border-white/60 my-1" />
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-2 px-4 py-2 text-[12px] text-[#4B543B] hover:bg-black/5 transition-colors text-left"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign out
                  </button>
                </div>
              )}
            </>
          ) : (
            // Only show "Sign in" button if not on login/signup/forgot pages
            pathname !== "/login" && pathname !== "/signup" && pathname !== "/forgot" && (
              <Link
                href="/login"
                className="px-3 py-2 text-[11px] font-semibold rounded-lg border border-[#72B01D80] bg-[#72B01D] hover:bg-[#6AA318] text-white tracking-[0.08em] uppercase"
              >
                Sign in
              </Link>
            )
          )}
        </div>
      </div>
    </header>
  );
}

