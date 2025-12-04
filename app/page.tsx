"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type BodySystemOption = {
  value: string;
  label: string;
};

type Condition = {
  id: string;
  name: string;
};

type HerbRow = {
  id: string; // condition_herbs row id
  herbId: string; // underlying herbs table id (used to dedupe across conditions)
  herbName: string;
  latinName: string;
  actions: string | null;
  indications: string | null;
  energeticProperties: string | null;
  safetyPrecautions: string | null;

  ratio: string | null;
  doseMinMl: number | null; // weekly low end
  doseMaxMl: number | null; // weekly high end
  doseUnit: string | null;

  therapeuticDosage: string | null; // original text if present
};

type WorkspaceHerb = {
  herb: HerbRow;
  ml: number; // mL of this herb in the bottle
  withinRange: boolean | null;
};

function formatDose(row: HerbRow): string {
  const unit = row.doseUnit ?? "mL";

  const min =
    row.doseMinMl != null ? Math.round(Number(row.doseMinMl)) : null;
  const max =
    row.doseMaxMl != null ? Math.round(Number(row.doseMaxMl)) : null;

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

/**
 * Compute the therapeutic range in mL for THIS bottle, for a given herb,
 * based on the weekly low/high, the bottle size, and the daily dose.
 *
 * Formula per your spec:
 *  lowRange = (lowWeekly / 7 / totalDailyDose) * bottleSize
 *  highRange = (highWeekly / 7 / totalDailyDose) * bottleSize
 */
function computeTherapeuticBottleRange(
  row: HerbRow,
  bottleVolumeMl: number,
  dailyDoseMl: number
): { low: number | null; high: number | null } {
  if (!bottleVolumeMl || !dailyDoseMl) {
    return { low: null, high: null };
  }

  const min = row.doseMinMl;
  const max = row.doseMaxMl;

  if (min == null && max == null) {
    return { low: null, high: null };
  }

  const factor = bottleVolumeMl / (7 * dailyDoseMl);

  const low = min != null ? min * factor : null;
  const high = max != null ? max * factor : null;

  return { low, high };
}

/**
 * Determine if a given herb volume in the bottle is within the computed
 * therapeutic range for that bottle configuration.
 *
 * NB: we now use CEILING (round up) for the therapeutic bounds so that
 * what you see as the whole number threshold is exactly what is used in logic.
 */
function isDoseWithinBottleRange(
  row: HerbRow,
  mlInBottle: number,
  bottleVolumeMl: number,
  dailyDoseMl: number
): boolean | null {
  const { low, high } = computeTherapeuticBottleRange(
    row,
    bottleVolumeMl,
    dailyDoseMl
  );

  if (low == null && high == null) return null;
  if (mlInBottle <= 0) return null;

  const lowCeil = low != null ? Math.ceil(low) : null;
  const highCeil = high != null ? Math.ceil(high) : null;

  if (lowCeil != null && highCeil != null) {
    return mlInBottle >= lowCeil && mlInBottle <= highCeil;
  }
  if (lowCeil != null && highCeil == null) {
    return mlInBottle >= lowCeil;
  }
  if (highCeil != null && lowCeil == null) {
    return mlInBottle <= highCeil;
  }

  return null;
}

export default function HomePage() {
  const [bodySystems, setBodySystems] = useState<BodySystemOption[]>([]);
  const [selectedBodySystem, setSelectedBodySystem] = useState<string>("");
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [selectedConditionId, setSelectedConditionId] = useState<string>("");
  const [herbRows, setHerbRows] = useState<HerbRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedHerb, setSelectedHerb] = useState<HerbRow | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const [clientName, setClientName] = useState("");
  const [tonicPurpose, setTonicPurpose] = useState("");
  const [medications, setMedications] = useState("");
  const [existingConditionsText, setExistingConditionsText] = useState("");

  // NEW tonic-level fields
  const [tonicName, setTonicName] = useState("");
  const [patientInstructions, setPatientInstructions] = useState("");

  const [bottleSize, setBottleSize] = useState<"100" | "200" | "500" | "">("");
  const [doseMl, setDoseMl] = useState<string>(""); // numeric string
  const [frequencyPerDay, setFrequencyPerDay] = useState<string>(""); // numeric string

  const [workspaceHerbs, setWorkspaceHerbs] = useState<WorkspaceHerb[]>([]);

  // mL modal state
  const [mlModalOpen, setMlModalOpen] = useState(false);
  const [mlModalHerb, setMlModalHerb] = useState<HerbRow | null>(null);
  const [mlModalIndex, setMlModalIndex] = useState<number | null>(null);
  const [mlModalValue, setMlModalValue] = useState<string>("");

  // Styled error modal when bottle size / dose / frequency aren't set
  const [bottleConfigErrorOpen, setBottleConfigErrorOpen] = useState(false);

  const closeDrawer = () => {
    setIsDrawerOpen(false);
    setTimeout(() => setSelectedHerb(null), 200);
  };

  const selectedCondition = conditions.find(
    (c) => c.id === selectedConditionId
  );

  // Bottle / volume calculations
  const bottleVolumeMl = bottleSize ? Number(bottleSize) : 0;

  const numericDose = doseMl ? Math.round(Number(doseMl)) : 0;
  const numericFrequency = frequencyPerDay
    ? Math.round(Number(frequencyPerDay))
    : 0;

  const dailyDoseMl =
    numericDose > 0 && numericFrequency > 0
      ? numericDose * numericFrequency
      : 0;

  const totalWorkspaceMl = workspaceHerbs.reduce((s, i) => s + i.ml, 0);

  // Raw % can exceed 100 for logic + display
  const bottleFillPercentRaw =
    bottleVolumeMl === 0 ? 0 : (totalWorkspaceMl / bottleVolumeMl) * 100;

  // Clamp to 0–100 for visual height
  const bottleFillPercent = Math.min(100, Math.max(0, bottleFillPercentRaw));

  // Overfilled if total volume > bottle volume
  const isOverfilled = bottleVolumeMl > 0 && totalWorkspaceMl > bottleVolumeMl;

  // Check if herb already in workspace (by herbId, not condition_herbs id)
  const isHerbInWorkspace = (herbId: string) =>
    workspaceHerbs.some((item) => item.herb.herbId === herbId);

  // Recompute withinRange whenever bottle size or daily dose changes
  useEffect(() => {
    setWorkspaceHerbs((prev) =>
      prev.map((item) => ({
        ...item,
        withinRange: isDoseWithinBottleRange(
          item.herb,
          item.ml,
          bottleVolumeMl,
          dailyDoseMl
        ),
      }))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bottleVolumeMl, dailyDoseMl]);

  // LOAD BODY SYSTEMS
  useEffect(() => {
    const fetchBodySystems = async () => {
      const { data, error } = await supabase
        .from("conditions")
        .select("body_system")
        .not("body_system", "is", null);

      if (error) {
        console.error(error);
        setError("Could not load body systems.");
        return;
      }

      const unique = Array.from(
        new Set((data ?? []).map((r: any) => r.body_system))
      ).sort();

      setBodySystems(unique.map((v) => ({ value: v, label: v })));
    };

    fetchBodySystems();
  }, []);

  // LOAD CONDITIONS (do NOT clear workspace anymore)
  useEffect(() => {
    if (!selectedBodySystem) {
      setConditions([]);
      setSelectedConditionId("");
      setHerbRows([]);
      // workspaceHerbs persists
      return;
    }

    const load = async () => {
      const { data, error } = await supabase
        .from("conditions")
        .select("id, name")
        .eq("body_system", selectedBodySystem)
        .order("name");

      if (error) {
        console.error(error);
        setError("Could not load health concerns.");
        return;
      }

      setConditions(data ?? []);
      setSelectedConditionId("");
      setHerbRows([]);
      // workspaceHerbs persists
    };

    load();
  }, [selectedBodySystem]);

  // LOAD HERBS (do NOT clear workspace anymore)
  useEffect(() => {
    if (!selectedConditionId) {
      setHerbRows([]);
      // workspaceHerbs persists
      return;
    }

    const load = async () => {
      setLoading(true);
      setError(null);

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
          )
        `
        )
        .eq("condition_id", selectedConditionId);

      setLoading(false);

      if (error) {
        console.error(error);
        setError("Could not load herbs for this concern.");
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
          ratio: row.ratio,
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
        })) ?? [];

      setHerbRows(rows.sort((a, b) => a.herbName.localeCompare(b.herbName)));
    };

    load();
  }, [selectedConditionId]);

  // OPEN mL MODAL FOR NEW HERB
  const handleAddHerbToWorkspace = (herb: HerbRow) => {
    if (isHerbInWorkspace(herb.herbId)) {
      return;
    }

    if (!bottleVolumeMl || !dailyDoseMl) {
      setBottleConfigErrorOpen(true);
      return;
    }

    setMlModalHerb(herb);
    setMlModalIndex(null);
    setMlModalValue("");
    setMlModalOpen(true);
  };

  // REMOVE FROM WORKSPACE (by index in workspace table)
  const handleRemoveWorkspaceHerb = (index: number) =>
    setWorkspaceHerbs((prev) => prev.filter((_, i) => i !== index));

  // REMOVE FROM WORKSPACE (from herbs table, by herbId)
  const handleRemoveHerbFromTable = (herbId: string) => {
    setWorkspaceHerbs((prev) =>
      prev.filter((item) => item.herb.herbId !== herbId)
    );
  };

  // OPEN mL MODAL FOR EDIT
  const handleEditWorkspaceHerbMl = (index: number) => {
    const current = workspaceHerbs[index];
    if (!current) return;
    setMlModalHerb(current.herb);
    setMlModalIndex(index);
    setMlModalValue(String(current.ml));
    setMlModalOpen(true);
  };

  // CONFIRM mL MODAL
  const handleConfirmMlModal = () => {
    if (!mlModalHerb) return;

    const mlRaw = Number(mlModalValue);
    const ml = Math.round(mlRaw);

    if (Number.isNaN(mlRaw) || mlRaw <= 0 || ml <= 0) {
      window.alert("Please enter a valid mL amount (whole number).");
      return;
    }

    const withinRange = isDoseWithinBottleRange(
      mlModalHerb,
      ml,
      bottleVolumeMl,
      dailyDoseMl
    );

    if (mlModalIndex === null) {
      // add new herb
      setWorkspaceHerbs((prev) => [
        ...prev,
        { herb: mlModalHerb, ml, withinRange },
      ]);
    } else {
      // update existing herb
      setWorkspaceHerbs((prev) =>
        prev.map((item, i) =>
          i === mlModalIndex ? { ...item, ml, withinRange } : item
        )
      );
    }

    setMlModalOpen(false);
    setMlModalHerb(null);
    setMlModalIndex(null);
    setMlModalValue("");
  };

  const handleCloseMlModal = () => {
    setMlModalOpen(false);
    setMlModalHerb(null);
    setMlModalIndex(null);
    setMlModalValue("");
  };

  const roundedTotalWorkspaceMl = Math.round(totalWorkspaceMl);
  const roundedFillPercent = Math.round(bottleFillPercentRaw);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-6xl mx-auto py-10 px-4">
        {/* HEADER */}
        <header className="mb-8">
          <div className="flex items-center justify-between gap-4 mb-2">
            <div>
              <div className="inline-flex items-center gap-2 mb-2">
                <span className="text-[10px] uppercase tracking-[0.18em] bg-[#8ED08133] text-[#4B543B] border border-[#8ED08166] rounded-full px-2 py-0.5">
                  Prototype
                </span>
                {selectedCondition && (
                  <span className="text-[11px] text-slate-500">
                    {selectedCondition.name}
                  </span>
                )}
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-[#4B543B]">
                tonic.
              </h1>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-amber-800 max-w-xl border-l border-amber-300 pl-3 bg-amber-50/60 py-1">
            Educational prototype only. This does not replace individual
            assessment, diagnosis or treatment. Always use clinical judgement
            and follow local regulations.
          </p>
        </header>

        {/* CLIENT DETAILS + TONIC DETAILS + WORKSPACE */}
        <section className="mb-10 grid gap-6 md:grid-cols-3">
          {/* CLIENT DETAILS */}
<div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
  {/* header strip */}
  <div className="flex items-center justify-between bg-[#f2f5ee] px-6 py-4">
  <h2 className="text-base font-semibold text-[#344e41]">
      Client Details
    </h2>
  <span className="text-[11px] tracking-[0.25em] uppercase text-[#a3b18a]">
      Intake
    </span>
  </div>

            <div className="grid gap-3">
              <div>
                <label className="block text-[11px] mb-1 text-slate-700 font-medium">
                  Client Name
                </label>
                <input
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#72b01d66] focus:border-[#72b01d]"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="e.g. Jamie Smith"
                />
              </div>

              <div>
                <label className="block text-[11px] mb-1 text-slate-700 font-medium">
                  Tonic Purpose
                </label>
                <input
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#72b01d66] focus:border-[#72b01d]"
                  value={tonicPurpose}
                  onChange={(e) => setTonicPurpose(e.target.value)}
                  placeholder="e.g. Sleep support, stress, digestion"
                />
              </div>

              <div>
                <label className="block text-[11px] mb-1 text-slate-700 font-medium">
                  Medications
                </label>
                <textarea
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-sm min-h-[60px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#72b01d66] focus:border-[#72b01d]"
                  value={medications}
                  onChange={(e) => setMedications(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[11px] mb-1 text-slate-700 font-medium">
                  Existing Conditions
                </label>
                <textarea
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-sm min-h-[60px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#72b01d66] focus:border-[#72b01d]"
                  value={existingConditionsText}
                  onChange={(e) => setExistingConditionsText(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* TONIC DETAILS */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-wide text-[#8abf9b]">
                Tonic Details
              </h2>
              <span className="text-[10px] uppercase tracking-[0.15em] text-slate-400">
                Prescription
              </span>
            </div>

            <div className="grid gap-3">
              <div>
                <label className="block text-[11px] mb-1 text-slate-700 font-medium">
                  Tonic Name
                </label>
                <input
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#72b01d66] focus:border-[#72b01d]"
                  value={tonicName}
                  onChange={(e) => setTonicName(e.target.value)}
                  placeholder="e.g. Sleep Support Tonic"
                />
              </div>

              {/* Bottle size + dose + frequency */}
              <div className="grid gap-3 md:grid-cols-3 max-w-full">
                <div>
                  <label className="block text-[11px] mb-1 text-slate-700 font-medium">
                    Bottle Size
                  </label>
                  <select
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#72b01d66] focus:border-[#72b01d]"
                    value={bottleSize}
                    onChange={(e) =>
                      setBottleSize(
                        e.target.value as "100" | "200" | "500" | ""
                      )
                    }
                  >
                    <option value="">Size...</option>
                    <option value="100">100 mL</option>
                    <option value="200">200 mL</option>
                    <option value="500">500 mL</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] mb-1 text-slate-700 font-medium">
                    Dose (per serve)
                  </label>
                  <input
                    type="number"
                    min={0}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#72b01d66] focus:border-[#72b01d]"
                    value={doseMl}
                    onChange={(e) => setDoseMl(e.target.value)}
                    placeholder="e.g. 5mL"
                  />
                </div>

                <div>
                  <label className="block text-[11px] mb-1 text-slate-700 font-medium">
                    Frequency per day
                  </label>
                  <input
                    type="number"
                    min={0}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#72b01d66] focus:border-[#72b01d]"
                    value={frequencyPerDay}
                    onChange={(e) => setFrequencyPerDay(e.target.value)}
                    placeholder="e.g. 2 times"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] mb-1 text-slate-700 font-medium">
                  Patient Instructions
                </label>
                <textarea
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-sm min-h-[60px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#72b01d66] focus:border-[#72b01d]"
                  value={patientInstructions}
                  onChange={(e) => setPatientInstructions(e.target.value)}
                  placeholder="e.g. Take 5 mL in water, 2 times daily away from food."
                />
              </div>
            </div>
          </div>

          {/* WORKSPACE */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-wide text-[#8abf9b]">
                Workspace
              </h2>
              <span className="text-[10px] uppercase tracking-[0.15em] text-slate-400">
                Formula
              </span>
            </div>

            <div className="flex items-center gap-4">
              {/* Bottle graphic */}
              <div className="flex flex-col items-center">
                <div className="flex flex-col items-center">
                  {/* Cap */}
                  <div className="h-4 w-10 bg-[#142200] border border-slate-400 rounded-t-md rounded-b-sm" />
                  {/* Neck */}
                  <div className="h-4 w-8 bg-[#142200] border-x border-b border-slate-400" />
                  {/* Bottle body */}
                  <div className="relative h-32 w-16 bg-[#DCE2AA] border border-slate-400 rounded-t-xl rounded-b-3xl overflow-hidden">
                    {/* Liquid fill */}
                    <div
                      className={`absolute bottom-0 left-0 right-0 transition-all duration-300 ease-out ${
                        isOverfilled ? "bg-red-500/80" : "bg-[#72b01d]"
                      }`}
                      style={{ height: `${bottleFillPercent}%` }}
                    />
                    {/* Label band */}
                    <div className="absolute inset-x-1 top-1/2 -translate-y-1/2 h-7 bg-white/90 border border-slate-300 rounded-md flex items-center justify-center px-1">
                      <span className="text-[9px] text-slate-700 truncate text-center">
                        {bottleVolumeMl ? `${bottleVolumeMl} mL` : "Bottle size"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right-hand stats */}
              <div className="text-xs space-y-1">
                <p className="text-slate-800">
                  Total volume:{" "}
                  <span className="font-semibold text-[#4B543B]">
                    {roundedTotalWorkspaceMl} mL
                  </span>
                </p>
                <p className="text-slate-800">
                  Fill:{" "}
                  <span
                    className={`font-semibold ${
                      isOverfilled ? "text-red-600" : "text-[#4B543B]"
                    }`}
                  >
                    {bottleVolumeMl ? `${roundedFillPercent}%` : "—"}
                  </span>
                </p>
                <p className="text-slate-800">
                  Dose:{" "}
                  <span className="font-semibold text-slate-900">
                    {dailyDoseMl > 0
                      ? `${numericDose} mL × ${numericFrequency} times daily`
                      : "—"}
                  </span>
                </p>
                {isOverfilled && (
                  <p className="text-[11px] text-red-600">
                    Overfilled (&gt;{bottleVolumeMl} mL). Adjust volumes.
                  </p>
                )}
              </div>
            </div>

            {/* Workspace Herbs */}
            <div className="mt-2 border-t border-slate-200 pt-3">
              <h3 className="text-[11px] font-semibold text-slate-800 mb-2 uppercase tracking-[0.16em]">
                Herbs in Tonic
              </h3>

              {workspaceHerbs.length === 0 ? (
                <p className="text-[11px] text-slate-500">
                  No herbs yet. Use <b>+ Add</b> in the table below to start
                  building your formula.
                </p>
              ) : (
                <div className="max-h-48 overflow-y-auto pr-3">
                  <table className="w-full text-[11px] border-collapse">
                    <thead className="sticky top-0 bg-slate-100/95 backdrop-blur-sm">
                      <tr>
                        <th className="text-left py-1 pr-2 border-b border-slate-200 text-slate-600 text-[10px] uppercase tracking-[0.14em]">
                          Herb
                        </th>
                        <th className="text-left py-1 px-2 border-b border-slate-200 text-slate-600 text-[10px] uppercase tracking-[0.14em]">
                          mL in bottle
                        </th>
                        <th className="text-left py-1 px-2 border-b border-slate-200 text-slate-600 text-[10px] uppercase tracking-[0.14em]">
                          Therapeutic range for bottle
                        </th>
                        <th className="text-left py-1 pl-2 border-b border-slate-200 text-slate-600 text-[10px] uppercase tracking-[0.14em]">
                          Remove
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {workspaceHerbs.map((item, index) => {
                        const range = computeTherapeuticBottleRange(
                          item.herb,
                          bottleVolumeMl,
                          dailyDoseMl
                        );

                        let rangeLabel = (
                          <span className="text-slate-400">No range</span>
                        );
                        if (range.low != null || range.high != null) {
                          const lowRounded =
                            range.low != null ? Math.ceil(range.low) : null;
                          const highRounded =
                            range.high != null ? Math.ceil(range.high) : null;

                          if (lowRounded != null && highRounded != null) {
                            rangeLabel = (
                              <span>
                                {lowRounded}–{highRounded} mL
                              </span>
                            );
                          } else if (lowRounded != null && highRounded == null) {
                            rangeLabel = (
                              <span>&gt;= {lowRounded} mL</span>
                            );
                          } else if (
                            lowRounded == null &&
                            highRounded != null
                          ) {
                            rangeLabel = (
                              <span>&lt;= {highRounded} mL</span>
                            );
                          }
                        }

                        const roundedMl = Math.round(item.ml);

                        return (
                          <tr
                            key={`${item.herb.id}-${index}`}
                            className={
                              item.withinRange === null
                                ? "bg-slate-50"
                                : item.withinRange
                                ? "bg-[#8ED08133]"
                                : "bg-red-50"
                            }
                          >
                            <td className="py-1 pr-2 align-top">
                              <div className="font-medium text-slate-900">
                                {item.herb.herbName}
                              </div>
                              <div className="italic text-[10px] text-slate-600">
                                {item.herb.latinName}
                              </div>
                            </td>
                            <td className="py-1 px-2 align-top">
                              <button
                                type="button"
                                onClick={() => handleEditWorkspaceHerbMl(index)}
                                className="underline decoration-dotted underline-offset-2 hover:text-[#4B543B]"
                              >
                                {roundedMl} mL
                              </button>
                            </td>
                            <td className="py-1 px-2 align-top">
                              {rangeLabel}
                            </td>
                            <td className="py-1 pl-2 align-top">
                              <button
                                type="button"
                                onClick={() => handleRemoveWorkspaceHerb(index)}
                                className="text-[10px] px-2 py-0.5 rounded-md border border-slate-300 hover:bg-slate-100 text-slate-700"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Dose colour legend */}
              <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-[#8ED081]" />{" "}
                in range
                <span className="inline-block h-2 w-2 rounded-full bg-red-500" />{" "}
                out of range
              </div>
            </div>
          </div>
        </section>

        {/* BODY SYSTEM + CONDITION */}
        <section className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Body System */}
            <div>
              <label className="block text-sm mb-1 text-slate-800">
                Body System
              </label>
              <select
                className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#72b01d66] focus:border-[#72b01d]"
                value={selectedBodySystem}
                onChange={(e) => setSelectedBodySystem(e.target.value)}
              >
                <option value="">Select...</option>
                {bodySystems.map((bs) => (
                  <option key={bs.value} value={bs.value}>
                    {bs.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Health Concern */}
            <div>
              <label className="block text-sm mb-1 text-slate-800">
                Health Concern
              </label>
              <select
                className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#72b01d66] focus:border-[#72b01d] disabled:opacity-50"
                value={selectedConditionId}
                onChange={(e) => setSelectedConditionId(e.target.value)}
                disabled={!selectedBodySystem}
              >
                <option value="">
                  {selectedBodySystem
                    ? "Select..."
                    : "Select body system first..."}
                </option>
                {conditions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* HERB TABLE */}
        {error && (
          <p className="text-sm text-amber-800 mb-4 bg-amber-50 border border-amber-300 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        {loading && (
          <p className="text-sm text-slate-600 mb-4">Loading herbs...</p>
        )}

        {selectedConditionId && herbRows.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white mt-4 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <div className="max-h-[480px] overflow-y-auto pr-3">
                <table className="min-w-full text-xs md:text-sm border-collapse">
                  <thead className="bg-slate-100/95 backdrop-blur-sm sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 border-b border-slate-200 text-left text-slate-700 text-[10px] uppercase tracking-[0.16em]">
                        Herb
                      </th>
                      <th className="px-4 py-3 border-b border-slate-200 text-left text-slate-700 text-[10px] uppercase tracking-[0.16em]">
                        Latin Name
                      </th>
                      <th className="px-4 py-3 border-b border-slate-200 text-left text-slate-700 text-[10px] uppercase tracking-[0.16em]">
                        Action
                      </th>
                      <th className="px-4 py-3 border-b border-slate-200 text-left text-slate-700 text-[10px] uppercase tracking-[0.16em]">
                        Indications
                      </th>
                      <th className="px-4 py-3 border-b border-slate-200 text-left text-slate-700 text-[10px] uppercase tracking-[0.16em]">
                        Energetic Properties
                      </th>
                      <th className="px-4 py-3 border-b border-slate-200 text-left text-slate-700 text-[10px] uppercase tracking-[0.16em]">
                        Safety Precautions
                      </th>
                      <th className="px-4 py-3 border-b border-slate-200 text-left text-slate-700 text-[10px] uppercase tracking-[0.16em]">
                        Therapeutic Dosage (weekly)
                      </th>
                      <th className="px-3 py-3 border-b border-slate-200 w-28 text-left text-slate-700 text-[10px] uppercase tracking-[0.16em]">
                        Workspace
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {herbRows.map((row) => {
                      const inWorkspace = isHerbInWorkspace(row.herbId);

                      return (
                        <tr
                          key={row.id}
                          className="odd:bg-white even:bg-slate-50 hover:bg-slate-100 transition-colors"
                        >
                          {/* Herb cells */}
                          <td
                            className="align-top px-4 py-3 border-b border-slate-200 cursor-pointer text-slate-900"
                            onClick={() => {
                              setSelectedHerb(row);
                              setIsDrawerOpen(true);
                            }}
                          >
                            {row.herbName}
                          </td>
                          <td
                            className="align-top px-4 py-3 border-b border-slate-200 italic text-slate-700 cursor-pointer"
                            onClick={() => {
                              setSelectedHerb(row);
                              setIsDrawerOpen(true);
                            }}
                          >
                            {row.latinName}
                          </td>
                          <td
                            className="align-top px-4 py-3 border-b border-slate-200 cursor-pointer text-slate-800"
                            onClick={() => {
                              setSelectedHerb(row);
                              setIsDrawerOpen(true);
                            }}
                          >
                            {row.actions}
                          </td>
                          <td
                            className="align-top px-4 py-3 border-b border-slate-200 cursor-pointer text-slate-800"
                            onClick={() => {
                              setSelectedHerb(row);
                              setIsDrawerOpen(true);
                            }}
                          >
                            {row.indications}
                          </td>
                          <td
                            className="align-top px-4 py-3 border-b border-slate-200 cursor-pointer text-slate-800"
                            onClick={() => {
                              setSelectedHerb(row);
                              setIsDrawerOpen(true);
                            }}
                          >
                            {row.energeticProperties}
                          </td>
                          <td
                            className="align-top px-4 py-3 border-b border-slate-200 cursor-pointer text-slate-800"
                            onClick={() => {
                              setSelectedHerb(row);
                              setIsDrawerOpen(true);
                            }}
                          >
                            {row.safetyPrecautions}
                          </td>
                          <td
                            className="align-top px-4 py-3 border-b border-slate-200 whitespace-nowrap cursor-pointer text-slate-800"
                            onClick={() => {
                              setSelectedHerb(row);
                              setIsDrawerOpen(true);
                            }}
                          >
                            {formatDose(row)}
                          </td>

                          {/* Workspace column */}
                          <td className="px-3 py-3 border-b border-slate-200">
                            {inWorkspace ? (
                              <button
                                type="button"
                                onClick={() =>
                                  handleRemoveHerbFromTable(row.herbId)
                                }
                                className="text-[11px] px-2 py-1 rounded-md border border-slate-300 bg-white hover:border-[#72b01d80] inline-flex items-center gap-1 text-slate-800"
                              >
                                Remove
                                <span
                                  className="inline-flex items-center justify-center h-4 w-4 rounded-full border border-slate-400 text-[10px] text-slate-600"
                                  title="Herb already added to tonic"
                                >
                                  i
                                </span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleAddHerbToWorkspace(row)}
                                className="text-[11px] px-3 py-1 rounded-md border border-[#72b01d80] bg-[#72b01d] hover:bg-[#6aa318] text-white font-semibold"
                              >
                                + Add
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="px-4 py-2 border-t border-slate-200 text-[11px] text-slate-500 bg-slate-50">
              Prototype data only. Always check current references and clinical
              guidelines.
            </div>
          </div>
        )}

        {selectedConditionId &&
          herbRows.length === 0 &&
          !loading &&
          !error && (
            <p className="text-sm text-slate-600 mt-4">
              No herbs added yet for this concern.
            </p>
          )}
      </div>

      {/* HERB DETAILS SIDE DRAWER */}
      {selectedHerb && (
        <div className="fixed inset-0 z-40 flex justify-end">
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close herb details"
            className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
              isDrawerOpen ? "opacity-100" : "opacity-0"
            }`}
            onClick={closeDrawer}
          />
          {/* Drawer */}
          <div
            className={`relative z-50 w-full max-w-md bg-white border-l border-slate-200 shadow-2xl flex flex-col transform transition-transform duration-300 ease-out ${
              isDrawerOpen ? "translate-x-0" : "translate-x-full"
            }`}
          >
            <div className="flex items-start justify-between px-6 py-4 border-b border-slate-200 bg-white/95">
              <div>
                <p className="text-[10px] text-[#72b01d] tracking-[0.18em] uppercase mb-1">
                  Herb
                </p>
                <p className="text-lg font-semibold text-slate-900">
                  {selectedHerb.herbName}
                </p>
                <p className="italic text-slate-600 text-sm">
                  {selectedHerb.latinName}
                </p>
              </div>
              <button
                type="button"
                onClick={closeDrawer}
                className="ml-4 rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            <div className="px-6 py-4 space-y-4 overflow-y-auto text-sm text-slate-800">
              {selectedHerb.actions && (
                <div>
                  <h4 className="text-[#72b01d] text-[11px] mb-1 tracking-[0.16em] uppercase">
                    Actions
                  </h4>
                  <p className="whitespace-pre-wrap text-slate-900/90">
                    {selectedHerb.actions}
                  </p>
                </div>
              )}

              {selectedHerb.indications && (
                <div>
                  <h4 className="text-[#72b01d] text-[11px] mb-1 tracking-[0.16em] uppercase">
                    Indications
                  </h4>
                  <p className="whitespace-pre-wrap text-slate-900/90">
                    {selectedHerb.indications}
                  </p>
                </div>
              )}

              {selectedHerb.energeticProperties && (
                <div>
                  <h4 className="text-[#72b01d] text-[11px] mb-1 tracking-[0.16em] uppercase">
                    Energetic Properties
                  </h4>
                  <p className="whitespace-pre-wrap text-slate-900/90">
                    {selectedHerb.energeticProperties}
                  </p>
                </div>
              )}

              {selectedHerb.safetyPrecautions && (
                <div>
                  <h4 className="text-[#72b01d] text-[11px] mb-1 tracking-[0.16em] uppercase">
                    Safety Precautions
                  </h4>
                  <p className="whitespace-pre-wrap text-slate-900/90">
                    {selectedHerb.safetyPrecautions}
                  </p>
                </div>
              )}

              {formatDose(selectedHerb) && (
                <div>
                  <h4 className="text-[#72b01d] text-[11px] mb-1 tracking-[0.16em] uppercase">
                    Therapeutic Dosage
                  </h4>
                  <p className="whitespace-pre-wrap text-slate-900/90">
                    {formatDose(selectedHerb)}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* mL ENTRY / EDIT MODAL */}
      {mlModalOpen && mlModalHerb && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div
            className="w-full max-w-sm bg-white rounded-xl border border-slate-200 p-6 shadow-2xl"
            tabIndex={-1}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                handleCloseMlModal();
              }
            }}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleConfirmMlModal();
              }}
            >
              <h3 className="text-lg font-semibold mb-2 text-slate-900">
                {mlModalIndex === null ? "Add Herb to Tonic" : "Edit Herb Volume"}
              </h3>
              <p className="text-sm mb-2 text-slate-700">
                Enter mL for{" "}
                <span className="font-semibold text-slate-900">
                  {mlModalHerb.herbName}
                </span>
                :
              </p>

              {/* Therapeutic range info */}
              {(() => {
                if (!bottleVolumeMl || !dailyDoseMl) {
                  return (
                    <p className="text-[12px] mb-3 text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                      Select bottle size, dose and frequency to calculate the
                      therapeutic range.
                    </p>
                  );
                }
                const range = computeTherapeuticBottleRange(
                  mlModalHerb,
                  bottleVolumeMl,
                  dailyDoseMl
                );
                if (range.low == null && range.high == null) {
                  return null;
                }
                const lowRounded =
                  range.low != null ? Math.ceil(range.low) : null;
                const highRounded =
                  range.high != null ? Math.ceil(range.high) : null;

                let rangeText = "";
                if (lowRounded != null && highRounded != null) {
                  rangeText = `${lowRounded}–${highRounded} mL in bottle`;
                } else if (lowRounded != null && highRounded == null) {
                  rangeText = `≥ ${lowRounded} mL in bottle`;
                } else if (lowRounded == null && highRounded != null) {
                  rangeText = `≤ ${highRounded} mL in bottle`;
                }

                if (!rangeText) return null;

                return (
                  <p className="text-[12px] mb-3 text-slate-700">
                    Therapeutic dosage for{" "}
                    <span className="font-semibold text-slate-900">
                      {bottleVolumeMl} mL
                    </span>{" "}
                    bottle:{" "}
                    <span className="font-semibold text-slate-900">
                      {rangeText}
                    </span>
                  </p>
                );
              })()}

              <input
                type="number"
                className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 mb-4 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#72b01d66] focus:border-[#72b01d] appearance-none"
                placeholder="e.g. 5"
                value={mlModalValue}
                onChange={(e) => setMlModalValue(e.target.value)}
                autoFocus
              />
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseMlModal}
                  className="px-4 py-2 text-sm bg-slate-100 hover:bg-slate-200 rounded-md border border-slate-300 text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-[#72b01d] hover:bg-[#6aa318] rounded-md font-semibold text-white border border-[#72b01d]"
                >
                  Confirm
                </button>
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                Tip: Press <span className="font-semibold">Enter</span> to
                confirm, or <span className="font-semibold">Esc</span> to close.
              </p>
            </form>
          </div>
        </div>
      )}

      {/* BOTTLE CONFIG ERROR MODAL */}
      {bottleConfigErrorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm">
          <div
            className="w-full max-w-sm bg-white rounded-xl border border-red-200 p-6 shadow-2xl"
            tabIndex={-1}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                setBottleConfigErrorOpen(false);
              }
            }}
          >
            <h3 className="text-lg font-semibold mb-2 text-red-700">
              Set bottle &amp; dose first
            </h3>
            <p className="text-sm mb-4 text-slate-800">
              To add herbs to this tonic, please make sure you have:
            </p>
            <ul className="list-disc list-inside text-[13px] text-slate-800 mb-4 space-y-1">
              <li>A bottle size selected</li>
              <li>Dose in mL per serve entered</li>
              <li>Frequency per day set</li>
            </ul>
            <p className="text-[12px] text-slate-600 mb-4">
              Once these are set, the therapeutic dosage for each herb will be
              calculated correctly for this bottle.
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setBottleConfigErrorOpen(false)}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-500 rounded-md font-semibold text-white border border-red-500/80"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
