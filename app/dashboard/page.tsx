"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import AppHeader from "@/components/AppHeader";
import MainContent from "@/components/MainContent";

type Stats = {
  clientCount: number | null;
  consultCount: number | null;
  upcoming: Array<{
    id: string;
    start_time: string;
    client_name: string | null;
    consult_type: string;
    status: string;
  }>;
};

function Card({
  title,
  description,
  href,
  children,
}: {
  title: string;
  description: string;
  href: string;
  children?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="block rounded-2xl border border-white/60 bg-white/80 backdrop-blur-lg p-5 shadow-lg shadow-black/5 transition hover:border-[#72B01D]/40 hover:shadow-md"
    >
      <h2 className="text-[15px] font-semibold text-[#4B543B]">{title}</h2>
      <p className="mt-1 text-[12px] text-slate-600 leading-relaxed">{description}</p>
      {children && <div className="mt-3">{children}</div>}
      <span className="mt-3 inline-block text-[11px] font-semibold text-[#72B01D]">
        Open →
      </span>
    </Link>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    clientCount: null,
    consultCount: null,
    upcoming: [],
  });
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const { data: userRes } = await supabase.auth.getUser();
        const user = userRes.user;
        if (!user) return;

        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, company_name")
          .eq("id", user.id)
          .maybeSingle();

        const name =
          profile?.full_name?.split(" ")[0] ||
          profile?.company_name ||
          user.email?.split("@")[0] ||
          "there";
        setGreeting(name);

        const { count: clientCount } = await supabase
          .from("clients")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id);

        const { count: consultCount } = await supabase
          .from("consults")
          .select("*", { count: "exact", head: true })
          .eq("practitioner_id", user.id);

        const nowIso = new Date().toISOString();
        const { data: bookings } = await supabase
          .from("bookings")
          .select("id, start_time, client_name, consult_type, status")
          .eq("practitioner_id", user.id)
          .in("status", ["pending", "confirmed"])
          .gte("start_time", nowIso)
          .order("start_time", { ascending: true })
          .limit(5);

        setStats({
          clientCount: clientCount ?? 0,
          consultCount: consultCount ?? 0,
          upcoming: bookings ?? [],
        });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <>
      <AppHeader />
      <MainContent>
        <div className="max-w-6xl mx-auto py-10 px-4">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-[#4B543B]">
              Dashboard
            </h1>
            <p className="mt-1 text-[13px] text-slate-600">
              {loading ? "Loading your overview…" : `Hi, ${greeting}. Here’s a snapshot of your workspace.`}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card
              title="Clients"
              description="Manage client records, notes, and formulas."
              href="/clients"
            >
              {!loading && stats.clientCount !== null && (
                <p className="text-2xl font-semibold text-[#2E332B] tabular-nums">
                  {stats.clientCount}
                  <span className="ml-2 text-[12px] font-normal text-slate-500">
                    total
                  </span>
                </p>
              )}
            </Card>

            <Card
              title="Tonic workspace"
              description="Build and export herbal formulas with dosing guidance."
              href="/app"
            />

            <Card
              title="Calendar"
              description="Upcoming bookings and availability."
              href="/calendar"
            >
              {!loading && stats.upcoming.length > 0 && (
                <ul className="space-y-2 text-[11px] text-slate-700">
                  {stats.upcoming.slice(0, 3).map((b) => (
                    <li key={b.id} className="flex justify-between gap-2 border-b border-slate-100 pb-1">
                      <span className="truncate">
                        {b.client_name || "Booking"} · {b.consult_type}
                      </span>
                      <span className="shrink-0 text-slate-500">
                        {new Date(b.start_time).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {!loading && stats.upcoming.length === 0 && (
                <p className="text-[11px] text-slate-500">No upcoming sessions.</p>
              )}
            </Card>

            <Card
              title="Consultations"
              description="Record, transcribe, and generate consult notes."
              href="/consultations"
            >
              {!loading && stats.consultCount !== null && (
                <p className="text-2xl font-semibold text-[#2E332B] tabular-nums">
                  {stats.consultCount}
                  <span className="ml-2 text-[12px] font-normal text-slate-500">
                    sessions
                  </span>
                </p>
              )}
            </Card>

            <Card
              title="My clinic"
              description="Booking page, consult types, and clinic settings."
              href="/myclinic"
            />

            <Card
              title="Herbs"
              description="Browse the herb library and workspace."
              href="/herbs"
            />
          </div>
        </div>
      </MainContent>
    </>
  );
}
