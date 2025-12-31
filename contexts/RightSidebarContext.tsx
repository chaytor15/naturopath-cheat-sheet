"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

const RIGHT_SIDEBAR_STATE_KEY = "right_sidebar_collapsed";

type RightSidebarContextType = {
  isCollapsed: boolean;
  toggleCollapse: () => void;
};

const RightSidebarContext = createContext<RightSidebarContextType | undefined>(undefined);

export function RightSidebarProvider({ children }: { children: ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(true); // Default to collapsed

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem(RIGHT_SIDEBAR_STATE_KEY);
      // If there's a saved state, use it; otherwise default to collapsed
      if (saved !== null) {
        setIsCollapsed(saved === "true");
      }
    }
  }, []);

  const toggleCollapse = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(RIGHT_SIDEBAR_STATE_KEY, String(newState));
    }
  };

  return (
    <RightSidebarContext.Provider value={{ isCollapsed, toggleCollapse }}>
      {children}
    </RightSidebarContext.Provider>
  );
}

export function useRightSidebar() {
  const context = useContext(RightSidebarContext);
  // Return default values if context is not available (for pages that don't need sidebar)
  if (context === undefined) {
    return { isCollapsed: true, toggleCollapse: () => {} };
  }
  return context;
}















