"use client";

import { usePathname } from "next/navigation";
import { useRightSidebar } from "@/contexts/RightSidebarContext";
import RightSidebar from "@/components/RightSidebar";

// Pages that should NOT have the right sidebar
const EXCLUDED_PATHS = [
  "/",
  "/login",
  "/signup",
  "/forgot",
  "/pricing",
  "/landingpage",
  "/auth/callback",
  "/auth/reset",
];

type RightSidebarWrapperProps = {
  totalClients?: number;
  activeClients?: number;
  recentActivity?: Array<{
    id: string;
    type: "note" | "formula" | "client";
    title: string;
    date: string;
    clientName?: string;
  }>;
  onCreateClient?: () => void;
  onCreateTonic?: () => void;
  onCreateConsultation?: () => void;
};

export default function RightSidebarWrapper({
  totalClients = 0,
  activeClients = 0,
  recentActivity = [],
  onCreateClient,
  onCreateTonic,
  onCreateConsultation,
}: RightSidebarWrapperProps) {
  const pathname = usePathname();
  const rightSidebarContext = useRightSidebar();
  
  // Extract values with fallbacks
  const isCollapsed = rightSidebarContext?.isCollapsed ?? true;
  const toggleCollapse = rightSidebarContext?.toggleCollapse ?? (() => {});

  // Don't render on excluded paths
  const isExcluded = EXCLUDED_PATHS.some((path) => {
    // Exact match
    if (pathname === path) return true;
    // For /auth paths, match sub-paths
    if (path === "/auth" && pathname.startsWith("/auth")) return true;
    return false;
  });

  // Debug: log pathname and exclusion status (remove after testing)
  // console.log("RightSidebarWrapper - pathname:", pathname, "isExcluded:", isExcluded);

  if (isExcluded) {
    return null;
  }

  // Always render - even when collapsed, it should show a 70px bar
  return (
    <RightSidebar
      isCollapsed={isCollapsed}
      onToggleCollapse={toggleCollapse}
      totalClients={totalClients}
      activeClients={activeClients}
      recentActivity={recentActivity}
      onCreateClient={onCreateClient}
      onCreateTonic={onCreateTonic}
      onCreateConsultation={onCreateConsultation}
    />
  );
}

