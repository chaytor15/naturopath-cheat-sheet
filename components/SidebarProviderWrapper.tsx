"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { RightSidebarProvider } from "@/contexts/RightSidebarContext";
import Sidebar from "@/components/Sidebar";

export default function SidebarProviderWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isBookingPage = pathname?.startsWith("/book");
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const sidebarVisible = hasSession === true && !isBookingPage;

  return (
    <SidebarProvider sidebarVisible={sidebarVisible}>
      <RightSidebarProvider>
        {sidebarVisible && <Sidebar />}
        {children}
      </RightSidebarProvider>
    </SidebarProvider>
  );
}
