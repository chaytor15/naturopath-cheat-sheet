"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import AppHeader from "@/components/AppHeader";
import Sidebar from "@/components/Sidebar";
import MainContent from "@/components/MainContent";

type Consultation = {
  id: string;
  client_id: string | null;
  user_id: string;
  title: string;
  start_time: string;
  end_time: string;
  notes: string | null;
  location: string | null;
  calendar_event_id: string | null;
  created_at: string;
  client?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    full_name: string | null;
  };
};

type ViewMode = "day" | "week" | "month";

export default function CalendarPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clients, setClients] = useState<Array<{ id: string; first_name: string | null; last_name: string | null; full_name: string | null }>>([]);
  const [calendarConnected, setCalendarConnected] = useState(false);

  // Check for new consultation query param
  useEffect(() => {
    if (searchParams.get("new") === "true") {
      const clientId = searchParams.get("client");
      if (clientId) setSelectedClientId(clientId);
      setShowNewModal(true);
    }
  }, [searchParams]);

  // Auth check and load data
  useEffect(() => {
    const loadData = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.replace("/login");
        return;
      }

      const user = sessionData.session.user;

      // Load consultations
      const { data: consultationsData, error: consultationsError } = await supabase
        .from("consultations")
        .select(`
          *,
          clients:client_id (
            id,
            first_name,
            last_name,
            full_name
          )
        `)
        .eq("user_id", user.id)
        .order("start_time", { ascending: true });

      if (!consultationsError && consultationsData) {
        setConsultations(consultationsData as any);
      }

      // Load clients for dropdown
      const { data: clientsData } = await supabase
        .from("clients")
        .select("id, first_name, last_name, full_name")
        .eq("user_id", user.id)
        .order("first_name", { ascending: true });

      if (clientsData) {
        setClients(clientsData);
      }

      setLoading(false);
    };

    loadData();
  }, [router]);

  const getClientName = (client: Consultation["client"] | null): string => {
    if (!client) return "No client";
    if (client.first_name || client.last_name) {
      return `${client.first_name || ""} ${client.last_name || ""}`.trim();
    }
    return client.full_name || "Unnamed Client";
  };

  const navigateDate = (direction: "prev" | "next") => {
    const newDate = new Date(currentDate);
    if (viewMode === "day") {
      newDate.setDate(newDate.getDate() + (direction === "next" ? 1 : -1));
    } else if (viewMode === "week") {
      newDate.setDate(newDate.getDate() + (direction === "next" ? 7 : -7));
    } else {
      newDate.setMonth(newDate.getMonth() + (direction === "next" ? 1 : -1));
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const formatDateHeader = (): string => {
    if (viewMode === "day") {
      return currentDate.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    } else if (viewMode === "week") {
      const startOfWeek = new Date(currentDate);
      startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      return `${startOfWeek.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${endOfWeek.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
    } else {
      return currentDate.toLocaleDateString("en-US", { year: "numeric", month: "long" });
    }
  };

  const renderCalendarView = () => {
    if (viewMode === "day") {
      // Day view - hourly time slots
      const hours = Array.from({ length: 17 }, (_, i) => i + 6); // 6 AM to 10 PM
      const dayStart = new Date(currentDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const dayConsultations = consultations.filter((c) => {
        const consultDate = new Date(c.start_time);
        return consultDate >= dayStart && consultDate <= dayEnd;
      });

      const getConsultationPosition = (consultation: Consultation) => {
        const start = new Date(consultation.start_time);
        const end = new Date(consultation.end_time);
        const startMinutes = start.getHours() * 60 + start.getMinutes();
        const endMinutes = end.getHours() * 60 + end.getMinutes();
        const duration = endMinutes - startMinutes;
        
        // Position from 6 AM (360 minutes)
        const top = ((startMinutes - 360) / 60) * 60; // 60px per hour
        const height = (duration / 60) * 60;
        
        return { top: Math.max(0, top), height: Math.max(20, height) };
      };

      return (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="flex">
            {/* Time column */}
            <div className="w-16 border-r border-slate-200">
              {hours.map((hour) => (
                <div key={hour} className="h-[60px] border-b border-slate-100 flex items-start justify-end pr-2 pt-1">
                  <span className="text-[11px] text-slate-500">
                    {hour === 12 ? "12 PM" : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                  </span>
                </div>
              ))}
            </div>
            {/* Day column */}
            <div className="flex-1 relative min-h-[1020px]">
              {/* Hour lines */}
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="absolute left-0 right-0 border-b border-slate-100"
                  style={{ top: `${(hour - 6) * 60}px`, height: "60px" }}
                />
              ))}
              {/* Consultations */}
              {dayConsultations.map((consultation) => {
                const { top, height } = getConsultationPosition(consultation);
                const startTime = new Date(consultation.start_time);
                const endTime = new Date(consultation.end_time);
                
                return (
                  <div
                    key={consultation.id}
                    className="absolute left-2 right-2 rounded-lg bg-[#72B01D]/10 border border-[#72B01D]/30 p-2 cursor-pointer hover:bg-[#72B01D]/20 transition-colors"
                    style={{ top: `${top}px`, height: `${height}px`, minHeight: "40px" }}
                    title={`${consultation.title}\n${startTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} - ${endTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`}
                  >
                    <div className="text-[11px] font-medium text-[#4B543B] mb-0.5">
                      {new Date(consultation.start_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </div>
                    <div className="text-[12px] font-semibold text-[#2E332B] truncate">
                      {consultation.title}
                    </div>
                    {consultation.client && (
                      <div className="text-[10px] text-slate-600 mt-0.5 truncate">
                        {getClientName(consultation.client)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );
    } else if (viewMode === "week") {
      // Week view - 7 days with hourly time slots
      const startOfWeek = new Date(currentDate);
      startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      
      const weekDays = [];
      for (let i = 0; i < 7; i++) {
        const day = new Date(startOfWeek);
        day.setDate(startOfWeek.getDate() + i);
        weekDays.push(day);
      }

      const hours = Array.from({ length: 17 }, (_, i) => i + 6); // 6 AM to 10 PM
      const weekDayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

      const getWeekConsultations = (day: Date) => {
        const dayStart = new Date(day);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(day);
        dayEnd.setHours(23, 59, 59, 999);

        return consultations.filter((c) => {
          const consultDate = new Date(c.start_time);
          return consultDate >= dayStart && consultDate <= dayEnd;
        });
      };

      const getConsultationPosition = (consultation: Consultation) => {
        const start = new Date(consultation.start_time);
        const end = new Date(consultation.end_time);
        const startMinutes = start.getHours() * 60 + start.getMinutes();
        const endMinutes = end.getHours() * 60 + end.getMinutes();
        const duration = endMinutes - startMinutes;
        
        // Position from 6 AM (360 minutes)
        const top = ((startMinutes - 360) / 60) * 60; // 60px per hour
        const height = (duration / 60) * 60;
        
        return { top: Math.max(0, top), height: Math.max(20, height) };
      };

      return (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="flex">
            {/* Time column */}
            <div className="w-16 border-r border-slate-200">
              <div className="h-12 border-b border-slate-200"></div>
              {hours.map((hour) => (
                <div key={hour} className="h-[60px] border-b border-slate-100 flex items-start justify-end pr-2 pt-1">
                  <span className="text-[11px] text-slate-500">
                    {hour === 12 ? "12 PM" : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                  </span>
                </div>
              ))}
            </div>
            {/* Week days */}
            <div className="flex-1 flex">
              {weekDays.map((day, dayIndex) => {
                const isToday = day.toDateString() === new Date().toDateString();
                const dayConsultations = getWeekConsultations(day);
                
                return (
                  <div key={dayIndex} className="flex-1 border-r border-slate-200 last:border-r-0">
                    {/* Day header */}
                    <div className={`h-12 border-b border-slate-200 p-2 ${isToday ? "bg-[#EDEFE6]" : "bg-slate-50"}`}>
                      <div className={`text-[11px] font-semibold uppercase ${isToday ? "text-[#72B01D]" : "text-slate-600"}`}>
                        {weekDayNames[day.getDay()]}
                      </div>
                      <div className={`text-[13px] font-medium ${isToday ? "text-[#72B01D]" : "text-slate-900"}`}>
                        {day.getDate()}
                      </div>
                    </div>
                    {/* Time slots */}
                    <div className="relative min-h-[1020px]">
                      {/* Hour lines */}
                      {hours.map((hour) => (
                        <div
                          key={hour}
                          className="absolute left-0 right-0 border-b border-slate-100"
                          style={{ top: `${(hour - 6) * 60}px`, height: "60px" }}
                        />
                      ))}
                      {/* Consultations */}
                      {dayConsultations.map((consultation) => {
                        const { top, height } = getConsultationPosition(consultation);
                        const startTime = new Date(consultation.start_time);
                        const endTime = new Date(consultation.end_time);
                        
                        return (
                          <div
                            key={consultation.id}
                            className="absolute left-1 right-1 rounded-lg bg-[#72B01D]/10 border border-[#72B01D]/30 p-1.5 cursor-pointer hover:bg-[#72B01D]/20 transition-colors"
                            style={{ top: `${top}px`, height: `${height}px`, minHeight: "30px" }}
                            title={`${consultation.title}\n${startTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} - ${endTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`}
                          >
                            <div className="text-[10px] font-medium text-[#4B543B] mb-0.5">
                              {new Date(consultation.start_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                            </div>
                            <div className="text-[11px] font-semibold text-[#2E332B] truncate">
                              {consultation.title}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );
    } else {
      // Month view
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const daysInMonth = lastDay.getDate();
      const startingDayOfWeek = firstDay.getDay();

      const days = [];
      // Empty cells for days before month starts
      for (let i = 0; i < startingDayOfWeek; i++) {
        days.push(null);
      }
      // Days of the month
      for (let day = 1; day <= daysInMonth; day++) {
        days.push(day);
      }

      const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

      return (
        <div className="grid grid-cols-7 gap-px bg-slate-200 border border-slate-200 rounded-lg overflow-hidden">
          {/* Week day headers */}
          {weekDays.map((day) => (
            <div key={day} className="bg-slate-50 p-2 text-center text-[11px] font-semibold text-slate-600 uppercase">
              {day}
            </div>
          ))}
          {/* Calendar days */}
          {days.map((day, index) => {
            const dayDate = day ? new Date(year, month, day) : null;
            const isToday = dayDate && dayDate.toDateString() === new Date().toDateString();
            const dayConsultations = dayDate
              ? consultations.filter((c) => {
                  const consultDate = new Date(c.start_time);
                  return (
                    consultDate.getFullYear() === year &&
                    consultDate.getMonth() === month &&
                    consultDate.getDate() === day
                  );
                })
              : [];

            return (
              <div
                key={index}
                className={`bg-white min-h-[100px] p-1.5 ${day ? "" : "bg-slate-50"} ${isToday ? "bg-[#EDEFE6]" : ""}`}
              >
                {day && (
                  <>
                    <div className={`text-[11px] font-medium mb-1 ${isToday ? "text-[#72B01D]" : "text-slate-700"}`}>
                      {day}
                    </div>
                    <div className="space-y-0.5">
                      {dayConsultations.slice(0, 3).map((consultation) => (
                        <div
                          key={consultation.id}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-[#72B01D]/10 text-[#4B543B] truncate cursor-pointer hover:bg-[#72B01D]/20"
                          title={`${consultation.title} - ${new Date(consultation.start_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`}
                        >
                          {new Date(consultation.start_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} {consultation.title}
                        </div>
                      ))}
                      {dayConsultations.length > 3 && (
                        <div className="text-[10px] text-slate-500 px-1.5">
                          +{dayConsultations.length - 3} more
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      );
    }
  };

  return (
    <>
      <AppHeader />
      <Sidebar />
      <MainContent>
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-[#4B543B] mb-1">Calendar</h1>
              <p className="text-[12px] text-slate-600">{formatDateHeader()}</p>
            </div>
            <div className="flex items-center gap-2">
              {calendarConnected ? (
                <button
                  onClick={() => setCalendarConnected(false)}
                  className="text-[12px] font-medium text-red-700 hover:text-red-800"
                >
                  Disconnect Calendar
                </button>
              ) : (
                <button
                  onClick={() => setCalendarConnected(true)}
                  className="px-4 py-2 text-[12px] font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700"
                >
                  Connect Calendar
                </button>
              )}
              <button
                onClick={() => setShowNewModal(true)}
                className="px-3 py-1.5 text-[12px] font-semibold rounded-lg border border-[#72B01D80] bg-[#72B01D] hover:bg-[#6AA318] text-white"
              >
                + New Consultation
              </button>
            </div>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-2 mb-4">
            <div className="flex rounded-lg border border-slate-300 bg-white p-1">
              {(["day", "week", "month"] as ViewMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1.5 text-[12px] font-medium rounded transition-colors ${
                    viewMode === mode
                      ? "bg-[#72B01D] text-white"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => navigateDate("prev")}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600"
                aria-label="Previous"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={() => navigateDate("next")}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600"
                aria-label="Next"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Calendar View */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 border-2 border-[#4B543B] border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            renderCalendarView()
          )}
        </div>
      </MainContent>

      {/* New Consultation Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md mx-4">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#4B543B]">New Consultation</h2>
                <button
                  onClick={() => {
                    setShowNewModal(false);
                    setSelectedClientId(null);
                    router.replace("/calendar");
                  }}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6">
              <p className="text-[12px] text-slate-600">Consultation booking form coming soon. This will integrate with your calendar platform.</p>
            </div>
          </div>
        </div>
      )}

    </>
  );
}
