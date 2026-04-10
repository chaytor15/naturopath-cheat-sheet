"use client";

import { useSidebar } from "@/contexts/SidebarContext";

export default function MainContent({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { isCollapsed, sidebarVisible } = useSidebar();
  const leftPad = sidebarVisible
    ? isCollapsed
      ? "pl-[70px]"
      : "pl-[240px]"
    : "pl-0";

  return (
    <main
      className={`min-h-screen bg-[#F7F8F3] text-slate-900 pt-[60px] transition-all duration-300 ${leftPad} ${className}`}
    >
      {children}
    </main>
  );
}






