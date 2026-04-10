"use client";

import { usePathname } from "next/navigation";
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

  return (
    <SidebarProvider>
      <RightSidebarProvider>
        {!isBookingPage && <Sidebar />}
        {children}
      </RightSidebarProvider>
    </SidebarProvider>
  );
}
