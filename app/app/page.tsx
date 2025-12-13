"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { supabase } from "@/lib/supabaseClient";
import jsPDF from "jspdf"; // npm install jspdf
import AuthButton from "@/components/AuthButton";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";


type BodySystemOption = {
  value: string;
  label: string;
};

type Condition = {
  id: string;
  name: string;
  is_free: boolean;
};

type Plan = "free" | "paid";

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
  doseMinMl: number | null; // therapeutic range LOW for a 100 mL bottle
  doseMaxMl: number | null; // therapeutic range HIGH for a 100 mL bottle
  doseUnit: string | null;

  therapeuticDosage: string | null; // original text if present
};

type WorkspaceHerb = {
  herb: HerbRow;
  ml: number; // mL of this herb in the bottle
  withinRange: boolean | null;
};

type SavedTonic = {
  id: string;
  tonicName: string;
  bottleSize: "100" | "200" | "500" | "";
  doseMl: string;
  frequencyPerDay: string;
  workspaceHerbs: WorkspaceHerb[];
  clientName: string;
  tonicPurpose: string;
  medications: string;
  existingConditionsText: string;
  patientInstructions: string;
};

type PendingLockedCondition = {
  id: string;
  name?: string;
  returnTo?: string;
};

const TONIC_STORAGE_KEY = "tonic_current";
const RESUME_TO_HERBAL_TABLE_KEY = "tonic_resume_to_herbal_table";


// ✅ local plan + pending lock keys
const PLAN_KEY = "tonic_plan"; // "free" | "paid"
const PENDING_LOCKED_CONDITION_KEY = "tonic_pending_locked_condition";

// ✅ your “make me paid” email override (Google OAuth)
const PAID_EMAIL_OVERRIDE = "nzraphiphop@gmail.com";

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

/**
 * Compute the therapeutic range in mL for THIS bottle, for a given herb.
 *
 * IMPORTANT: dose_min_ml and dose_max_ml are stored as the range for a 100 mL bottle.
 * We scale linearly by bottle size, so:
 *  - 100 mL bottle: range = min–max
 *  - 200 mL bottle: range = 2×min–2×max
 *  - 500 mL bottle: range = 5×min–5×max
 */
function computeTherapeuticBottleRange(
  row: HerbRow,
  bottleVolumeMl: number,
  _dailyDoseMl: number // kept in signature for compatibility, but ignored
): { low: number | null; high: number | null } {
  if (!bottleVolumeMl) {
    return { low: null, high: null };
  }

  const min = row.doseMinMl;
  const max = row.doseMaxMl;

  if (min == null && max == null) {
    return { low: null, high: null };
  }

  const scaleFactor = bottleVolumeMl / 100; // base is 100 mL bottle

  const low = min != null ? min * scaleFactor : null;
  const high = max != null ? max * scaleFactor : null;

  return { low, high };
}

