"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

const SIDEBAR_STATE_KEY = "sidebar_collapsed";

type SidebarContextType = {
  isCollapsed: boolean;
  toggleCollapse: () => void;
};

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(SIDEBAR_STATE_KEY);
      setIsCollapsed(saved === "true");
    }
  }, []);

  const toggleCollapse = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    if (typeof window !== "undefined") {
      localStorage.setItem(SIDEBAR_STATE_KEY, String(newState));
    }
  };

  return (
    <SidebarContext.Provider value={{ isCollapsed, toggleCollapse }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  // Return default values if context is not available (for pages that don't need sidebar)
  if (context === undefined) {
    return { isCollapsed: false, toggleCollapse: () => {} };
  }
  return context;
}

