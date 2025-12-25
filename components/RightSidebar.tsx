"use client";

import { useRouter } from "next/navigation";

type RightSidebarProps = {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  totalClients: number;
  activeClients: number;
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

export default function RightSidebar({
  isCollapsed,
  onToggleCollapse,
  totalClients,
  activeClients,
  recentActivity = [],
  onCreateClient,
  onCreateTonic,
  onCreateConsultation,
}: RightSidebarProps) {
  const router = useRouter();

  const handleCreateConsultation = () => {
    if (onCreateConsultation) return onCreateConsultation();
    router.push("/consultations");
  };

  if (isCollapsed) {
    return (
      <aside className="fixed right-0 top-[60px] bottom-0 z-30 bg-white/80 backdrop-blur-lg border-l border-white/60 shadow-sm transition-all duration-300 w-[70px]">
        <div className="flex flex-col h-full">
          {/* Toggle Button */}
          <div className="p-4 border-b border-white/60 flex items-center justify-start">
            <button
              onClick={onToggleCollapse}
              className="p-2 rounded-lg hover:bg-black/5 transition-colors text-[#4B543B]"
              aria-label="Expand sidebar"
            >
              <svg
                className="w-4 h-4 transition-transform duration-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="fixed right-0 top-[60px] bottom-0 z-30 bg-white/80 backdrop-blur-lg border-l border-white/60 shadow-sm transition-all duration-300 w-[280px]">
      <div className="flex flex-col h-full">
        {/* Toggle Button */}
        <div className="p-4 border-b border-white/60 flex items-center justify-end">
          <button
            onClick={onToggleCollapse}
            className="p-2 rounded-lg hover:bg-black/5 transition-colors text-[#4B543B]"
            aria-label="Collapse sidebar"
          >
            <svg
              className="w-4 h-4 transition-transform duration-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto stable-scroll [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-slate-400">
          <div className="p-4 space-y-6">
            {/* Quick Stats */}
            <div>
              <h3 className="text-[11px] font-semibold text-[#4B543B] uppercase tracking-wide mb-3">
                Quick Stats
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/50">
                  <span className="text-[12px] text-slate-600">Total Clients</span>
                  <span className="text-[13px] font-semibold text-[#4B543B]">{totalClients}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/50">
                  <span className="text-[12px] text-slate-600">Active Clients</span>
                  <span className="text-[13px] font-semibold text-[#72B01D]">{activeClients}</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div>
              <h3 className="text-[11px] font-semibold text-[#4B543B] uppercase tracking-wide mb-3">
                Quick Actions
              </h3>
              <div className="space-y-2">
                {onCreateClient && (
                  <button
                    onClick={onCreateClient}
                    className="w-full text-left px-3 py-2 rounded-lg bg-[#72B01D] hover:bg-[#6AA318] text-white text-[12px] font-medium transition-colors"
                  >
                    + New Client
                  </button>
                )}
                {onCreateTonic && (
                  <button
                    onClick={onCreateTonic}
                    className="w-full text-left px-3 py-2 rounded-lg border border-[#72B01D80] bg-[#72B01D] hover:bg-[#6AA318] text-white text-[12px] font-semibold transition-colors"
                  >
                    + New Tonic
                  </button>
                )}
                <button
                  onClick={handleCreateConsultation}
                  className="w-full text-left px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-[12px] font-medium transition-colors"
                >
                  + New Consultation
                </button>
                <button
                  onClick={() => router.push("/herbs")}
                  className="w-full text-left px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[#4B543B] text-[12px] font-medium transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    Herbs Reference
                  </div>
                </button>
              </div>
            </div>

            {/* Recent Activity */}
            {recentActivity.length > 0 && (
              <div>
                <h3 className="text-[11px] font-semibold text-[#4B543B] uppercase tracking-wide mb-3">
                  Recent Activity
                </h3>
                <div className="space-y-2">
                  {recentActivity.slice(0, 5).map((activity) => (
                    <button
                      key={activity.id}
                      onClick={() => {
                        if (activity.type === "client") {
                          router.push(`/clients`);
                        }
                      }}
                      className="w-full text-left p-2 rounded-lg hover:bg-slate-50 transition-colors group"
                    >
                      <div className="flex items-start gap-2">
                        <div className={`flex-shrink-0 w-1.5 h-1.5 rounded-full mt-1.5 ${
                          activity.type === "note" ? "bg-blue-400" :
                          activity.type === "formula" ? "bg-[#72B01D]" :
                          "bg-slate-400"
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-medium text-slate-900 truncate group-hover:text-[#72B01D]">
                            {activity.title}
                          </p>
                          {activity.clientName && (
                            <p className="text-[10px] text-slate-500 truncate">{activity.clientName}</p>
                          )}
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {new Date(activity.date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