/**
 * Determine if a given herb volume in the bottle is within the computed
 * therapeutic range for that bottle configuration.
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
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace("/login");
    });
  }, [router]);

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

  const [tonicName, setTonicName] = useState("");
  const [patientInstructions, setPatientInstructions] = useState("");

  const [bottleSize, setBottleSize] = useState<"100" | "200" | "500" | "">("");
  const [doseMl, setDoseMl] = useState<string>("");
  const [frequencyPerDay, setFrequencyPerDay] = useState<string>("");

  const [workspaceHerbs, setWorkspaceHerbs] = useState<WorkspaceHerb[]>([]);

  const [currentTonicId, setCurrentTonicId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">(
    "idle"
  );

  // ✅ Plan state (defaults free)
  const [plan, setPlan] = useState<Plan>("free");

  // ✅ CTA modal state (locked condition)
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [lockedChoice, setLockedChoice] = useState<Condition | null>(null);

  // ✅ IMPORTANT: syncingPlan state (fixes your runtime error)
  const [syncingPlan, setSyncingPlan] = useState(false);

  // helper: mark form as having unsaved changes
  const markUnsaved = () => {
    setSaveStatus("idle");
  };

  // mL modal state
  const [mlModalOpen, setMlModalOpen] = useState(false);
  const [mlModalHerb, setMlModalHerb] = useState<HerbRow | null>(null);
  const [mlModalIndex, setMlModalIndex] = useState<number | null>(null);
  const [mlModalValue, setMlModalValue] = useState<string>("");

  const [bottleConfigErrorOpen, setBottleConfigErrorOpen] = useState(false);

  const [isExpandedView, setIsExpandedView] = useState(false);
  const [isFullScreenTable, setIsFullScreenTable] = useState(false);
  const [isWorkspaceDrawerOpen, setIsWorkspaceDrawerOpen] = useState(false);

  const closeDrawer = () => {
    setIsDrawerOpen(false);
    setTimeout(() => setSelectedHerb(null), 200);
  };

  const selectedCondition = conditions.find((c) => c.id === selectedConditionId);

  // Bottle / volume calculations
  const bottleVolumeMl = bottleSize ? Number(bottleSize) : 0;
  const numericDose = doseMl ? Math.round(Number(doseMl)) : 0;
  const numericFrequency = frequencyPerDay ? Math.round(Number(frequencyPerDay)) : 0;

  const dailyDoseMl =
    numericDose > 0 && numericFrequency > 0 ? numericDose * numericFrequency : 0;

  const totalWorkspaceMl = workspaceHerbs.reduce((s, i) => s + i.ml, 0);
  const bottleFillPercentRaw =
    bottleVolumeMl === 0 ? 0 : (totalWorkspaceMl / bottleVolumeMl) * 100;
  const bottleFillPercent = Math.min(100, Math.max(0, bottleFillPercentRaw));
  const isOverfilled = bottleVolumeMl > 0 && totalWorkspaceMl > bottleVolumeMl;
  const remainingMl =
    bottleVolumeMl > 0 ? Math.max(bottleVolumeMl - totalWorkspaceMl, 0) : 0;
  const roundedRemainingMl = Math.round(remainingMl);

  const isHerbInWorkspace = (herbId: string) =>
    workspaceHerbs.some((item) => item.herb.herbId === herbId);

  const ensureTonicId = () => {
    if (!currentTonicId) {
      setCurrentTonicId(crypto.randomUUID());
    }
  };

  // ✅ Load user plan (localStorage first + email override + profiles fallback)
  useEffect(() => {
  if (typeof window === "undefined") return;

  const localPlan = localStorage.getItem(PLAN_KEY);
  if (localPlan === "paid" || localPlan === "free") {
    setPlan(localPlan);
  }
}, []);

  useEffect(() => {
  const loadPlan = async () => {
    // ✅ 1) DEV / local override first
    if (typeof window !== "undefined") {
      const localPlan = localStorage.getItem(PLAN_KEY);
      if (localPlan === "paid" || localPlan === "free") {
        setPlan(localPlan);
        if (localPlan === "paid") return; // if paid locally, stop here
      }
    }

    // ✅ 2) Normal auth + email override
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr) return;

    const user = userRes.user;
    if (!user) return;

    const email = (user.email ?? "").toLowerCase();

    if (email === PAID_EMAIL_OVERRIDE.toLowerCase()) {
      setPlan("paid");
      if (typeof window !== "undefined") localStorage.setItem(PLAN_KEY, "paid");
      return;
    }

    // ✅ 3) Server profile plan (if you have it)
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("plan")
        .eq("id", user.id)
        .maybeSingle();

      if (!error && (data?.plan === "paid" || data?.plan === "free")) {
        setPlan(data.plan);
        if (typeof window !== "undefined") localStorage.setItem(PLAN_KEY, data.plan);
      }
    } catch {
      // ignore
    }
  };

  loadPlan();
}, []);


  // ✅ Resume after upgrade (reads pending locked condition + opens overlay + selects it)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const run = async () => {
      const localPlan = localStorage.getItem(PLAN_KEY);
      const effectivePlan: Plan = localPlan === "paid" ? "paid" : plan;
      if (effectivePlan !== "paid") return;

      const raw = localStorage.getItem(PENDING_LOCKED_CONDITION_KEY);
      if (!raw) return;

      let pending: PendingLockedCondition | null = null;
      try {
        pending = JSON.parse(raw);
      } catch {
        pending = null;
      }

      if (!pending?.id) return;

      // open overlay
      setIsFullScreenTable(true);

      // set body system first (nice UX)
      try {
        const { data, error } = await supabase
          .from("conditions")
          .select("body_system")
          .eq("id", pending.id)
          .maybeSingle();

        if (!error && data?.body_system) {
          setSelectedBodySystem(data.body_system);
        }
      } catch {
        // ignore
      }

      // select condition
      setSelectedConditionId(pending.id);

      // cleanup
      localStorage.removeItem(PENDING_LOCKED_CONDITION_KEY);
      setUpgradeModalOpen(false);
      setLockedChoice(null);
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ used by CTA modal “Already paid? Sync”
  const syncPlanFromServer = async (): Promise<Plan> => {
    if (typeof window !== "undefined") {
  const localPlan = localStorage.getItem(PLAN_KEY);
  if (localPlan === "paid") {
    setPlan("paid");
    return "paid";
  }
}
    setSyncingPlan(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes.user;
      if (!user) return plan;

      const email = (user.email ?? "").toLowerCase();
      if (email === PAID_EMAIL_OVERRIDE.toLowerCase()) {
        setPlan("paid");
        if (typeof window !== "undefined") localStorage.setItem(PLAN_KEY, "paid");
        return "paid";
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("plan")
        .eq("id", user.id)
        .maybeSingle();

      if (!error && data?.plan && (data.plan === "paid" || data.plan === "free")) {
        setPlan(data.plan);
        if (typeof window !== "undefined") localStorage.setItem(PLAN_KEY, data.plan);
        return data.plan;
      }
      return plan;
    } finally {
      setSyncingPlan(false);
    }
  };

  // ✅ handle condition change with lock interception (stores pending lock)
  const handleConditionChange = (nextId: string) => {
    if (!nextId) {
      setSelectedConditionId("");
      return;
    }

    const chosen = conditions.find((c) => c.id === nextId);
    if (!chosen) {
      setSelectedConditionId(nextId);
      return;
    }

    const locked = plan === "free" && !chosen.is_free;

    if (locked) {
      if (typeof window !== "undefined") {
        localStorage.setItem(
          PENDING_LOCKED_CONDITION_KEY,
          JSON.stringify({
            id: chosen.id,
            name: chosen.name,
            returnTo: "/",
          } satisfies PendingLockedCondition)
        );
      }

      setLockedChoice(chosen);
      setUpgradeModalOpen(true);
      return; // IMPORTANT: do not setSelectedConditionId
    }

    setSelectedConditionId(nextId);
  };

  // Load saved tonic from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(TONIC_STORAGE_KEY);
    if (!stored) return;

    try {
      const saved: SavedTonic = JSON.parse(stored);

      setCurrentTonicId(saved.id || null);
      setTonicName(saved.tonicName ?? "");
      setBottleSize(saved.bottleSize ?? "");
      setDoseMl(saved.doseMl ?? "");
      setFrequencyPerDay(saved.frequencyPerDay ?? "");
      setWorkspaceHerbs(saved.workspaceHerbs ?? []);
      setClientName(saved.clientName ?? "");
      setTonicPurpose(saved.tonicPurpose ?? "");
      setMedications(saved.medications ?? "");
      setExistingConditionsText(saved.existingConditionsText ?? "");
      setPatientInstructions(saved.patientInstructions ?? "");

      // loaded state is synced with last saved
      setSaveStatus("saved");
    } catch (e) {
      console.error("Failed to parse tonic from storage", e);
    }
  }, []);

  // Recompute withinRange when bottle size / dose change
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

      const unique = Array.from(new Set((data ?? []).map((r: any) => r.body_system))).sort();
      setBodySystems(unique.map((v) => ({ value: v, label: v })));
    };

    fetchBodySystems();
  }, []);

  // LOAD CONDITIONS (✅ now always loads all, we lock in UI)
  useEffect(() => {
    if (!selectedBodySystem) {
      setConditions([]);
      setSelectedConditionId("");
      setHerbRows([]);
      return;
    }

    const load = async () => {
      const { data, error } = await supabase
        .from("conditions")
        .select("id, name, is_free")
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
    };

    load();
  }, [selectedBodySystem]);

  // LOAD HERBS
  useEffect(() => {
    if (!selectedConditionId) {
      setHerbRows([]);
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
        })) ?? [];

      setHerbRows(rows.sort((a, b) => a.herbName.localeCompare(b.herbName)));
    };

    load();
  }, [selectedConditionId]);

  // workspace handlers
  const handleAddHerbToWorkspace = (herb: HerbRow) => {
    // ✅ Add herb should ONLY open the mL modal (not the workspace drawer)
    if (isHerbInWorkspace(herb.herbId)) return;

    if (!bottleVolumeMl || !dailyDoseMl) {
      setBottleConfigErrorOpen(true);
      return;
    }

    setMlModalHerb(herb);
    setMlModalIndex(null);
    setMlModalValue("");
    setMlModalOpen(true);
  };

  const handleRemoveWorkspaceHerb = (index: number) => {
    markUnsaved();
    setWorkspaceHerbs((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRemoveHerbFromTable = (herbId: string) => {
    markUnsaved();
    setWorkspaceHerbs((prev) => prev.filter((item) => item.herb.herbId !== herbId));
  };

  const handleEditWorkspaceHerbMl = (index: number) => {
    const current = workspaceHerbs[index];
    if (!current) return;
    setMlModalHerb(current.herb);
    setMlModalIndex(index);
    setMlModalValue(String(current.ml));
    setMlModalOpen(true);
  };

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

    // any change to workspace => unsaved
    markUnsaved();

    if (mlModalIndex === null) {
      setWorkspaceHerbs((prev) => [...prev, { herb: mlModalHerb, ml, withinRange }]);
    } else {
      setWorkspaceHerbs((prev) =>
        prev.map((item, i) => (i === mlModalIndex ? { ...item, ml, withinRange } : item))
      );
    }

    setMlModalOpen(false);
    setMlModalHerb(null);
    setMlModalIndex(null);
    setMlModalValue("");

    // ✅ make the drawer feel “alive” (works on main + overlay)
    setIsWorkspaceDrawerOpen(true);
  };

  const handleCloseMlModal = () => {
    setMlModalOpen(false);
    setMlModalHerb(null);
    setMlModalIndex(null);
    setMlModalValue("");
  };

  // tonic-level handlers (Create/Edit, Save, Reset, Export)
  const handleCreateOrEditTonic = () => {
    if (!currentTonicId) {
      const newId = crypto.randomUUID();
      setCurrentTonicId(newId);
    }
    // open the herbal data table (not the workspace drawer)
    setIsFullScreenTable(true);
    setIsWorkspaceDrawerOpen(false);
  };

  const handleSaveTonic = () => {
    if (typeof window === "undefined") return;

    try {
      const id = currentTonicId ?? crypto.randomUUID();
      const tonicToSave: SavedTonic = {
        id,
        tonicName,
        bottleSize,
        doseMl,
        frequencyPerDay,
        workspaceHerbs,
        clientName,
        tonicPurpose,
        medications,
        existingConditionsText,
        patientInstructions,
      };

      localStorage.setItem(TONIC_STORAGE_KEY, JSON.stringify(tonicToSave));
      setCurrentTonicId(id);
      setSaveStatus("saved");
    } catch (e) {
      console.error("Failed to save tonic", e);
      setSaveStatus("error");
    }
  };

  const handleResetTonic = () => {
    // Clear all client + tonic fields + workspace herbs
    setClientName("");
    setTonicPurpose("");
    setMedications("");
    setExistingConditionsText("");
    setTonicName("");
    setPatientInstructions("");
    setBottleSize("");
    setDoseMl("");
    setFrequencyPerDay("");
    setWorkspaceHerbs([]);
    setSaveStatus("idle");

    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(TONIC_STORAGE_KEY);
      } catch (e) {
        console.error("Failed to clear saved tonic", e);
      }
    }

    setCurrentTonicId(null);
  };

  const handleExportTonic = () => {
    if (!workspaceHerbs.length) {
      window.alert("No herbs in tonic to export.");
      return;
    }

    const doc = new jsPDF();
    const marginLeft = 14;
    let cursorY = 16;
    const lineHeight = 6;
    const maxWidth = 180;

    const addTitle = (text: string) => {
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text(text, marginLeft, cursorY);
      cursorY += lineHeight + 2;
    };

    const addSubheading = (text: string) => {
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(text, marginLeft, cursorY);
      cursorY += lineHeight;
    };

    const addLine = (text: string) => {
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(text, maxWidth);
      lines.forEach((line: string) => {
        if (cursorY > 280) {
          doc.addPage();
          cursorY = 16;
        }
        doc.text(line, marginLeft, cursorY);
        cursorY += lineHeight;
      });
    };

    const addBlank = (amount = 1) => {
      cursorY += lineHeight * amount;
    };

    addTitle(`Tonic export – ${tonicName || "Untitled tonic"}`);

    // Client details
    addSubheading("Client details");
    addLine(`Client name: ${clientName || "-"}`);
    addLine(`Tonic purpose: ${tonicPurpose || "-"}`);
    addLine(`Medications: ${medications || "-"}`);
    addLine(`Existing conditions: ${existingConditionsText || "-"}`);
    addBlank();

    // Tonic details
    addSubheading("Tonic details");
    addLine(`Tonic name: ${tonicName || "-"}`);
    addLine(`Bottle size: ${bottleVolumeMl ? `${bottleVolumeMl} mL` : "Not set"}`);
    addLine(
      `Dose: ${
        dailyDoseMl > 0
          ? `${numericDose} mL x ${numericFrequency} times daily`
          : "Not set"
      }`
    );
    addLine(
      `Notes: ${patientInstructions ? patientInstructions.replace(/\s+/g, " ") : "-"}`
    );
    addBlank();

    // Workspace bottle overview
    addSubheading("Bottle overview");
    addLine(`Total volume in bottle: ${Math.round(totalWorkspaceMl)} mL`);
    addLine(`Fill: ${bottleVolumeMl ? `${Math.round(bottleFillPercentRaw)}%` : "—"}`);
    addLine(
      `Remaining to fill: ${bottleVolumeMl ? `${roundedRemainingMl} mL` : "—"}`
    );
    addLine(
      `Overfilled: ${
        isOverfilled && bottleVolumeMl ? `Yes (> ${bottleVolumeMl} mL)` : "No"
      }`
    );
    addBlank();

    // Herbs
    addSubheading("Herbs in tonic");

    workspaceHerbs.forEach((item, idx) => {
      const h = item.herb;
      if (cursorY > 260) {
        doc.addPage();
        cursorY = 16;
      }
      addLine(`#${idx + 1} – ${h.herbName} (${h.latinName || "no latin name"})`);
      addLine(`Amount in bottle: ${Math.round(item.ml)} mL`);

      const range = computeTherapeuticBottleRange(h, bottleVolumeMl, dailyDoseMl);
      let rangeString = "No range";
      if (range.low != null || range.high != null) {
        const lowRounded = range.low != null ? Math.ceil(range.low) : null;
        const highRounded = range.high != null ? Math.ceil(range.high) : null;

        if (lowRounded != null && highRounded != null) {
          rangeString = `${lowRounded}–${highRounded} mL in bottle`;
        } else if (lowRounded != null && highRounded == null) {
          rangeString = `≥ ${lowRounded} mL in bottle`;
        } else if (lowRounded == null && highRounded != null) {
          rangeString = `≤ ${highRounded} mL in bottle`;
        }
      }
      addLine(`Therapeutic range (this bottle): ${rangeString}`);
      addLine(`Ratio / weekly dose: ${formatDose(h) || "-"}`);
      addLine(`Actions: ${h.actions ? h.actions.replace(/\s+/g, " ") : "-"}`);
      addLine(
        `Indications: ${h.indications ? h.indications.replace(/\s+/g, " ") : "-"}`
      );
      addLine(
        `Energetics: ${
          h.energeticProperties ? h.energeticProperties.replace(/\s+/g, " ") : "-"
        }`
      );
      addLine(
        `Safety: ${h.safetyPrecautions ? h.safetyPrecautions.replace(/\s+/g, " ") : "-"}`
      );
      addBlank();
    });

    const filename =
      (tonicName || clientName || "tonic").replace(/[^\w\-]+/g, "_") + ".pdf";
    doc.save(filename);
  };

  const roundedFillPercent = Math.round(bottleFillPercentRaw);

  const truncatedStyle: CSSProperties | undefined = !isExpandedView
    ? { maxHeight: "3.5rem", overflow: "hidden" }
    : undefined;

  const renderHerbTable = () => (
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
          <th className="px-3 py-3 border-b border-slate-200 w-28 text-left text-[#4B543B] text-[10px] uppercase tracking-[0.16em] whitespace-normal leading-tight">
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
              className="odd:bg-white/80 even:bg-[#F7F8F3]/80 hover:bg-[#EDEFE6] transition-colors"
            >
              <td
                className="align-top px-4 py-3 border-b border-slate-200 cursor-pointer text-slate-900 text-[11px]"
                onClick={() => {
                  setSelectedHerb(row);
                  setIsDrawerOpen(true);
                }}
              >
                {row.herbName}
              </td>

              <td
                className="align-top px-4 py-3 border-b border-slate-200 italic text-slate-700 cursor-pointer text-[11px]"
                onClick={() => {
                  setSelectedHerb(row);
                  setIsDrawerOpen(true);
                }}
              >
                {row.latinName}
              </td>

              <td
                className="align-top px-4 py-3 border-b border-slate-200 cursor-pointer text-slate-800 text-[11px]"
                onClick={() => {
                  setSelectedHerb(row);
                  setIsDrawerOpen(true);
                }}
              >
                <div
                  className="break-words leading-snug"
                  style={truncatedStyle}
                  title={row.actions ?? ""}
                >
                  {row.actions}
                </div>
              </td>

              <td
                className="align-top px-4 py-3 border-b border-slate-200 cursor-pointer text-slate-800 text-[11px]"
                onClick={() => {
                  setSelectedHerb(row);
                  setIsDrawerOpen(true);
                }}
              >
                <div
                  className="break-words leading-snug"
                  style={truncatedStyle}
                  title={row.indications ?? ""}
                >
                  {row.indications}
                </div>
              </td>

              <td
                className="align-top px-4 py-3 border-b border-slate-200 cursor-pointer text-slate-800 text-[11px]"
                onClick={() => {
                  setSelectedHerb(row);
                  setIsDrawerOpen(true);
                }}
              >
                <div
                  className="break-words leading-snug"
                  style={truncatedStyle}
                  title={row.energeticProperties ?? ""}
                >
                  {row.energeticProperties}
                </div>
              </td>

              <td
                className="align-top px-4 py-3 border-b border-slate-200 cursor-pointer text-slate-800 text-[11px]"
                onClick={() => {
                  setSelectedHerb(row);
                  setIsDrawerOpen(true);
                }}
              >
                <div
                  className="break-words leading-snug"
                  style={truncatedStyle}
                  title={row.safetyPrecautions ?? ""}
                >
                  {row.safetyPrecautions}
                </div>
              </td>

              <td
                className="align-top px-4 py-3 border-b border-slate-200 cursor-pointer text-slate-800 text-[11px]"
                onClick={() => {
                  setSelectedHerb(row);
                  setIsDrawerOpen(true);
                }}
              >
                {formatDose(row)}
              </td>

              <td className="px-3 py-3 border-b border-slate-200 text-[11px]">
                {inWorkspace ? (
                  <button
                    type="button"
                    onClick={() => handleRemoveHerbFromTable(row.herbId)}
                    className="text-[11px] px-2 py-1 rounded-full border border-slate-300 bg-white/80 hover:border-[#72b01d80] inline-flex items-center gap-1 text-slate-800"
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
                    className="text-[10px] px-3 py-1 rounded-full border border-[#72b01d80] bg-[#72B01D] hover:bg-[#6AA318] text-white"
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
  );
  return (
    <>
      {/* TOP NAV / HEADER */}
      <header className="fixed top-0 inset-x-0 z-40 h-[60px] bg-white/40 backdrop-blur-md border-b border-white/60 shadow-sm">
        <div className="max-w-6xl mx-auto h-full px-4 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-xl bg-[#142200] flex items-center justify-center text-white text-xs font-semibold shadow-sm">
              t
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold tracking-tight text-[#2E332B]">
                tonic.
              </span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-[#7D8472]">
                Herbal workspace
              </span>
            </div>
          </div>

          {/* Nav + Auth */}
          <div className="flex items-center gap-3">
            <nav className="flex items-center gap-4 text-[11px] text-[#4B543B]">
              <a
                href="https://tonic.example/home"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full hover:bg-white/60"
              >
                <span className="text-xs">🏠</span>
                <span>Home</span>
              </a>
              <a
                href="https://tonic.example/workspace"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[#2E332B] text-white shadow-sm"
              >
                <span className="text-xs">🧪</span>
                <span>Workspace</span>
              </a>
              <a
                href="https://tonic.example/herbs"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full hover:bg-white/60"
              >
                <span className="text-xs">🌿</span>
                <span>Herbs</span>
              </a>
              <a
                href="https://tonic.example/clients"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full hover:bg-white/60"
              >
                <span className="text-xs">👥</span>
                <span>Clients</span>
              </a>
              <a
                href="https://tonic.example/settings"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full hover:bg-white/60"
              >
                <span className="text-xs">⚙️</span>
                <span>Settings</span>
              </a>
            </nav>

            <Link
              href="/profile"
              className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm backdrop-blur hover:bg-white/15"
            >
              Profile
            </Link>

            <AuthButton />
          </div>
        </div>
      </header>

      <main
        className={`min-h-screen bg-[#F7F8F3] text-slate-900 pt-20 ${
          isFullScreenTable ? "overflow-hidden" : ""
        }`}
      >
        <div className="max-w-6xl mx-auto py-10 px-4">
          {/* MAIN 3 CARDS */}
          <section className="mb-10 grid gap-6 md:grid-cols-3 items-start">
            {/* CLIENT DETAILS */}
            <div className="rounded-2xl border border-white/50 bg-white/80 backdrop-blur-lg p-4 space-y-4 shadow-lg shadow-black/5 h-[420px]">
              <div className="flex items-center justify-between">
                <h2 className="text-[13px] font-semibold tracking-wide text-[#4B543B]">
                  Client details
                </h2>
                <span className="text-[10px] uppercase tracking-[0.15em] text-[#7D8472]">
                  Intake
                </span>
              </div>

              <div className="grid gap-3">
                <div>
                  <label className="block text-[10px] mb-1 text-slate-700 font-medium">
                    Client name
                  </label>
                  <input
                    className="w-full bg-white/70 border border-slate-200 rounded-md px-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#72B01D66] focus:border-[#72B01D]"
                    value={clientName}
                    onChange={(e) => {
                      markUnsaved();
                      setClientName(e.target.value);
                    }}
                    placeholder=""
                  />
                </div>

                <div>
                  <label className="block text-[10px] mb-1 text-slate-700 font-medium">
                    Tonic purpose
                  </label>
                  <input
                    className="w-full bg-white/70 border border-slate-200 rounded-md px-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#72B01D66] focus:border-[#72B01D]"
                    value={tonicPurpose}
                    onChange={(e) => {
                      markUnsaved();
                      setTonicPurpose(e.target.value);
                    }}
                    placeholder=""
                  />
                </div>

                <div>
                  <label className="block text-[10px] mb-1 text-slate-700 font-medium">
                    Medications
                  </label>
                  <textarea
                    className="w-full bg-white/70 border border-slate-200 rounded-md px-3 py-2 text-[13px] min-h-[60px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#72B01D66] focus:border-[#72B01D]"
                    value={medications}
                    onChange={(e) => {
                      markUnsaved();
                      setMedications(e.target.value);
                    }}
                    placeholder=""
                  />
                </div>

                <div>
                  <label className="block text-[10px] mb-1 text-slate-700 font-medium">
                    Existing conditions
                  </label>
                  <textarea
                    className="w-full bg-white/70 border border-slate-200 rounded-md px-3 py-2 text-[13px] min-h-[60px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#72B01D66] focus:border-[#72B01D]"
                    value={existingConditionsText}
                    onChange={(e) => {
                      markUnsaved();
                      setExistingConditionsText(e.target.value);
                    }}
                  />
                </div>
              </div>
            </div>

            {/* TONIC DETAILS */}
            <div className="rounded-2xl border border-white/50 bg-white/80 backdrop-blur-lg p-4 space-y-4 shadow-lg shadow-black/5 h-[420px]">
              <div className="flex items-center justify-between">
                <h2 className="text-[13px] font-semibold tracking-wide text-[#4B543B]">
                  Tonic details
                </h2>
                <span className="text-[10px] uppercase tracking-[0.15em] text-[#7D8472]">
                  Prescription
                </span>
              </div>

              <div className="grid gap-3">
                <div>
                  <label className="block text-[10px] mb-1 text-slate-700 font-medium">
                    Tonic name
                  </label>
                  <input
                    className="w-full bg-white/70 border border-slate-200 rounded-md px-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#72B01D66] focus:border-[#72B01D]"
                    value={tonicName}
                    onChange={(e) => {
                      markUnsaved();
                      setTonicName(e.target.value);
                    }}
                    placeholder=""
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-3 max-w-full">
                  <div>
                    <label className="block text-[10px] mb-1 text-slate-700 font-medium">
                      Bottle size
                    </label>
                    <select
                      className={`w-full bg-white/70 border border-slate-200 rounded-md px-3 py-2 text-[13px]
                        focus:outline-none focus:ring-1 focus:ring-[#72B01D66] focus:border-[#72B01D]
                        ${bottleSize === "" ? "text-slate-400" : "text-slate-900"}`}
                      value={bottleSize}
                      onChange={(e) => {
                        markUnsaved();
                        setBottleSize(e.target.value as "100" | "200" | "500" | "");
                      }}
                    >
                      <option value="" disabled>
                        Size...
                      </option>
                      <option value="100">100 mL</option>
                      <option value="200">200 mL</option>
                      <option value="500">500 mL</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] mb-1 text-slate-700 font-medium">
                      Dose (per serve)
                    </label>
                    <input
                      type="number"
                      min={0}
                      className="w-full bg-white/70 border border-slate-200 rounded-md px-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#72B01D66] focus:border-[#72B01D]"
                      value={doseMl}
                      onChange={(e) => {
                        markUnsaved();
                        setDoseMl(e.target.value);
                      }}
                      placeholder=""
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] mb-1 text-slate-700 font-medium">
                      Frequency per day
                    </label>
                    <input
                      type="number"
                      min={0}
                      className="w-full bg-white/70 border border-slate-200 rounded-md px-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#72B01D66] focus:border-[#72B01D]"
                      value={frequencyPerDay}
                      onChange={(e) => {
                        markUnsaved();
                        setFrequencyPerDay(e.target.value);
                      }}
                      placeholder=""
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] mb-1 text-slate-700 font-medium">
                    Notes
                  </label>
                  <textarea
                    className="w-full bg-white/70 border border-slate-200 rounded-md px-3 py-2 text-[13px] min-h-[60px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#72B01D66] focus:border-[#72B01D]"
                    value={patientInstructions}
                    onChange={(e) => {
                      markUnsaved();
                      setPatientInstructions(e.target.value);
                    }}
                    placeholder=""
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end">
                <div className="flex flex-col items-end gap-2">
                  <button
                    type="button"
                    onClick={handleCreateOrEditTonic}
                    className="px-3 py-1 text-[10px] font-semibold rounded-full border border-[#72B01D80] bg-[#7dc95e] hover:bg-[#6AA318] text-white tracking-[0.08em] uppercase"
                  >
                    {currentTonicId ? "Edit bottle" : "Create"}
                  </button>

                  <div className="flex gap-2 flex-wrap justify-end">
                    <button
                      type="button"
                      onClick={handleExportTonic}
                      disabled={workspaceHerbs.length === 0}
                      className="px-3 py-1 text-[10px] font-semibold rounded-full border border-slate-200 bg-white text-slate-800 tracking-[0.08em] uppercase disabled:opacity-40 hover:bg-slate-50"
                    >
                      Export
                    </button>

                    <button
                      type="button"
                      onClick={handleSaveTonic}
                      disabled={workspaceHerbs.length === 0}
                      className="px-3 py-1 text-[10px] font-semibold rounded-full border border-[#2E332B33] bg-white text-[#2E332B] tracking-[0.08em] uppercase disabled:opacity-40 hover:bg-slate-50"
                    >
                      Save
                    </button>

                    <button
                      type="button"
                      onClick={handleResetTonic}
                      disabled={
                        !currentTonicId && workspaceHerbs.length === 0 && !clientName && !tonicName
                      }
                      className="px-3 py-1 text-[10px] font-semibold rounded-full border border-slate-200 bg-white text-slate-700 tracking-[0.08em] uppercase disabled:opacity-40 hover:bg-slate-50"
                    >
                      Reset
                    </button>
                  </div>

                  <div className="mt-1 text-[10px]">
                    {saveStatus === "saved" && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[#E4F4D9] text-[#355925] border border-[#9ACC77]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#3B7C1E]" />
                        All changes saved
                      </span>
                    )}

                    {saveStatus === "error" && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-50 text-red-700 border border-red-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                        Save failed – check browser storage
                      </span>
                    )}

                    {saveStatus === "idle" && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-pulse" />
                        Unsaved changes
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* WORKSPACE CARD */}
            <div className="rounded-2xl border border-white/50 bg-white/80 backdrop-blur-lg p-4 space-y-4 shadow-lg shadow-black/5 flex flex-col min-h-[420px]">
              <div className="flex items-center justify-between">
                <h2 className="text-[13px] font-semibold tracking-wide text-[#4B543B]">
                  Workspace bottle
                </h2>
                <span className="text-[10px] uppercase tracking-[0.15em] text-[#7D8472]">
                  Formula
                </span>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex flex-col items-center">
                  <div className="flex flex-col items-center">
                    <div className="h-4 w-10 bg-[#142200]" />
                    <div className="h-4 w-8 bg-[#142200]" />
                    <div className="relative h-32 w-16 bg-[#142200] rounded-t-xl rounded-b-3xl overflow-hidden">
                      <div
                        className={`absolute bottom-0 left-0 right-0 transition-all duration-300 ease-out ${
                          isOverfilled ? "bg-red-500/80" : "bg-[#72B01D]"
                        }`}
                        style={{ height: `${bottleFillPercent}%` }}
                      />
                      <div className="absolute inset-x-1 top-1/2 -translate-y-1/2 h-7 bg-white/90 border border-slate-300 rounded-md flex items-center justify-center px-1">
                        <span className="text-[9px] text-slate-700 truncate text-center">
                          {bottleVolumeMl ? `${bottleVolumeMl} mL` : "Bottle mL"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-[11px] space-y-1">
                  <p className="text-slate-800">
                    Total volume:{" "}
                    <span className="font-semibold text-[#4B543B]">
                      {Math.round(totalWorkspaceMl)} mL
                    </span>
                  </p>
                  <p className="text-slate-800">
                    Fill:{" "}
                    <span className={`font-semibold ${isOverfilled ? "text-red-600" : "text-[#4B543B]"}`}>
                      {bottleVolumeMl ? `${roundedFillPercent}%` : "—"}
                    </span>
                  </p>
                  <p className="text-slate-800">
                    Dose:{" "}
                    <span className="font-semibold text-slate-900">
                      {dailyDoseMl > 0 ? `${numericDose} mL × ${numericFrequency} times daily` : "—"}
                    </span>
                  </p>
                  <p className="text-slate-800">
                    Remaining to fill:{" "}
                    <span className="font-semibold text-slate-900">
                      {bottleVolumeMl ? `${roundedRemainingMl} mL` : "—"}
                    </span>
                  </p>
                  {isOverfilled && (
                    <p className="text-[10px] text-red-600">
                      Overfilled (&gt;{bottleVolumeMl} mL). Adjust volumes.
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-2 border-t border-slate-200/80 pt-3">
                <h3 className="text-[10px] font-semibold text-slate-800 mb-2 uppercase tracking-[0.16em]">
                  Herbs in tonic
                </h3>

                {workspaceHerbs.length === 0 ? (
                  <p className="text-[11px] text-slate-500">
                    No herbs yet. Use the herbal data full-screen to <b>Create tonic</b> and add herbs.
                  </p>
                ) : (
                  <div className="pr-2">
                    <table className="w-full text-[11px] border-collapse table-fixed">
                      <thead className="sticky top-0 bg-[#F0F3EB]/95 backdrop-blur-sm">
                        <tr>
                          <th className="text-left py-1 pr-2 border-b border-slate-200 text-slate-600 text-[10px] uppercase tracking-[0.14em] whitespace-normal leading-tight">
                            Herb
                          </th>
                          <th className="text-left py-1 px-2 border-b border-slate-200 text-slate-600 text-[10px] uppercase tracking-[0.14em] whitespace-normal leading-tight">
                            mL
                          </th>
                          <th className="text-left py-1 px-2 border-b border-slate-200 text-slate-600 text-[10px] uppercase tracking-[0.14em] whitespace-normal leading-tight">
                            Range
                          </th>
                          <th className="text-left py-1 pl-2 border-b border-slate-200 text-slate-600 text-[10px] uppercase tracking-[0.14em] whitespace-normal leading-tight">
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

                          let rangeLabel = <span className="text-slate-400">No range</span>;
                          if (range.low != null || range.high != null) {
                            const lowRounded = range.low != null ? Math.ceil(range.low) : null;
                            const highRounded = range.high != null ? Math.ceil(range.high) : null;

                            if (lowRounded != null && highRounded != null) {
                              rangeLabel = (
                                <span>
                                  {lowRounded}–{highRounded} mL
                                </span>
                              );
                            } else if (lowRounded != null && highRounded == null) {
                              rangeLabel = <span>&gt;= {lowRounded} mL</span>;
                            } else if (lowRounded == null && highRounded != null) {
                              rangeLabel = <span>&lt;= {highRounded} mL</span>;
                            }
                          }

                          const roundedMl = Math.round(item.ml);

                          return (
                            <tr
                              key={`${item.herb.id}-${index}`}
                              className={
                                item.withinRange === null
                                  ? "bg-slate-50/80"
                                  : item.withinRange
                                  ? "bg-[#8ED08133]"
                                  : "bg-red-50"
                              }
                            >
                              <td className="py-1 pr-2 align-top text-[11px]">
                                <div className="font-medium text-slate-900">
                                  {item.herb.herbName}
                                </div>
                                <div className="italic text-[10px] text-slate-600">
                                  {item.herb.latinName}
                                </div>
                              </td>
                              <td className="py-1 px-2 align-top text-[11px]">
                                <button
                                  type="button"
                                  onClick={() => handleEditWorkspaceHerbMl(index)}
                                  className="underline decoration-dotted underline-offset-2 hover:text-[#4B543B]"
                                >
                                  {roundedMl} mL
                                </button>
                              </td>
                              <td className="py-1 px-2 align-top text-[11px]">{rangeLabel}</td>
                              <td className="py-1 pl-2 align-top text-[11px]">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveWorkspaceHerb(index)}
                                  className="text-[10px] px-2 py-0.5 rounded-full border border-slate-300 hover:bg-slate-100 text-slate-700"
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

                <div className="mt-2 text-[10px] text-slate-500 flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-[#8ED081]" /> in range
                  <span className="inline-block h-2 w-2 rounded-full bg-red-500" /> out of range
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* FULL SCREEN HERB TABLE OVERLAY */}
        {isFullScreenTable && (
          <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/70 backdrop-blur-sm">
            <div className="flex items-center px-6 py-2 bg-white/95 border-b border-slate-200">
              <div className="flex flex-col justify-center">
                <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                  Herbal data
                </span>
                <span className="text-sm font-semibold text-slate-900">
                  {selectedCondition?.name || "Select a health concern"}
                </span>
              </div>

              <div className="flex-1 flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    ensureTonicId();
                    setIsWorkspaceDrawerOpen(true);
                  }}
                  className="px-3 py-1 text-[10px] rounded-full border border-[#72b01d80] bg-[#72B01D] hover:bg-[#6AA318] text-white"
                >
                  Edit bottle
                </button>
              </div>

              <div className="flex items-center gap-2">
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
                <button
                  type="button"
                  onClick={() => {
                    setIsFullScreenTable(false);
                    setIsWorkspaceDrawerOpen(false);
                  }}
                  className="px-3 py-1 rounded-full border text-[10px] bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="flex-1 bg-[#F7F8F3] flex flex-col overflow-hidden">
              <div className="px-6 pt-3 pb-2 border-b border-slate-200 bg-white/90 backdrop-blur-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] mb-1 text-slate-800">
                      Body system
                    </label>
                    <select
                      className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-[12px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#72B01D66] focus:border-[#72B01D]"
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

                  <div>
                    <label className="block text-[11px] mb-1 text-slate-800">
                      Health concern
                    </label>
                    <select
                      className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-[12px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#72B01D66] focus:border-[#72B01D] disabled:opacity-50"
                      value={selectedConditionId}
                      onChange={(e) => handleConditionChange(e.target.value)}
                      disabled={!selectedBodySystem}
                    >
                      <option value="">
                        {selectedBodySystem ? "Select..." : "Select body system first..."}
                      </option>

                      {conditions.map((c) => {
                        const locked = plan === "free" && !c.is_free;
                        return (
                          <option key={c.id} value={c.id}>
                            {locked ? `🔒 ${c.name}` : c.name}
                          </option>
                        );
                      })}
                    </select>

                    {plan === "free" && (
                      <p className="mt-1 text-[10px] text-slate-500">
                        Locked items require a paid plan.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-auto">
                <div className="min-w-[1200px] px-6 py-4">
                  {error && (
                    <p className="text-sm text-amber-800 mb-4 bg-amber-50 border border-amber-300 rounded-md px-3 py-2">
                      {error}
                    </p>
                  )}

                  {loading && (
                    <p className="text-sm text-slate-600 mb-4">Loading herbs...</p>
                  )}

                  {selectedConditionId && herbRows.length > 0 && !loading && !error && (
                    <>
                      {renderHerbTable()}
                      <div className="mt-2 px-1 py-2 text-[11px] text-slate-500 border-t border-slate-100">
                        Prototype data only. Always check current references and clinical guidelines.
                      </div>
                    </>
                  )}

                  {selectedConditionId && herbRows.length === 0 && !loading && !error && (
                    <p className="text-sm text-slate-600 mt-2">
                      No herbs added yet for this concern.
                    </p>
                  )}

                  {!selectedConditionId && (
                    <p className="text-sm text-slate-600 mt-2">
                      Select a body system and health concern to view herbal data.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ✅ UPGRADE CTA MODAL */}
        {upgradeModalOpen && plan === "free" && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 backdrop-blur-sm">
            <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[#72B01D]">
                    Paid feature
                  </p>
                  <h3 className="text-lg font-semibold text-slate-900">
                    Unlock {lockedChoice?.name ? `"${lockedChoice.name}"` : "this health concern"}
                  </h3>
                  <p className="mt-2 text-sm text-slate-700">
                    Upgrade to access all locked health concerns and build full formulas without limits.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setUpgradeModalOpen(false);
                    setLockedChoice(null);
                  }}
                  className="rounded-full border border-slate-300 px-3 py-1 text-[11px] text-slate-700 hover:bg-slate-100"
                >
                  Close
                </button>
              </div>

              <div className="mt-4 rounded-xl border border-slate-200 bg-[#F7F8F3] p-4">
                <ul className="text-[13px] text-slate-800 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5">🔓</span>
                    <span>Full access to all body systems &amp; health concerns</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5">💾</span>
                    <span>Save unlimited clients &amp; tonics (coming next)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5">📄</span>
                    <span>PDF export + faster workflow</span>
                  </li>
                </ul>
              </div>

              <div className="mt-5 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => router.push("/pricing")}
                  className="w-full px-4 py-2 text-[12px] rounded-xl bg-[#72B01D] hover:bg-[#6AA318] text-white font-semibold border border-[#72B01D]"
                >
                  Upgrade to Pro
                </button>

                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setUpgradeModalOpen(false);
                      setLockedChoice(null);
                    }}
                    className="px-4 py-2 text-[12px] rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800"
                  >
                    Not now
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      const newPlan = await syncPlanFromServer();
                      if (lockedChoice && newPlan === "paid") {
                        setSelectedConditionId(lockedChoice.id);
                        setUpgradeModalOpen(false);
                        setLockedChoice(null);
                      }
                    }}
                    className="px-4 py-2 text-[12px] rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 disabled:opacity-50"
                    disabled={syncingPlan}
                    title="If you’ve just upgraded, click to refresh your plan status"
                  >
                    {syncingPlan ? "Syncing..." : "Already paid? Sync"}
                  </button>
                </div>

                <p className="text-[11px] text-slate-500">
                  If you just upgraded, syncing may take a few seconds to reflect.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ✅ WORKSPACE BOTTLE SIDE DRAWER */}
        {isWorkspaceDrawerOpen && (
          <div className="fixed inset-0 z-[75] flex justify-start">
            <button
              type="button"
              aria-label="Close workspace overview"
              className="absolute inset-0 bg-black/25 backdrop-blur-[1px]"
              onClick={() => setIsWorkspaceDrawerOpen(false)}
            />
            <div className="relative z-[76] w-full max-w-md bg-white border-r border-slate-200 shadow-2xl flex flex-col">
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-white/95">
                <div>
                  <p className="text-[10px] text-[#72B01D] tracking-[0.18em] uppercase mb-1">
                    Workspace
                  </p>
                  <p className="text-sm font-semibold text-slate-900">Bottle overview</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsWorkspaceDrawerOpen(false)}
                  className="ml-4 rounded-full border border-slate-300 px-3 py-1 text-[11px] text-slate-700 hover:bg-slate-100"
                >
                  Close
                </button>
              </div>

              <div className="border-slate-200 bg-[#F7F8F3] p-4">
                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-center shrink-0">
                    <div className="h-3 w-9 bg-[#142200]" />
                    <div className="h-3 w-7 bg-[#142200]" />
                    <div className="relative h-28 w-14 bg-[#142200] rounded-t-xl rounded-b-3xl overflow-hidden">
                      <div
                        className={`absolute bottom-0 left-0 right-0 transition-all duration-300 ease-out ${
                          isOverfilled ? "bg-red-500/80" : "bg-[#72B01D]"
                        }`}
                        style={{ height: `${bottleFillPercent}%` }}
                      />
                      <div className="absolute inset-x-1 top-1/2 -translate-y-1/2 h-6 bg-white/90 border border-slate-300 rounded-md flex items-center justify-center px-1">
                        <span className="text-[9px] text-slate-700 truncate text-center">
                          {bottleVolumeMl ? `${bottleVolumeMl} mL` : "Bottle mL"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-[11px] space-y-1 flex-1">
                    <p className="text-slate-800">
                      Bottle size:{" "}
                      <span className="font-semibold text-slate-900">
                        {bottleVolumeMl ? `${bottleVolumeMl} mL` : "—"}
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

                    <p className="text-slate-800">
                      Total volume:{" "}
                      <span className="font-semibold text-slate-900">
                        {Math.round(totalWorkspaceMl)} mL
                      </span>
                    </p>

                    <p className="text-slate-800">
                      Remaining:{" "}
                      <span className="font-semibold text-slate-900">
                        {bottleVolumeMl ? `${roundedRemainingMl} mL` : "—"}
                      </span>
                    </p>

                    <p className="text-slate-800">
                      Fill:{" "}
                      <span
                        className={`font-semibold ${
                          isOverfilled ? "text-red-600" : "text-slate-900"
                        }`}
                      >
                        {bottleVolumeMl ? `${Math.round(bottleFillPercentRaw)}%` : "—"}
                      </span>
                    </p>

                    {isOverfilled && bottleVolumeMl > 0 && (
                      <p className="mt-2 text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                        Overfilled (&gt;{bottleVolumeMl} mL). Reduce volumes.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-4 overflow-y-auto space-y-4">
                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-200 bg-white/95">
                    <h3 className="text-[10px] font-semibold text-slate-800 uppercase tracking-[0.16em]">
                      Herbs in tonic
                    </h3>
                  </div>

                  {workspaceHerbs.length === 0 ? (
                    <div className="px-4 py-4 text-[11px] text-slate-500">
                      No herbs added yet.
                    </div>
                  ) : (
                    <div className="px-4 py-3">
                      <table className="w-full text-[11px] border-collapse table-fixed">
                        <thead className="bg-[#F0F3EB]/70">
                          <tr>
                            <th className="text-left py-2 pr-2 border-b border-slate-200 text-slate-600 text-[10px] uppercase tracking-[0.14em]">
                              Herb
                            </th>
                            <th className="text-left py-2 px-2 border-b border-slate-200 text-slate-600 text-[10px] uppercase tracking-[0.14em] w-16">
                              mL
                            </th>
                            <th className="text-left py-2 px-2 border-b border-slate-200 text-slate-600 text-[10px] uppercase tracking-[0.14em] w-24">
                              Range
                            </th>
                            <th className="text-left py-2 pl-2 border-b border-slate-200 text-slate-600 text-[10px] uppercase tracking-[0.14em] w-20">
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

                            let rangeLabel = <span className="text-slate-400">—</span>;
                            if (range.low != null || range.high != null) {
                              const lowRounded = range.low != null ? Math.ceil(range.low) : null;
                              const highRounded = range.high != null ? Math.ceil(range.high) : null;

                              if (lowRounded != null && highRounded != null) {
                                rangeLabel = (
                                  <span>
                                    {lowRounded}–{highRounded}
                                  </span>
                                );
                              } else if (lowRounded != null && highRounded == null) {
                                rangeLabel = <span>&gt;= {lowRounded}</span>;
                              } else if (lowRounded == null && highRounded != null) {
                                rangeLabel = <span>&lt;= {highRounded}</span>;
                              }
                            }

                            return (
                              <tr
                                key={`${item.herb.id}-${index}`}
                                className={
                                  item.withinRange === null
                                    ? "bg-white"
                                    : item.withinRange
                                    ? "bg-[#8ED08133]"
                                    : "bg-red-50"
                                }
                              >
                                <td className="py-2 pr-2 align-top">
                                  <div className="font-medium text-slate-900">
                                    {item.herb.herbName}
                                  </div>
                                  <div className="italic text-[10px] text-slate-600">
                                    {item.herb.latinName}
                                  </div>
                                </td>
                                <td className="py-2 px-2 align-top">
                                  <button
                                    type="button"
                                    onClick={() => handleEditWorkspaceHerbMl(index)}
                                    className="underline decoration-dotted underline-offset-2 hover:text-[#4B543B]"
                                  >
                                    {Math.round(item.ml)}
                                  </button>
                                </td>
                                <td className="py-2 px-2 align-top">{rangeLabel}</td>
                                <td className="py-2 pl-2 align-top">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveWorkspaceHerb(index)}
                                    className="text-[10px] px-2 py-0.5 rounded-full border border-slate-300 hover:bg-slate-100 text-slate-700"
                                  >
                                    Remove
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>

                      <div className="mt-3 text-[10px] text-slate-500 flex items-center gap-2">
                        <span className="inline-block h-2 w-2 rounded-full bg-[#8ED081]" /> in range
                        <span className="inline-block h-2 w-2 rounded-full bg-red-500" /> out of range
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsWorkspaceDrawerOpen(false)}
                    className="px-4 py-2 text-[12px] rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* HERB DETAILS SIDE DRAWER */}
        {selectedHerb && (
          <div className="fixed inset-0 z-[60] flex justify-end">
            <button
              type="button"
              aria-label="Close herb details"
              className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
                isDrawerOpen ? "opacity-100" : "opacity-0"
              }`}
              onClick={closeDrawer}
            />
            <div
              className={`relative z-[61] w-full max-w-md bg-white border-l border-slate-200 shadow-2xl flex flex-col transform transition-transform duration-300 ease-out ${
                isDrawerOpen ? "translate-x-0" : "translate-x-full"
              }`}
            >
              <div className="flex items-start justify-between px-6 py-4 border-b border-slate-200 bg-white/95">
                <div>
                  <p className="text-[10px] text-[#72B01D] tracking-[0.18em] uppercase mb-1">
                    Herb
                  </p>
                  <p className="text-lg font-semibold text-slate-900">{selectedHerb.herbName}</p>
                  <p className="italic text-slate-600 text-sm">{selectedHerb.latinName}</p>
                </div>
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="ml-4 rounded-full border border-slate-300 px-3 py-1 text-[11px] text-slate-700 hover:bg-slate-100"
                >
                  Close
                </button>
              </div>

              <div className="px-6 py-4 space-y-4 overflow-y-auto text-sm text-slate-800">
                {selectedHerb.actions && (
                  <div>
                    <h4 className="text-[#72B01D] text-[11px] mb-1 tracking-[0.16em] uppercase">
                      Actions
                    </h4>
                    <p className="whitespace-pre-wrap text-slate-900/90">{selectedHerb.actions}</p>
                  </div>
                )}

                {selectedHerb.indications && (
                  <div>
                    <h4 className="text-[#72B01D] text-[11px] mb-1 tracking-[0.16em] uppercase">
                      Indications
                    </h4>
                    <p className="whitespace-pre-wrap text-slate-900/90">{selectedHerb.indications}</p>
                  </div>
                )}

                {selectedHerb.energeticProperties && (
                  <div>
                    <h4 className="text-[#72B01D] text-[11px] mb-1 tracking-[0.16em] uppercase">
                      Energetic properties
                    </h4>
                    <p className="whitespace-pre-wrap text-slate-900/90">{selectedHerb.energeticProperties}</p>
                  </div>
                )}

                {selectedHerb.safetyPrecautions && (
                  <div>
                    <h4 className="text-[#72B01D] text-[11px] mb-1 tracking-[0.16em] uppercase">
                      Safety precautions
                    </h4>
                    <p className="whitespace-pre-wrap text-slate-900/90">{selectedHerb.safetyPrecautions}</p>
                  </div>
                )}

                {formatDose(selectedHerb) && (
                  <div>
                    <h4 className="text-[#72B01D] text-[11px] mb-1 tracking-[0.16em] uppercase">
                      Therapeutic dosage
                    </h4>
                    <p className="whitespace-pre-wrap text-slate-900/90">{formatDose(selectedHerb)}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* mL ENTRY / EDIT MODAL */}
        {mlModalOpen && mlModalHerb && (
          <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-sm bg-white rounded-xl border border-slate-200 p-6 shadow-2xl">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleConfirmMlModal();
                }}
              >
                <h3 className="text-lg font-semibold mb-2 text-slate-900">
                  {mlModalIndex === null ? "Add herb to tonic" : "Edit herb volume"}
                </h3>

                <p className="text-sm mb-2 text-slate-700">
                  Enter mL for{" "}
                  <span className="font-semibold text-slate-900">{mlModalHerb.herbName}</span>:
                </p>

                <input
                  type="number"
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 mb-4 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#72B01D66] focus:border-[#72B01D] appearance-none text-[13px]"
                  placeholder="e.g. 5"
                  value={mlModalValue}
                  onChange={(e) => setMlModalValue(e.target.value)}
                  autoFocus
                />

                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleCloseMlModal}
                    className="px-4 py-2 text-[12px] bg-slate-100 hover:bg-slate-200 rounded-md border border-slate-300 text-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-[12px] bg-[#72B01D] hover:bg-[#6AA318] rounded-md font-semibold text-white border border-[#72B01D]"
                  >
                    Confirm
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* BOTTLE CONFIG ERROR MODAL */}
        {bottleConfigErrorOpen && (
          <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/45 backdrop-blur-sm">
            <div className="w-full max-w-sm bg-white rounded-xl border border-red-200 p-6 shadow-2xl">
              <h3 className="text-lg font-semibold mb-2 text-red-700">Set bottle &amp; dose first</h3>
              <p className="text-sm mb-4 text-slate-800">
                To add herbs to this tonic, please make sure you have:
              </p>
              <ul className="list-disc list-inside text-[13px] text-slate-800 mb-4 space-y-1">
                <li>A bottle size selected</li>
                <li>Dose in mL per serve entered</li>
                <li>Frequency per day set</li>
              </ul>
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
    </>
  );
}
