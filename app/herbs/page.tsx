"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import AppHeader from "@/components/AppHeader";
import Sidebar from "@/components/Sidebar";
import MainContent from "@/components/MainContent";

type HerbRow = {
  id: string;
  herbId: string;
  herbName: string;
  latinName: string;
  actions: string | null;
  indications: string | null;
  energeticProperties: string | null;
  safetyPrecautions: string | null;
  ratio: string | null;
  doseMinMl: number | null;
  doseMaxMl: number | null;
  doseUnit: string | null;
  therapeuticDosage: string | null;
  conditionName: string | null;
};

function formatDose(row: HerbRow): string {
  const unit = row.doseUnit ?? "mL";

  const min = row.doseMinMl != null ? Math.round(Number(row.doseMinMl)) : null;
  const max = row.doseMaxMl != null ? Math.round(Number(row.doseMaxMl)) : null;

  if (min != null && max != null && min !== max) {
    return `(${row.ratio}) ${min}–${max} ${unit}`;
  }

  if (min != null && (max == null || min === max)) {
    return `(${row.ratio}) ${min} ${unit}`;
  }

  if (row.therapeuticDosage) {
    return row.therapeuticDosage;
  }

  return "";
}

export default function HerbsPage() {
  const router = useRouter();
  const [herbRows, setHerbRows] = useState<HerbRow[]>([]);
  const [allHerbRows, setAllHerbRows] = useState<HerbRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpandedView, setIsExpandedView] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Auth check - redirect to login if not logged in
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/login");
      }
    });
  }, [router]);

  // Load all herbs
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      // Fetch all condition_herbs - no limit
      const { data, error } = await supabase
        .from("condition_herbs")
        .select(
          `
          id,
          herb_id,
          indications,
          ratio,
          dose_min_ml,
          dose_max_ml,
          dose_unit,
          therapeutic_dosage,
          herbs:herb_id (
            herb_name,
            latin_name,
            actions,
            energetic_properties,
            safety_precautions
          ),
          conditions:condition_id (
            name
          )
        `,
          { count: "exact" }
        )
        .limit(10000); // High limit to ensure we get all rows

      setLoading(false);

      if (error) {
        console.error(error);
        setError("Could not load herbs.");
        return;
      }

      const rows: HerbRow[] =
        data?.map((row: any) => ({
          id: row.id,
          herbId: String(row.herb_id),
          herbName: row.herbs.herb_name,
          latinName: row.herbs.latin_name,
          actions: row.herbs.actions,
          indications: row.indications,
          energeticProperties: row.herbs.energetic_properties,
          safetyPrecautions: row.herbs.safety_precautions,
          ratio:
            row.ratio !== null && row.ratio !== undefined ? String(row.ratio) : null,
          doseMinMl:
            row.dose_min_ml !== null && row.dose_min_ml !== undefined
              ? Number(row.dose_min_ml)
              : null,
          doseMaxMl:
            row.dose_max_ml !== null && row.dose_max_ml !== undefined
              ? Number(row.dose_max_ml)
              : null,
          doseUnit: row.dose_unit,
          therapeuticDosage: row.therapeutic_dosage,
          conditionName: row.conditions?.name || null,
        })) ?? [];

      // Group by herb name to find duplicates
      const herbNameMap = new Map<string, HerbRow[]>();
      rows.forEach((row) => {
        if (!herbNameMap.has(row.herbName)) {
          herbNameMap.set(row.herbName, []);
        }
        herbNameMap.get(row.herbName)!.push(row);
      });

      // Process duplicates - add condition name in brackets for herbs that appear multiple times
      const processedRows: HerbRow[] = [];
      herbNameMap.forEach((herbRows, herbName) => {
        if (herbRows.length > 1) {
          // Multiple conditions - add condition name to each
          herbRows.forEach((row) => {
            processedRows.push({
              ...row,
              herbName: `${row.herbName} (${row.conditionName})`,
            });
          });
        } else {
          // Single condition - no need to add condition name
          processedRows.push(herbRows[0]);
        }
      });

      // Sort alphabetically by herb name
      processedRows.sort((a, b) => {
        // Extract base herb name for sorting (remove condition in brackets)
        const nameA = a.herbName.split(" (")[0];
        const nameB = b.herbName.split(" (")[0];
        return nameA.localeCompare(nameB);
      });

      setAllHerbRows(processedRows);
      setHerbRows(processedRows);
    };

    load();
  }, []);

  // Filter herbs based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setHerbRows(allHerbRows);
      return;
    }

    const query = searchQuery.toLowerCase().trim();
    const filtered = allHerbRows.filter((row) => {
      const herbName = row.herbName.toLowerCase();
      const latinName = (row.latinName || "").toLowerCase();
      const actions = (row.actions || "").toLowerCase();
      const indications = (row.indications || "").toLowerCase();
      const energeticProperties = (row.energeticProperties || "").toLowerCase();
      const safetyPrecautions = (row.safetyPrecautions || "").toLowerCase();

      return (
        herbName.includes(query) ||
        latinName.includes(query) ||
        actions.includes(query) ||
        indications.includes(query) ||
        energeticProperties.includes(query) ||
        safetyPrecautions.includes(query)
      );
    });

    setHerbRows(filtered);
  }, [searchQuery, allHerbRows]);

  const truncatedStyle = !isExpandedView
    ? { maxHeight: "3.5rem", overflow: "hidden" }
    : undefined;

  return (
    <>
      <AppHeader />
      <Sidebar />
      <MainContent>
        <div className="max-w-6xl mx-auto py-10 px-4">
          <div className="sticky top-[60px] z-20 bg-[#F7F8F3] pb-4 pt-2 -mx-4 px-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Search herbs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="px-3 py-1 rounded-full border border-slate-300 bg-white text-[10px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#72B01D66] focus:border-[#72B01D] w-40"
                />
                <button
                  type="button"
                  onClick={() => setIsExpandedView(false)}
                  className={`px-3 py-1 rounded-full border text-[10px] ${
                    !isExpandedView
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-600 border-slate-300"
                  }`}
                >
                  Compact
                </button>
                <button
                  type="button"
                  onClick={() => setIsExpandedView(true)}
                  className={`px-3 py-1 rounded-full border text-[10px] ${
                    isExpandedView
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-600 border-slate-300"
                  }`}
                >
                  Detailed
                </button>
              </div>
            </div>
          </div>

          {error && (
            <p className="text-sm text-amber-800 mb-4 bg-amber-50 border border-amber-300 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          {loading && (
            <p className="text-sm text-slate-600 mb-4">Loading herbs...</p>
          )}

          {!loading && !error && herbRows.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <table className="w-full table-fixed text-[11px] md:text-[11px] border-collapse">
                <thead className="bg-[#F0F3EB]/95 backdrop-blur-sm sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 border-b border-slate-200 text-left text-[#4B543B] text-[10px] uppercase tracking-[0.16em] whitespace-normal leading-tight">
                      Herb
                    </th>
                    <th className="px-4 py-3 border-b border-slate-200 text-left text-[#4B543B] text-[10px] uppercase tracking-[0.16em] whitespace-normal leading-tight">
                      Latin Name
                    </th>
                    <th className="px-4 py-3 border-b border-slate-200 text-left text-[#4B543B] text-[10px] uppercase tracking-[0.16em] whitespace-normal leading-tight">
                      Action
                    </th>
                    <th className="px-4 py-3 border-b border-slate-200 text-left text-[#4B543B] text-[10px] uppercase tracking-[0.16em] whitespace-normal leading-tight">
                      Indications
                    </th>
                    <th className="px-4 py-3 border-b border-slate-200 text-left text-[#4B543B] text-[10px] uppercase tracking-[0.16em] whitespace-normal leading-tight">
                      Energetics
                    </th>
                    <th className="px-4 py-3 border-b border-slate-200 text-left text-[#4B543B] text-[10px] uppercase tracking-[0.16em] whitespace-normal leading-tight">
                      Safety
                    </th>
                    <th className="px-4 py-3 border-b border-slate-200 text-left text-[#4B543B] text-[10px] uppercase tracking-[0.16em] whitespace-normal leading-tight">
                      Therapeutic Dose
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {herbRows.map((row) => (
                    <tr
                      key={row.id}
                      className="odd:bg-white/80 even:bg-[#F7F8F3]/80 hover:bg-[#EDEFE6] transition-colors"
                    >
                      <td className="align-top px-4 py-3 border-b border-slate-200 text-slate-900 text-[11px]">
                        {row.herbName}
                      </td>

                      <td className="align-top px-4 py-3 border-b border-slate-200 italic text-slate-700 text-[11px]">
                        {row.latinName}
                      </td>

                      <td className="align-top px-4 py-3 border-b border-slate-200 text-slate-800 text-[11px]">
                        <div
                          className="break-words leading-snug"
                          style={truncatedStyle}
                          title={row.actions ?? ""}
                        >
                          {row.actions}
                        </div>
                      </td>

                      <td className="align-top px-4 py-3 border-b border-slate-200 text-slate-800 text-[11px]">
                        <div
                          className="break-words leading-snug"
                          style={truncatedStyle}
                          title={row.indications ?? ""}
                        >
                          {row.indications}
                        </div>
                      </td>

                      <td className="align-top px-4 py-3 border-b border-slate-200 text-slate-800 text-[11px]">
                        <div
                          className="break-words leading-snug"
                          style={truncatedStyle}
                          title={row.energeticProperties ?? ""}
                        >
                          {row.energeticProperties}
                        </div>
                      </td>

                      <td className="align-top px-4 py-3 border-b border-slate-200 text-slate-800 text-[11px]">
                        <div
                          className="break-words leading-snug"
                          style={truncatedStyle}
                          title={row.safetyPrecautions ?? ""}
                        >
                          {row.safetyPrecautions}
                        </div>
                      </td>

                      <td className="align-top px-4 py-3 border-b border-slate-200 text-slate-800 text-[11px]">
                        {formatDose(row)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && !error && herbRows.length === 0 && (
            <p className="text-sm text-slate-600 mt-2">
              {searchQuery ? "No matches for your search." : "No herbs found."}
            </p>
          )}

          {!loading && !error && herbRows.length > 0 && (
            <p className="text-[11px] text-slate-500 mt-2">
              Showing {herbRows.length} {herbRows.length === 1 ? "herb" : "herbs"}
              {searchQuery && ` matching "${searchQuery}"`}
            </p>
          )}
        </div>
      </MainContent>
    </>
  );
}
