"use client";

import { SidebarProvider } from "@/contexts/SidebarContext";
import Sidebar from "@/components/Sidebar";

export default function SidebarProviderWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <Sidebar />
      {children}
    </SidebarProvider>
  );
}
