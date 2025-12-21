"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import AppHeader from "@/components/AppHeader";
import Sidebar from "@/components/Sidebar";
import MainContent from "@/components/MainContent";

export default function AppointmentTypesPage() {
  const router = useRouter();

  // Auth check
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/login");
      }
    });
  }, [router]);

  return (
    <>
      <AppHeader />
      <Sidebar />
      <MainContent>
        <div className="p-6">
          <h1 className="text-2xl font-semibold text-[#4B543B] mb-4">Appointment Types</h1>
          <p className="text-slate-600">Appointment Types page coming soon...</p>
        </div>
      </MainContent>
    </>
  );
}

