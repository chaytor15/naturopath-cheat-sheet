"use client";

import { SidebarProvider } from "@/contexts/SidebarContext";
import { RightSidebarProvider } from "@/contexts/RightSidebarContext";
import Sidebar from "@/components/Sidebar";

export default function SidebarProviderWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <RightSidebarProvider>
        <Sidebar />
        {children}
      </RightSidebarProvider>
    </SidebarProvider>
  );
}
