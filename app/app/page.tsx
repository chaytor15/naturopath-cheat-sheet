"use client";

import { useEffect, useState, useRef, type CSSProperties } from "react";
import { supabase } from "@/lib/supabaseClient";
import jsPDF from "jspdf"; // npm install jspdf
import AuthButton from "@/components/AuthButton";
import AppHeader from "@/components/AppHeader";
import Sidebar from "@/components/Sidebar";
import MainContent from "@/components/MainContent";
import TagInput from "@/components/TagInput";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
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
  medications: string | string[]; // Support both for backward compatibility
  existingConditionsText: string | string[]; // Support both for backward compatibility
  precautions: string | string[]; // Support both for backward compatibility
  patientInstructions: string;
};

type PendingLockedCondition = {
  id: string;
  name?: string;
  returnTo?: string;
};

// Countries list for dropdown
const COUNTRIES = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria",
  "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan",
  "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Cabo Verde", "Cambodia",
  "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo", "Costa Rica",
  "Croatia", "Cuba", "Cyprus", "Czech Republic", "Denmark", "Djibouti", "Dominica", "Dominican Republic", "Ecuador", "Egypt",
  "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia", "Fiji", "Finland", "France", "Gabon",
  "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana",
  "Haiti", "Honduras", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel",
  "Italy", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kosovo", "Kuwait", "Kyrgyzstan",
  "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "Madagascar",
  "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia",
  "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal",
  "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway", "Oman", "Pakistan",
  "Palau", "Palestine", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal", "Qatar",
  "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia",
  "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa",
  "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria", "Taiwan",
  "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan",
  "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "Uruguay", "Uzbekistan", "Vanuatu", "Vatican City",
  "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe"
].sort();

type Client = {
  id: string;
  full_name: string;
  email: string | null;
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
  const pathname = usePathname();

  // Auth check - redirect to login if not logged in
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/login");
      }
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

  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [clientName, setClientName] = useState("");
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const clientSearchInputRef = useRef<HTMLInputElement>(null);
  const [createClientModalOpen, setCreateClientModalOpen] = useState(false);
  const [newClientFirstName, setNewClientFirstName] = useState("");
  const [newClientLastName, setNewClientLastName] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientDob, setNewClientDob] = useState("");
  const [newClientFlags, setNewClientFlags] = useState({
    pregnancy: false,
    lactation: false,
    anticoagulants: false,
    pediatric: false,
    kidneyDisease: false,
    liverDisease: false,
  });
  const [newClientMedications, setNewClientMedications] = useState<string[]>([]);
  const [newClientExistingConditions, setNewClientExistingConditions] = useState<string[]>([]);
  const [newClientOtherPrecautions, setNewClientOtherPrecautions] = useState<string[]>([]);
  
  // Address fields state
  const [showAddressFields, setShowAddressFields] = useState(false);
  const [newClientStreet1, setNewClientStreet1] = useState("");
  const [newClientStreet2, setNewClientStreet2] = useState("");
  const [newClientSuburb, setNewClientSuburb] = useState("");
  const [newClientState, setNewClientState] = useState("");
  const [newClientPostcode, setNewClientPostcode] = useState("");
  const [newClientCountry, setNewClientCountry] = useState("");
  const [creatingClient, setCreatingClient] = useState(false);
  
  // ESC key handler for create client modal
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && createClientModalOpen) {
        setCreateClientModalOpen(false);
      }
    };
    if (createClientModalOpen) {
      window.addEventListener("keydown", handleEsc);
      return () => window.removeEventListener("keydown", handleEsc);
    }
  }, [createClientModalOpen]);

  // CTRL + K handler for client search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        clientSearchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
  
  const [tonicPurpose, setTonicPurpose] = useState("");
  const [medications, setMedications] = useState<string[]>([]);
  const [existingConditionsText, setExistingConditionsText] = useState<string[]>([]);
  const [precautions, setPrecautions] = useState<string[]>([]);
  const [showMedicationInput, setShowMedicationInput] = useState(false);
  const [showExistingConditionInput, setShowExistingConditionInput] = useState(false);
  const [showPrecautionsInput, setShowPrecautionsInput] = useState(false);
  const [clientFormulas, setClientFormulas] = useState<Array<{id: string; title: string | null; created_at: string; formula_data: SavedTonic}>>([]);
  const [loadedFormulaId, setLoadedFormulaId] = useState<string | null>(null);

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
  const isLockedSelection = !!(
  selectedConditionId &&
  plan === "free" &&
  selectedCondition &&
  !selectedCondition.is_free
);


  // Bottle / volume calculations
  const bottleVolumeMl = bottleSize ? Number(bottleSize) : 0;
  const numericDose = doseMl ? Number(doseMl) : 0;
  const numericFrequency = frequencyPerDay ? Number(frequencyPerDay) : 0;

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

// IMPORTANT:
// profiles.plan is the single source of truth.
// localStorage is only a cache, never authoritative.
useEffect(() => {
  const loadPlan = async () => {
    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr) return;

      const user = userRes.user;
      if (!user) return;

      const email = (user.email ?? "").toLowerCase();

      // ✅ optional hard override for your email
      if (email === PAID_EMAIL_OVERRIDE.toLowerCase()) {
        setPlan("paid");
        if (typeof window !== "undefined") localStorage.setItem(PLAN_KEY, "paid");
        return;
      }

      // ✅ Source of truth: profiles.plan
      const { data, error } = await supabase
        .from("profiles")
        .select("plan")
        .eq("id", user.id)
        .maybeSingle();

      if (!error && (data?.plan === "paid" || data?.plan === "free")) {
        setPlan(data.plan);

        // keep localStorage aligned (prevents stale "paid" UI for free users)
        if (typeof window !== "undefined") localStorage.setItem(PLAN_KEY, data.plan);
        return;
      }

      // fallback (shouldn’t happen often)
      setPlan("free");
      if (typeof window !== "undefined") localStorage.setItem(PLAN_KEY, "free");
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
    setHerbRows([]);
    return;
  }

  const chosen = conditions.find((c) => c.id === nextId);
  if (!chosen) {
    setSelectedConditionId(nextId);
    return;
  }

  const locked = plan === "free" && !chosen.is_free;

  // ✅ If locked, open CTA, clear selection + rows so we NEVER show the RLS "empty" state
  if (locked) {
    setLockedChoice(chosen);
    setUpgradeModalOpen(true);
    setSelectedConditionId(""); // 👈 important
    setHerbRows([]);            // 👈 important
    return;
  }

  setSelectedConditionId(nextId);
};


  // Reset workspace when navigating away from /app
  useEffect(() => {
    // Reset all state when navigating away from /app
    if (pathname !== "/app") {
      setClientName("");
      setTonicPurpose("");
      setMedications([]);
      setExistingConditionsText([]);
      setPrecautions([]);
      setTonicName("");
      setPatientInstructions("");
      setBottleSize("");
      setDoseMl("");
      setFrequencyPerDay("");
      setWorkspaceHerbs([]);
      setCurrentTonicId(null);
      setSaveStatus("idle");
      setSelectedClientId("");
      setShowMedicationInput(false);
      setShowExistingConditionInput(false);
      setLoadedFormulaId(null);
      if (typeof window !== "undefined") {
        localStorage.removeItem(TONIC_STORAGE_KEY);
      }
      return;
    }

    // When on /app page, only load from localStorage if there are URL params (formula/duplicate)
    // Otherwise, start with a clean slate
    if (typeof window === "undefined") return;
    
    const formulaId = searchParams.get("formula");
    const duplicateId = searchParams.get("duplicate");
    
    // Only load from localStorage if explicitly loading a formula from URL
    // Otherwise, reset to empty state
    if (!formulaId && !duplicateId) {
      // No URL params - reset to clean state
      setClientName("");
      setTonicPurpose("");
      setMedications([]);
      setExistingConditionsText([]);
      setPrecautions([]);
      setTonicName("");
      setPatientInstructions("");
      setBottleSize("");
      setDoseMl("");
      setFrequencyPerDay("");
      setWorkspaceHerbs([]);
      setCurrentTonicId(null);
      setSaveStatus("idle");
      setSelectedClientId("");
      setShowMedicationInput(false);
      setShowExistingConditionInput(false);
      localStorage.removeItem(TONIC_STORAGE_KEY);
      return;
    }
    
    // If we have formula/duplicate params, the URL-based loading logic will handle it
    // (this is handled in the separate useEffect for loading formulas from URL)
  }, [pathname, searchParams]);

  // Match saved client name to client ID when clients are loaded
  useEffect(() => {
    if (clientName && clients.length > 0 && !selectedClientId) {
      const matchedClient = clients.find((c) => c.full_name === clientName);
      if (matchedClient) {
        setSelectedClientId(matchedClient.id);
      }
    }
  }, [clients, clientName, selectedClientId]);

  // Load formula from URL params
  useEffect(() => {
    const loadFormulaFromUrl = async () => {
      const formulaId = searchParams.get("formula");
      const duplicateId = searchParams.get("duplicate");
      const clientId = searchParams.get("client");

      // Load client data if client param is present
      if (clientId) {
        setSelectedClientId(clientId);
        const clientMedications = searchParams.get("medications");
        const clientExistingConditions = searchParams.get("existingConditions");
        if (clientMedications) {
          try {
            const parsed = JSON.parse(decodeURIComponent(clientMedications));
            setMedications(Array.isArray(parsed) ? parsed : [parsed]);
          } catch {
            setMedications([decodeURIComponent(clientMedications)]);
          }
        }
        if (clientExistingConditions) {
          try {
            const parsed = JSON.parse(decodeURIComponent(clientExistingConditions));
            setExistingConditionsText(Array.isArray(parsed) ? parsed : [parsed]);
          } catch {
            setExistingConditionsText([decodeURIComponent(clientExistingConditions)]);
          }
        }
      }

      // Load formula to edit
      if (formulaId) {
        try {
          const { data: userRes } = await supabase.auth.getUser();
          if (!userRes.user) return;

          const { data, error } = await supabase
            .from("formulas")
            .select("*")
            .eq("id", formulaId)
            .eq("user_id", userRes.user.id)
            .single();

          if (error) {
            console.error("Failed to load formula:", error);
            return;
          }

          if (data?.formula_data) {
            const formulaData: SavedTonic = data.formula_data;
            setCurrentTonicId(data.id);
            setTonicName(formulaData.tonicName || "");
            setBottleSize(formulaData.bottleSize || "");
            setDoseMl(formulaData.doseMl || "");
            setFrequencyPerDay(formulaData.frequencyPerDay || "");
            setWorkspaceHerbs(formulaData.workspaceHerbs || []);
            setClientName(formulaData.clientName || "");
            setTonicPurpose(formulaData.tonicPurpose || "");
            const meds = formulaData.medications || [];
            const conditions = formulaData.existingConditionsText || [];
            const formulaPrecautions = formulaData.precautions || [];
            setMedications(Array.isArray(meds) ? meds : meds ? [meds] : []);
            setExistingConditionsText(Array.isArray(conditions) ? conditions : conditions ? [conditions] : []);
            setPrecautions(Array.isArray(formulaPrecautions) ? formulaPrecautions : formulaPrecautions ? [formulaPrecautions] : []);
            setPatientInstructions(formulaData.patientInstructions || "");

            // Set client ID if available
            if (data.client_id) {
              setSelectedClientId(data.client_id);
            }

            // Save to localStorage
            localStorage.setItem(TONIC_STORAGE_KEY, JSON.stringify(formulaData));
      setSaveStatus("saved");
          }
    } catch (e) {
          console.error("Failed to load formula:", e);
        }
      }

      // Load formula to duplicate
      if (duplicateId) {
        try {
          const { data: userRes } = await supabase.auth.getUser();
          if (!userRes.user) return;

          const { data, error } = await supabase
            .from("formulas")
            .select("*")
            .eq("id", duplicateId)
            .eq("user_id", userRes.user.id)
            .single();

          if (error) {
            console.error("Failed to load formula for duplication:", error);
            return;
          }

          if (data?.formula_data) {
            const formulaData: SavedTonic = data.formula_data;
            const duplicateName = searchParams.get("name") || `${formulaData.tonicName || "Untitled"} (Copy)`;

            // Create new formula with duplicated data
            const newId = crypto.randomUUID();
            setCurrentTonicId(newId);
            setTonicName(duplicateName);
            setBottleSize(formulaData.bottleSize || "");
            setDoseMl(formulaData.doseMl || "");
            setFrequencyPerDay(formulaData.frequencyPerDay || "");
            setWorkspaceHerbs(formulaData.workspaceHerbs || []);
            setClientName(formulaData.clientName || "");
            setTonicPurpose(formulaData.tonicPurpose || "");
            const meds = formulaData.medications || [];
            const conditions = formulaData.existingConditionsText || [];
            const formulaPrecautions = formulaData.precautions || [];
            setMedications(Array.isArray(meds) ? meds : meds ? [meds] : []);
            setExistingConditionsText(Array.isArray(conditions) ? conditions : conditions ? [conditions] : []);
            setPrecautions(Array.isArray(formulaPrecautions) ? formulaPrecautions : formulaPrecautions ? [formulaPrecautions] : []);
            setPatientInstructions(formulaData.patientInstructions || "");

            // Set client ID if available
            if (data.client_id) {
              setSelectedClientId(data.client_id);
            }

            // Save to localStorage
            const duplicatedTonic: SavedTonic = {
              ...formulaData,
              id: newId,
              tonicName: duplicateName,
            };
            localStorage.setItem(TONIC_STORAGE_KEY, JSON.stringify(duplicatedTonic));
            setSaveStatus("idle");
          }
        } catch (e) {
          console.error("Failed to duplicate formula:", e);
        }
      }
    };

    loadFormulaFromUrl();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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

  // LOAD CLIENTS
  useEffect(() => {
    const loadClients = async () => {
      try {
        const { data: userRes } = await supabase.auth.getUser();
        if (!userRes.user) return;

        const { data, error } = await supabase
          .from("clients")
          .select("id, full_name, email")
          .eq("user_id", userRes.user.id)
          .order("full_name", { ascending: true });

        if (error) {
          // If table doesn't exist, just set empty array (table will be created when needed)
          if (error.code === "42P01" || error.message?.includes("does not exist")) {
            console.log("Clients table does not exist yet. It will be created when you add your first client.");
            setClients([]);
            return;
          }
          throw error;
        }
        setClients(data || []);
      } catch (e: any) {
        console.error("Failed to load clients:", e);
        // Set empty array on error so the app continues to work
        setClients([]);
      }
    };

    loadClients();
  }, []);

  // Update clientName and load client data when selectedClientId changes
  useEffect(() => {
    const loadClientData = async () => {
      if (selectedClientId) {
        const client = clients.find((c) => c.id === selectedClientId);
        setClientName(client?.full_name || "");

        // Load full client data including flags
        try {
          const { data: userRes } = await supabase.auth.getUser();
          if (!userRes.user) return;

          const { data, error } = await supabase
            .from("clients")
            .select("flags, id")
            .eq("id", selectedClientId)
            .eq("user_id", userRes.user.id)
            .single();

          if (!error && data) {
            // Always sync medications, existing conditions, and precautions from client profile when client changes
            const flags = data.flags || {};
            const meds = flags.medications;
            const conditions = flags.existingConditions;
            const clientPrecautions = flags.otherPrecautions;
            
            if (meds) {
              setMedications(Array.isArray(meds) ? meds : [meds]);
            } else {
              setMedications([]);
            }
            
            if (conditions) {
              setExistingConditionsText(Array.isArray(conditions) ? conditions : [conditions]);
            } else {
              setExistingConditionsText([]);
            }
            
            // Build precautions array from boolean flags and otherPrecautions
            const precautionsArray: string[] = [];
            
            // Convert boolean flags to strings
            if (flags.pregnancy === true) precautionsArray.push("Pregnant");
            if (flags.lactation === true) precautionsArray.push("Lactation");
            if (flags.anticoagulants === true) precautionsArray.push("Anticoagulants");
            if (flags.pediatric === true) precautionsArray.push("Pediatric");
            if (flags.kidneyDisease === true) precautionsArray.push("Kidney Disease");
            if (flags.liverDisease === true) precautionsArray.push("Liver Disease");
            
            // Add otherPrecautions (string array) if they exist
            if (clientPrecautions !== null && clientPrecautions !== undefined) {
              if (Array.isArray(clientPrecautions)) {
                precautionsArray.push(...clientPrecautions.filter(p => p && p.trim() !== ''));
              } else if (typeof clientPrecautions === 'string' && clientPrecautions.trim() !== '') {
                precautionsArray.push(clientPrecautions);
              }
            }
            
            setPrecautions(precautionsArray);
          } else {
            // If no flags or error, clear medications, conditions, and precautions
            setMedications([]);
            setExistingConditionsText([]);
            setPrecautions([]);
          }

          // Load formulas for this client
          const { data: formulasData, error: formulasError } = await supabase
            .from("formulas")
            .select("id, title, created_at, formula_data")
            .eq("client_id", selectedClientId)
            .eq("user_id", userRes.user.id)
            .order("created_at", { ascending: false });

          if (!formulasError && formulasData) {
            setClientFormulas(formulasData);
          } else if (formulasError) {
            console.error("Failed to load formulas:", formulasError);
            setClientFormulas([]);
          }
        } catch (e) {
          console.error("Failed to load client data:", e);
        }
      } else {
        setClientName("");
        setClientFormulas([]);
      }
    };

    loadClientData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClientId, clients]);

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
if (isLockedSelection) {
  setHerbRows([]);
  setLoading(false);
  setError(null);
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

  // ESC key handler for ML edit modal (prioritize this over fullscreen)
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mlModalOpen) {
        e.preventDefault();
        e.stopPropagation();
        handleCloseMlModal();
      }
    };
    if (mlModalOpen) {
      window.addEventListener("keydown", handleEsc, true); // Use capture phase
      return () => window.removeEventListener("keydown", handleEsc, true);
    }
  }, [mlModalOpen]);

  // ESC key handler for workspace drawer (prioritize this over fullscreen)
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isWorkspaceDrawerOpen) {
        e.preventDefault();
        e.stopPropagation();
        setIsWorkspaceDrawerOpen(false);
      }
    };
    if (isWorkspaceDrawerOpen) {
      window.addEventListener("keydown", handleEsc, true); // Use capture phase
      return () => window.removeEventListener("keydown", handleEsc, true);
    }
  }, [isWorkspaceDrawerOpen]);

  // ESC key handler for fullscreen mode (only if ML modal and drawer are not open)
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullScreenTable && !mlModalOpen && !isWorkspaceDrawerOpen) {
        setIsFullScreenTable(false);
        setIsWorkspaceDrawerOpen(false);
      }
    };
    if (isFullScreenTable) {
      window.addEventListener("keydown", handleEsc);
      return () => window.removeEventListener("keydown", handleEsc);
    }
  }, [isFullScreenTable, mlModalOpen, isWorkspaceDrawerOpen]);

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

  const handleSaveTonic = async () => {
    if (typeof window === "undefined") return;

    try {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) {
        setSaveStatus("error");
        return;
      }

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
        precautions,
        patientInstructions,
      };

      // Save to localStorage
      localStorage.setItem(TONIC_STORAGE_KEY, JSON.stringify(tonicToSave));

      // Save to database (formulas table) - save as "final" when saving a completed tonic
      const formulaData = {
        id,
        client_id: selectedClientId || null,
        user_id: userRes.user.id,
        title: tonicName || "Untitled Tonic",
        status: "final" as const, // Changed to "final" when saving
        formula_data: tonicToSave,
      };

      // Upsert formula (insert or update if exists)
      const { data: savedFormula, error: formulaError } = await supabase
        .from("formulas")
        .upsert(formulaData, {
          onConflict: "id",
        })
        .select();

      if (formulaError) {
        console.error("Failed to save formula to database:", {
          message: formulaError.message,
          details: formulaError.details,
          hint: formulaError.hint,
          code: formulaError.code,
          fullError: formulaError,
        });
        setSaveStatus("error");
        alert(`Failed to save formula: ${formulaError.message || "Unknown error"}`);
        return;
      }

      if (savedFormula && savedFormula.length > 0) {
        console.log("Formula saved successfully:", savedFormula[0]);
      }

      // Update client profile with medications and existing conditions if client is selected
      if (selectedClientId && (medications.length > 0 || existingConditionsText.length > 0)) {
        const { data: clientData } = await supabase
          .from("clients")
          .select("flags")
          .eq("id", selectedClientId)
          .single();

        if (clientData) {
          const updatedFlags = {
            ...(clientData.flags || {}),
            medications: medications,
            existingConditions: existingConditionsText,
          };

          await supabase
            .from("clients")
            .update({ flags: updatedFlags })
            .eq("id", selectedClientId);
        }
      }

      setCurrentTonicId(id);
      setSaveStatus("saved");
    } catch (e: any) {
      console.error("Failed to save tonic", {
        message: e?.message,
        error: e,
      });
      setSaveStatus("error");
      alert(`Failed to save tonic: ${e?.message || "Unknown error"}`);
    }
  };

  const handleResetTonic = () => {
    // Confirm before resetting
    if (!window.confirm("Are you sure you want to reset the form? All unsaved changes will be lost.")) {
      return;
    }

    // Clear all client + tonic fields + workspace herbs
    setClientName("");
    setTonicPurpose("");
    setMedications([]);
    setExistingConditionsText([]);
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
    addLine(`Medications: ${medications.length > 0 ? medications.join(", ") : "-"}`);
    addLine(`Existing conditions: ${existingConditionsText.length > 0 ? existingConditionsText.join(", ") : "-"}`);
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
                    className="text-[12px] px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 inline-flex items-center gap-1 text-slate-700 font-medium"
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
                    className="px-3 py-1.5 text-[12px] font-semibold rounded-lg border border-[#72B01D80] bg-[#72B01D] hover:bg-[#6AA318] text-white"
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
      <AppHeader />
      <Sidebar />

      <MainContent className={isFullScreenTable ? "overflow-hidden" : "h-screen flex flex-col"}>
        <div className="flex-1 flex min-h-0">
          {/* LEFT PANE: Client Details */}
          <div className="hidden lg:flex w-[280px] border-r border-slate-200 bg-white flex-col">
            <div className="flex-shrink-0 p-4 border-b border-slate-200">
              <h2 className="text-[11px] font-semibold text-[#4B543B] uppercase tracking-wide">Client Details</h2>
              <span className="text-[10px] uppercase tracking-[0.15em] text-[#7D8472] mt-1 block">Intake</span>
            </div>
            <div className="flex-1 overflow-y-auto stable-scroll p-4 space-y-4">
              <div className="grid gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[12px] text-slate-700 font-medium">
                      Client
                  </label>
                    <button
                      type="button"
                      onClick={() => setCreateClientModalOpen(true)}
                      className="text-[10px] font-medium text-[#72B01D] hover:text-[#6AA318] hover:underline"
                    >
                      + New client
                    </button>
                  </div>
                  <div className="relative">
                  <input
                      ref={clientSearchInputRef}
                      type="text"
                      className="w-full bg-white/70 border border-slate-200 rounded-lg px-3 py-1.5 pr-16 text-[11px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#72B01D66] focus:border-[#72B01D]"
                      placeholder={!selectedClientId ? "Select a client..." : ""}
                      value={selectedClientId && !clientSearchQuery ? (clients.find(c => c.id === selectedClientId)?.full_name || clientName || "") : clientSearchQuery}
                    onChange={(e) => {
                        setClientSearchQuery(e.target.value);
                        setIsClientDropdownOpen(true);
                      }}
                      onFocus={() => {
                        setIsClientDropdownOpen(true);
                        if (selectedClientId) {
                          setClientSearchQuery("");
                        }
                      }}
                      onBlur={(e) => {
                        // Delay closing to allow click events
                        setTimeout(() => {
                          setIsClientDropdownOpen(false);
                          setClientSearchQuery("");
                        }, 200);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          setIsClientDropdownOpen(false);
                          setClientSearchQuery("");
                        }
                      }}
                    />
                    {isClientDropdownOpen && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        <div
                          className="px-3 py-2 text-[11px] text-slate-700 hover:bg-slate-50 cursor-pointer"
                          onClick={() => {
                            markUnsaved();
                            setSelectedClientId("");
                            setClientName("");
                            setMedications([]);
                            setExistingConditionsText([]);
                            setLoadedFormulaId(null);
                            setClientFormulas([]);
                            setIsClientDropdownOpen(false);
                            setClientSearchQuery("");
                            // Reset workspace state
                            setCurrentTonicId(null);
                            setTonicName("");
                            setBottleSize("");
                            setDoseMl("");
                            setFrequencyPerDay("");
                            setWorkspaceHerbs([]);
                            setTonicPurpose("");
                            setPatientInstructions("");
                            setSaveStatus("idle");
                            if (typeof window !== "undefined") {
                              localStorage.removeItem(TONIC_STORAGE_KEY);
                            }
                          }}
                        >
                          Select a client...
                        </div>
                        {(() => {
                          const filteredClients = clientSearchQuery
                            ? clients.filter((client) =>
                                client.full_name.toLowerCase().includes(clientSearchQuery.toLowerCase())
                              )
                            : clients;
                          
                          if (filteredClients.length === 0) {
                            return (
                              <div className="px-3 py-2 text-[11px] text-slate-500">
                                No clients found
                              </div>
                            );
                          }
                          
                          return filteredClients.map((client) => (
                            <div
                              key={client.id}
                              className={`px-3 py-2 text-[11px] cursor-pointer ${
                                selectedClientId === client.id
                                  ? "bg-[#72B01D] text-white"
                                  : "text-slate-900 hover:bg-slate-50"
                              }`}
                              onClick={() => {
                                markUnsaved();
                                const newClientId = client.id;
                                const previousClientId = selectedClientId;
                                
                                // If switching to a different client, reset workspace state (but not medications/conditions - useEffect will load those)
                                if (previousClientId !== newClientId && newClientId) {
                                  setCurrentTonicId(null);
                                  setTonicName("");
                                  setBottleSize("");
                                  setDoseMl("");
                                  setFrequencyPerDay("");
                                  setWorkspaceHerbs([]);
                                  setTonicPurpose("");
                                  setPatientInstructions("");
                                  setLoadedFormulaId(null);
                                  setSaveStatus("idle");
                                  if (typeof window !== "undefined") {
                                    localStorage.removeItem(TONIC_STORAGE_KEY);
                                  }
                                }
                                
                                setSelectedClientId(newClientId);
                                setClientSearchQuery("");
                                setIsClientDropdownOpen(false);
                                
                                // If deselecting client, clear all client-related data
                                if (!newClientId) {
                                  setClientName("");
                                  setMedications([]);
                                  setExistingConditionsText([]);
                                  setClientFormulas([]);
                                }
                              }}
                            >
                              {client.full_name}
                            </div>
                          ));
                        })()}
                      </div>
                    )}
                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[10px] text-slate-400">
                      Ctrl K
                    </span>
                  </div>
                  {selectedClientId && clientFormulas.length > 0 && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[12px] text-slate-700 font-medium">
                          Load Formula
                        </label>
                        {loadedFormulaId && (
                          <button
                            type="button"
                            onClick={() => {
                              // Reset to blank tonic
                              setCurrentTonicId(null);
                              setTonicName("");
                              setBottleSize("");
                              setDoseMl("");
                              setFrequencyPerDay("");
                              setWorkspaceHerbs([]);
                              setTonicPurpose("");
                              setMedications([]);
                              setExistingConditionsText([]);
                              setPatientInstructions("");
                              setLoadedFormulaId(null);
                              setSaveStatus("idle");
                              localStorage.removeItem(TONIC_STORAGE_KEY);
                              markUnsaved();
                            }}
                            className="text-[9px] text-slate-500 hover:text-slate-700 font-semibold"
                            title="Clear loaded formula"
                          >
                            ✕ Clear
                          </button>
                        )}
                      </div>
                      <select
                        className="w-full bg-white/70 border border-slate-200 rounded-lg px-3 py-1.5 text-[11px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#72B01D66] focus:border-[#72B01D]"
                        value={loadedFormulaId || ""}
                        onChange={async (e) => {
                          const formulaId = e.target.value;
                          
                          // If selecting empty option, reset to blank
                          if (!formulaId) {
                            setCurrentTonicId(null);
                            setTonicName("");
                            setBottleSize("");
                            setDoseMl("");
                            setFrequencyPerDay("");
                            setWorkspaceHerbs([]);
                            setTonicPurpose("");
                            setMedications([]);
                            setExistingConditionsText([]);
                            setPatientInstructions("");
                            setLoadedFormulaId(null);
                            setSaveStatus("idle");
                            localStorage.removeItem(TONIC_STORAGE_KEY);
                            markUnsaved();
                            return;
                          }
                          
                          const formula = clientFormulas.find(f => f.id === formulaId);
                          if (!formula || !formula.formula_data) return;
                          
                          const formulaData: SavedTonic = formula.formula_data;
                          
                          // Load formula into workspace
                          setCurrentTonicId(formulaData.id || null);
                          setTonicName(formulaData.tonicName ?? "");
                          setBottleSize(formulaData.bottleSize ?? "");
                          setDoseMl(formulaData.doseMl ?? "");
                          setFrequencyPerDay(formulaData.frequencyPerDay ?? "");
                          setWorkspaceHerbs(formulaData.workspaceHerbs ?? []);
                          setTonicPurpose(formulaData.tonicPurpose ?? "");
                          const meds = formulaData.medications ?? [];
                          const conditions = formulaData.existingConditionsText ?? [];
                          setMedications(Array.isArray(meds) ? meds : meds ? [meds] : []);
                          setExistingConditionsText(Array.isArray(conditions) ? conditions : conditions ? [conditions] : []);
                          setPatientInstructions(formulaData.patientInstructions ?? "");
                          setLoadedFormulaId(formulaId);
                          
                          // Save to localStorage
                          localStorage.setItem(TONIC_STORAGE_KEY, JSON.stringify(formulaData));
                          setSaveStatus("saved");
                          markUnsaved();
                        }}
                      >
                        <option value="">Select a formula to load...</option>
                        {clientFormulas.map((formula) => (
                          <option key={formula.id} value={formula.id}>
                            {formula.title || "Untitled"} - {new Date(formula.created_at).toLocaleDateString()}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[12px] text-slate-700 font-medium">
                    Medications
                  </label>
                    {showMedicationInput ? (
                      <button
                        type="button"
                        onClick={() => setShowMedicationInput(false)}
                        className="text-[10px] text-slate-500 hover:text-slate-700"
                      >
                        Done
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowMedicationInput(true)}
                        className="text-[10px] font-medium text-[#72B01D] hover:text-[#6AA318] hover:underline"
                      >
                        + Add medication
                      </button>
                    )}
                  </div>
                  {showMedicationInput ? (
                    <div className="flex flex-wrap gap-1 py-2 min-h-[28px]">
                      {medications.map((med, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/60 backdrop-blur-sm border border-white/40 text-[11px] text-slate-700 shadow-sm"
                        >
                          {med}
                          <button
                            type="button"
                            onClick={() => {
                              const newTags = medications.filter((_, i) => i !== index);
                              setMedications(newTags);
                              markUnsaved();
                            }}
                            className="text-slate-500 hover:text-slate-700 ml-0.5"
                            aria-label={`Remove ${med}`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                  <input
                        type="text"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && (e.target as HTMLInputElement).value.trim()) {
                            e.preventDefault();
                            const value = (e.target as HTMLInputElement).value.trim();
                            if (!medications.includes(value)) {
                              setMedications([...medications, value]);
                      markUnsaved();
                            }
                            (e.target as HTMLInputElement).value = "";
                          } else if (e.key === "Backspace" && !(e.target as HTMLInputElement).value && medications.length > 0) {
                            setMedications(medications.slice(0, -1));
                            markUnsaved();
                          }
                        }}
                        placeholder={medications.length === 0 ? "Type medication and press Enter..." : ""}
                        className="flex-1 min-w-[120px] outline-none text-[11px] text-slate-900 bg-white/40 border border-dashed border-slate-300 rounded px-2 py-0.5 focus:border-[#72B01D] focus:bg-white/60 focus:outline-none placeholder:text-slate-400"
                        autoFocus
                      />
                    </div>
                  ) : (
                    <div>
                      {medications.length > 0 ? (
                        <div className="flex flex-wrap gap-1 py-2">
                          {medications.map((med, index) => (
                            <span
                              key={index}
                              className="inline-block px-2 py-0.5 rounded-full bg-white/60 backdrop-blur-sm border border-white/40 text-[11px] text-slate-700 shadow-sm"
                            >
                              {med}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="text-[12px] text-slate-400 py-2">No medications added</div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[12px] text-slate-700 font-medium">
                      Precautions
                  </label>
                    {showPrecautionsInput ? (
                      <button
                        type="button"
                        onClick={() => setShowPrecautionsInput(false)}
                        className="text-[10px] text-slate-500 hover:text-slate-700"
                      >
                        Done
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowPrecautionsInput(true)}
                        className="text-[10px] font-medium text-[#72B01D] hover:text-[#6AA318] hover:underline"
                      >
                        + Add precaution
                      </button>
                    )}
                  </div>
                  {showPrecautionsInput ? (
                    <div className="flex flex-wrap gap-1 py-2 min-h-[28px]">
                      {precautions.map((precaution, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/60 backdrop-blur-sm border border-white/40 text-[11px] text-slate-700 shadow-sm"
                        >
                          {precaution}
                          <button
                            type="button"
                            onClick={() => {
                              const newTags = precautions.filter((_, i) => i !== index);
                              setPrecautions(newTags);
                      markUnsaved();
                            }}
                            className="text-slate-500 hover:text-slate-700 ml-0.5"
                            aria-label={`Remove ${precaution}`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      <input
                        type="text"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && (e.target as HTMLInputElement).value.trim()) {
                            e.preventDefault();
                            const value = (e.target as HTMLInputElement).value.trim();
                            if (!precautions.includes(value)) {
                              setPrecautions([...precautions, value]);
                              markUnsaved();
                            }
                            (e.target as HTMLInputElement).value = "";
                          } else if (e.key === "Backspace" && !(e.target as HTMLInputElement).value && precautions.length > 0) {
                            setPrecautions(precautions.slice(0, -1));
                            markUnsaved();
                          }
                        }}
                        placeholder={precautions.length === 0 ? "Type precaution and press Enter..." : ""}
                        className="flex-1 min-w-[120px] outline-none text-[11px] text-slate-900 bg-white/40 border border-dashed border-slate-300 rounded px-2 py-0.5 focus:border-[#72B01D] focus:bg-white/60 focus:outline-none placeholder:text-slate-400"
                        autoFocus
                      />
                    </div>
                  ) : (
                    <div>
                      {precautions.length > 0 ? (
                        <div className="flex flex-wrap gap-1 py-2">
                          {precautions.map((precaution, index) => (
                            <span
                              key={index}
                              className="inline-block px-2 py-0.5 rounded-full bg-white/60 backdrop-blur-sm border border-white/40 text-[11px] text-slate-700 shadow-sm"
                            >
                              {precaution}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="text-[12px] text-slate-400 py-2">No precautions added</div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[12px] text-slate-700 font-medium">
                    Existing conditions
                  </label>
                    {showExistingConditionInput ? (
                      <button
                        type="button"
                        onClick={() => setShowExistingConditionInput(false)}
                        className="text-[10px] text-slate-500 hover:text-slate-700"
                      >
                        Done
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowExistingConditionInput(true)}
                        className="text-[10px] font-medium text-[#72B01D] hover:text-[#6AA318] hover:underline"
                      >
                        + Add condition
                      </button>
                    )}
                  </div>
                  {showExistingConditionInput ? (
                    <div className="flex flex-wrap gap-1 py-2 min-h-[28px]">
                      {existingConditionsText.map((condition, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-[11px] text-slate-700"
                        >
                          {condition}
                          <button
                            type="button"
                            onClick={() => {
                              const newTags = existingConditionsText.filter((_, i) => i !== index);
                              setExistingConditionsText(newTags);
                      markUnsaved();
                            }}
                            className="text-slate-500 hover:text-slate-700 ml-0.5"
                            aria-label={`Remove ${condition}`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      <input
                        type="text"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && (e.target as HTMLInputElement).value.trim()) {
                            e.preventDefault();
                            const value = (e.target as HTMLInputElement).value.trim();
                            if (!existingConditionsText.includes(value)) {
                              setExistingConditionsText([...existingConditionsText, value]);
                              markUnsaved();
                            }
                            (e.target as HTMLInputElement).value = "";
                          } else if (e.key === "Backspace" && !(e.target as HTMLInputElement).value && existingConditionsText.length > 0) {
                            setExistingConditionsText(existingConditionsText.slice(0, -1));
                            markUnsaved();
                          }
                        }}
                        placeholder={existingConditionsText.length === 0 ? "Type condition and press Enter..." : ""}
                        className="flex-1 min-w-[120px] outline-none text-[11px] text-slate-900 bg-white/40 border border-dashed border-slate-300 rounded px-2 py-0.5 focus:border-[#72B01D] focus:bg-white/60 focus:outline-none placeholder:text-slate-400"
                        autoFocus
                  />
                </div>
                  ) : (
                    <div>
                      {existingConditionsText.length > 0 ? (
                        <div className="flex flex-wrap gap-1 py-2">
                          {existingConditionsText.map((condition, index) => (
                            <span
                              key={index}
                              className="inline-block px-2 py-0.5 rounded-full bg-slate-100 text-[11px] text-slate-700"
                            >
                              {condition}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="text-[12px] text-slate-400 py-2">No conditions added</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* MIDDLE PANE: Tonic Details */}
          <div className="flex-1 border-r border-slate-200 flex flex-col bg-white min-w-0">
            <div className="flex-shrink-0 p-4 border-b border-slate-200">
              <h2 className="text-[11px] font-semibold text-[#4B543B] uppercase tracking-wide">Tonic Details</h2>
              <span className="text-[10px] uppercase tracking-[0.15em] text-[#7D8472] mt-1 block">Prescription</span>
            </div>
            <div className="flex-1 overflow-y-auto stable-scroll p-4 space-y-4">
              <div className="grid gap-3">
                <div>
                  <label className="block text-[12px] mb-1 text-slate-700 font-medium">
                    Tonic name
                  </label>
                  <input
                    className="w-full bg-white/70 border border-slate-200 rounded-lg px-3 py-1.5 text-[11px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#72B01D66] focus:border-[#72B01D]"
                    value={tonicName}
                    onChange={(e) => {
                      markUnsaved();
                      setTonicName(e.target.value);
                    }}
                    placeholder=""
                  />
                </div>

                <div>
                  <label className="block text-[12px] mb-1 text-slate-700 font-medium">
                    Tonic purpose
                  </label>
                  <input
                    className="w-full bg-white/70 border border-slate-200 rounded-lg px-3 py-1.5 text-[11px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#72B01D66] focus:border-[#72B01D]"
                    value={tonicPurpose}
                    onChange={(e) => {
                      markUnsaved();
                      setTonicPurpose(e.target.value);
                    }}
                    placeholder=""
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-3 max-w-full">
                  <div>
                    <label className="block text-[12px] mb-1 text-slate-700 font-medium">
                      Bottle size
                    </label>
                    <select
                      className={`w-full bg-white/70 border border-slate-200 rounded-lg px-3 py-1.5 text-[11px]
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
                    <label className="block text-[12px] mb-1 text-slate-700 font-medium">
                      Dose (per serve)
                    </label>
                    <input
                      type="number"
                      min={0}
                      className="w-full bg-white/70 border border-slate-200 rounded-lg px-3 py-1.5 text-[11px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#72B01D66] focus:border-[#72B01D]"
                      value={doseMl}
                      onChange={(e) => {
                        markUnsaved();
                        setDoseMl(e.target.value);
                      }}
                      placeholder=""
                    />
                  </div>

                  <div>
                    <label className="block text-[12px] mb-1 text-slate-700 font-medium">
                      Frequency 
                    </label>
                    <input
                      type="number"
                      min={0}
                      className="w-full bg-white/70 border border-slate-200 rounded-lg px-3 py-1.5 text-[11px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#72B01D66] focus:border-[#72B01D]"
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
                  <label className="block text-[12px] mb-1 text-slate-700 font-medium">
                    Notes
                  </label>
                  <textarea
                    className="w-full bg-white/70 border border-slate-200 rounded-lg px-3 py-2 text-[11px] h-[90px] resize-none overflow-y-auto text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#72B01D66] focus:border-[#72B01D]"
                    value={patientInstructions}
                    onChange={(e) => {
                      markUnsaved();
                      setPatientInstructions(e.target.value);
                    }}
                    placeholder=""
                  />
                </div>
              </div>

              <div className="pt-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  {/* Status indicator - text only, left aligned */}
                  <div>
                    {saveStatus === "saved" && (
                      <span className="text-[11px] text-[#355925]">
                        All changes saved
                      </span>
                    )}

                    {saveStatus === "error" && (
                      <span className="text-[11px] text-red-700">
                        Save failed – check browser storage
                      </span>
                    )}

                    {saveStatus === "idle" && (
                      <span className="text-[11px] text-slate-600">
                        Unsaved changes
                      </span>
                    )}
                  </div>

                  {/* Buttons - right aligned */}
                  <div className="flex items-center gap-2">
                    {/* Reset button - Destructive, lowest emphasis */}
                    <button
                      type="button"
                      onClick={handleResetTonic}
                      disabled={
                        !currentTonicId && workspaceHerbs.length === 0 && !clientName && !tonicName
                      }
                      className="px-3 py-1.5 text-[12px] font-medium rounded-lg border border-slate-300 bg-white text-slate-600 disabled:opacity-40 hover:bg-slate-50 hover:text-slate-700"
                    >
                      Reset form
                    </button>

                    {/* Save button - Secondary, de-emphasized */}
                      <button
                        type="button"
                        onClick={handleSaveTonic}
                        disabled={workspaceHerbs.length === 0}
                      className="px-3 py-1.5 text-[12px] font-medium rounded-lg border border-slate-300 bg-white text-slate-700 disabled:opacity-40 hover:bg-slate-50"
                      >
                        Save
                      </button>

                    {/* Create button - Primary, most prominent */}
                      <button
                        type="button"
                      onClick={handleCreateOrEditTonic}
                      className="px-3 py-1.5 text-[12px] font-semibold rounded-lg border border-[#72B01D80] bg-[#72B01D] hover:bg-[#6AA318] text-white"
                    >
                      {currentTonicId ? "Edit bottle" : "Create tonic"}
                      </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT PANE: Workspace Bottle */}
          <div className="flex-1 flex flex-col bg-white min-w-0">
            <div className="flex-shrink-0 p-4 border-b border-slate-200">
              <h2 className="text-[11px] font-semibold text-[#4B543B] uppercase tracking-wide">Workspace Bottle</h2>
              <span className="text-[10px] uppercase tracking-[0.15em] text-[#7D8472] mt-1 block">Formula</span>
            </div>
            <div className="flex-1 overflow-y-auto stable-scroll p-4 space-y-4">

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
                      <div className="absolute inset-x-1 top-1/2 -translate-y-1/2 h-7 bg-white/90 border border-slate-300 rounded-lg flex items-center justify-center px-1">
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

              {/* Export action - only available after tonic is created */}
              {currentTonicId && workspaceHerbs.length > 0 && (
                <div className="mt-2 pt-3 border-t border-slate-200/80">
                  <button
                    type="button"
                    onClick={handleExportTonic}
                    className="w-full px-3 py-2 text-[12px] font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    Export formula
                  </button>
                </div>
              )}

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
          </div>
        </div>

        {/* FULL SCREEN HERB TABLE OVERLAY */}
        {isFullScreenTable && (
          <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/70 backdrop-blur-sm">
            <div className="flex items-center justify-between px-6 py-2 bg-white/95 border-b border-slate-200">
              <div className="flex flex-col justify-center">
                <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                  Herbal data
                </span>
                <span className="text-sm font-semibold text-slate-900 truncate">
                  {selectedCondition?.name || "Select a health concern"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    ensureTonicId();
                    setIsWorkspaceDrawerOpen(true);
                  }}
                  className="px-3 py-1.5 text-[12px] font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                >
                  Edit bottle
                </button>
                <button
                  type="button"
                  onClick={() => setIsExpandedView(false)}
                  className={`px-3 py-1.5 rounded-lg border text-[12px] font-medium ${
                    !isExpandedView
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  Compact
                </button>
                <button
                  type="button"
                  onClick={() => setIsExpandedView(true)}
                  className={`px-3 py-1.5 rounded-lg border text-[12px] font-medium ${
                    isExpandedView
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
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
                  className="px-3 py-1.5 text-[12px] font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
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
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-[11px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#72B01D66] focus:border-[#72B01D]"
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
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-[10px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#72B01D66] focus:border-[#72B01D] disabled:opacity-50"
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

  {!loading && !error && selectedConditionId && herbRows.length > 0 && (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      {renderHerbTable()}
    </div>
  )}

  {!loading && !error && !selectedConditionId && (
    <p className="text-sm text-slate-600 mt-2">
      Select a body system and health concern to view herbal data.
    </p>
  )}

  {!loading && !error && selectedConditionId && herbRows.length === 0 && (
    <p className="text-sm text-slate-600 mt-2">
      No herbs added yet for this concern.
    </p>
  )}

  {!loading && !error && plan === "free" && upgradeModalOpen && lockedChoice && (
    <p className="text-sm text-slate-700 mt-2">
      <b>{lockedChoice.name}</b> is locked on the Free plan. Upgrade to access it.
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
                  onClick={() => router.push("/app/upgrade")}
                  className="w-full px-4 py-2 text-[12px] rounded-lg bg-[#72B01D] hover:bg-[#6AA318] text-white font-semibold border border-[#72B01D]"
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
                    className="px-4 py-2 text-[12px] rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800"
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
                  Done
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

              <div className="p-4 overflow-y-auto stable-scroll space-y-4">
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

              <div className="px-6 py-4 space-y-4 overflow-y-auto stable-scroll text-sm text-slate-800">
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
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-sm">
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
{/* Therapeutic dosage helper */}
{(() => {
  if (!bottleVolumeMl) {
    return (
      <p className="text-[12px] mb-3 text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
        Select bottle size to calculate the therapeutic range.
      </p>
    );
  }

  const range = computeTherapeuticBottleRange(mlModalHerb, bottleVolumeMl, dailyDoseMl);
  if (range.low == null && range.high == null) return null;

  const lowRounded = range.low != null ? Math.ceil(range.low) : null;
  const highRounded = range.high != null ? Math.ceil(range.high) : null;

  let rangeText = "";
  if (lowRounded != null && highRounded != null) rangeText = `${lowRounded}–${highRounded} mL in bottle`;
  else if (lowRounded != null && highRounded == null) rangeText = `≥ ${lowRounded} mL in bottle`;
  else if (lowRounded == null && highRounded != null) rangeText = `≤ ${highRounded} mL in bottle`;

  if (!rangeText) return null;

  return (
    <p className="text-[12px] mb-2 text-slate-700">
      Therapeutic dosage for{" "}
      <span className="font-semibold text-slate-900">{bottleVolumeMl} mL</span>{" "}
      bottle: <span className="font-semibold text-slate-900">{rangeText}</span>
    </p>
  );
})()}
                <input
                  type="number"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 mb-4 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#72B01D66] focus:border-[#72B01D] appearance-none text-[11px]"
                  placeholder="e.g. 5"
                  value={mlModalValue}
                  onChange={(e) => setMlModalValue(e.target.value)}
                  autoFocus
                />

                {/* Buttons row WITH Quick Fill on the left */}
<div className="flex items-center justify-between gap-3">
  {/* LEFT SIDE — Quick Fill */}
  {(() => {
    if (!bottleVolumeMl) return null;

    // if editing an existing herb, subtract its current ml first
    const currentMl =
      mlModalIndex !== null &&
      mlModalIndex >= 0 &&
      workspaceHerbs[mlModalIndex]
        ? workspaceHerbs[mlModalIndex].ml
        : 0;

    const otherTotal = totalWorkspaceMl - currentMl;
    const quickFillTargetMl = Math.max(bottleVolumeMl - otherTotal, 0);

    return quickFillTargetMl > 0 ? (
      <button
        type="button"
        onClick={() => setMlModalValue(String(Math.round(quickFillTargetMl)))}
        className="px-3 py-2 text-[12px] rounded-lg border border-[#72B01D33] bg-[#F0F7E8] hover:bg-[#E3F0D7] text-slate-800"
      >
        Fill bottle ({Math.round(quickFillTargetMl)} mL)
      </button>
    ) : (
      <span />
    );
  })()}

  {/* RIGHT SIDE — Cancel + Confirm */}
  <div className="flex items-center gap-3">
    <button
      type="button"
      onClick={handleCloseMlModal}
      className="px-4 py-2 text-[12px] bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-300 text-slate-800"
    >
      Cancel
    </button>
    <button
      type="submit"
      className="px-4 py-2 text-[12px] bg-[#72B01D] hover:bg-[#6AA318] rounded-lg font-semibold text-white border border-[#72B01D]"
    >
      Confirm
    </button>
  </div>
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
                  className="px-4 py-2 text-sm bg-red-600 hover:bg-red-500 rounded-lg font-semibold text-white border border-red-500/80"
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create Client Modal */}
        {createClientModalOpen && (
          <div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-sm overflow-y-auto"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setCreateClientModalOpen(false);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setCreateClientModalOpen(false);
              }
            }}
            tabIndex={-1}
          >
            <div className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-2xl my-8 max-h-[90vh] flex flex-col">
              <div className="flex items-start justify-between p-6 pb-4">
                <h3 className="text-lg font-semibold text-slate-900">Create New Client</h3>
                <button
                  type="button"
                  onClick={() => setCreateClientModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 text-xl leading-none w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              <div className="px-6 pb-6 overflow-y-auto stable-scroll flex-1">

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] mb-1 text-slate-700 font-medium">
                      First Name *
                    </label>
                    <input
                      type="text"
                      value={newClientFirstName}
                      onChange={(e) => setNewClientFirstName(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-[11px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#72B01D66] focus:border-[#72B01D]"
                      placeholder="First name"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] mb-1 text-slate-700 font-medium">
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={newClientLastName}
                      onChange={(e) => setNewClientLastName(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-[11px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#72B01D66] focus:border-[#72B01D]"
                      placeholder="Last name"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] mb-1 text-slate-700 font-medium">
                      Email
                    </label>
                    <input
                      type="email"
                      value={newClientEmail}
                      onChange={(e) => setNewClientEmail(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-[11px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#72B01D66] focus:border-[#72B01D]"
                      placeholder="client@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] mb-1 text-slate-700 font-medium">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={newClientPhone}
                      onChange={(e) => setNewClientPhone(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-[11px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#72B01D66] focus:border-[#72B01D]"
                      placeholder="(000) 000-0000"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] mb-1 text-slate-700 font-medium">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={newClientDob}
                    onChange={(e) => setNewClientDob(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-[10px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#72B01D66] focus:border-[#72B01D]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] mb-1 text-slate-700 font-medium">
                    Medications
                  </label>
                  <TagInput
                    tags={newClientMedications}
                    onChange={setNewClientMedications}
                    placeholder="Type medication and press Enter..."
                  />
                </div>

                <div>
                  <label className="block text-[11px] mb-1 text-slate-700 font-medium">
                    Existing Conditions
                  </label>
                  <TagInput
                    tags={newClientExistingConditions}
                    onChange={setNewClientExistingConditions}
                    placeholder="Type condition and press Enter..."
                  />
                </div>

                <div>
                  <label className="block text-[12px] mb-1 text-slate-600 font-medium">
                    Precautions
                  </label>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={newClientFlags.pregnancy}
                        onChange={(e) =>
                          setNewClientFlags({ ...newClientFlags, pregnancy: e.target.checked })
                        }
                        className="rounded border-slate-300"
                      />
                      <span className="text-[12px] text-slate-700">Pregnant</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={newClientFlags.lactation}
                        onChange={(e) =>
                          setNewClientFlags({ ...newClientFlags, lactation: e.target.checked })
                        }
                        className="rounded border-slate-300"
                      />
                      <span className="text-[12px] text-slate-700">Lactation</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={newClientFlags.anticoagulants}
                        onChange={(e) =>
                          setNewClientFlags({ ...newClientFlags, anticoagulants: e.target.checked })
                        }
                        className="rounded border-slate-300"
                      />
                      <span className="text-[12px] text-slate-700">Anticoagulants</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={newClientFlags.pediatric}
                        onChange={(e) =>
                          setNewClientFlags({ ...newClientFlags, pediatric: e.target.checked })
                        }
                        className="rounded border-slate-300"
                      />
                      <span className="text-[12px] text-slate-700">Pediatric</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={newClientFlags.kidneyDisease}
                        onChange={(e) =>
                          setNewClientFlags({ ...newClientFlags, kidneyDisease: e.target.checked })
                        }
                        className="rounded border-slate-300"
                      />
                      <span className="text-[12px] text-slate-700">Kidney Disease</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={newClientFlags.liverDisease}
                        onChange={(e) =>
                          setNewClientFlags({ ...newClientFlags, liverDisease: e.target.checked })
                        }
                        className="rounded border-slate-300"
                      />
                      <span className="text-[12px] text-slate-700">Liver Disease</span>
                    </label>
                  </div>
                  <div>
                    <label className="block text-[12px] mb-1 text-slate-600 font-medium">
                      Other Precautions
                    </label>
                    <TagInput
                      tags={newClientOtherPrecautions}
                      onChange={setNewClientOtherPrecautions}
                      placeholder="Type precaution and press Enter..."
                    />
                  </div>
                </div>

                {/* Address Information Section */}
                <div className="border-t border-slate-200 pt-4 mt-4">
                  {!showAddressFields ? (
                    <button
                      type="button"
                      onClick={() => setShowAddressFields(true)}
                      className="text-[12px] text-[#72B01D] hover:text-[#6AA318] font-medium"
                    >
                      + Add address information
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-[12px] text-slate-600 font-medium">
                          Address Information
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowAddressFields(false)}
                          className="text-[11px] text-slate-500 hover:text-slate-700"
                        >
                          Hide
                        </button>
                      </div>
                      <div>
                        <label className="block text-[11px] mb-1 text-slate-700 font-medium">
                          Street 1
                        </label>
                        <input
                          type="text"
                          value={newClientStreet1}
                          onChange={(e) => setNewClientStreet1(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-[11px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#72B01D66] focus:border-[#72B01D]"
                          placeholder="Street address"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] mb-1 text-slate-700 font-medium">
                          Street 2
                        </label>
                        <input
                          type="text"
                          value={newClientStreet2}
                          onChange={(e) => setNewClientStreet2(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-[11px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#72B01D66] focus:border-[#72B01D]"
                          placeholder="Apartment, suite, etc. (optional)"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] mb-1 text-slate-700 font-medium">
                            Suburb/City
                          </label>
                          <input
                            type="text"
                            value={newClientSuburb}
                            onChange={(e) => setNewClientSuburb(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-[11px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#72B01D66] focus:border-[#72B01D]"
                            placeholder="Suburb or city"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] mb-1 text-slate-700 font-medium">
                            State/Region
                          </label>
                          <input
                            type="text"
                            value={newClientState}
                            onChange={(e) => setNewClientState(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-[11px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#72B01D66] focus:border-[#72B01D]"
                            placeholder="State or region"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] mb-1 text-slate-700 font-medium">
                            Postcode
                          </label>
                          <input
                            type="text"
                            value={newClientPostcode}
                            onChange={(e) => setNewClientPostcode(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-[11px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#72B01D66] focus:border-[#72B01D]"
                            placeholder="Postcode"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] mb-1 text-slate-700 font-medium">
                            Country
                          </label>
                          <select
                            value={newClientCountry}
                            onChange={(e) => setNewClientCountry(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-[11px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#72B01D66] focus:border-[#72B01D]"
                          >
                            <option value="">Select country...</option>
                            {COUNTRIES.map((country) => (
                              <option key={country} value={country}>
                                {country}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                </div>
              <div className="flex items-center justify-end gap-3 px-6 pb-6 pt-4 border-t border-slate-200 mt-auto">
                <button
                  type="button"
                  onClick={() => {
                    setCreateClientModalOpen(false);
                    setNewClientFirstName("");
                    setNewClientLastName("");
                    setNewClientEmail("");
                    setNewClientPhone("");
                    setNewClientDob("");
                    setNewClientFlags({
                      pregnancy: false,
                      lactation: false,
                      anticoagulants: false,
                      pediatric: false,
                      kidneyDisease: false,
                      liverDisease: false,
                    });
                    setNewClientMedications([]);
                    setNewClientExistingConditions([]);
                    setNewClientOtherPrecautions([]);
                    setShowAddressFields(false);
                    setNewClientStreet1("");
                    setNewClientStreet2("");
                    setNewClientSuburb("");
                    setNewClientState("");
                    setNewClientPostcode("");
                    setNewClientCountry("");
                  }}
                  className="px-4 py-2 text-[12px] rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!newClientFirstName.trim()) return;

                    setCreatingClient(true);
                    try {
                      const { data: userRes, error: userError } = await supabase.auth.getUser();
                      if (userError || !userRes.user) {
                        throw new Error("Not authenticated. Please sign in again.");
                      }

                      // For backward compatibility, also set full_name from first_name
                      const fullName = newClientFirstName.trim() + (newClientLastName.trim() ? ` ${newClientLastName.trim()}` : "");

                      const { data, error } = await supabase
                        .from("clients")
                        .insert({
                          user_id: userRes.user.id,
                          first_name: newClientFirstName.trim(),
                          last_name: newClientLastName.trim() || null,
                          full_name: fullName, // Keep for backward compatibility
                          email: newClientEmail.trim() || null,
                          phone: newClientPhone.trim() || null,
                          dob: newClientDob || null,
                          flags: {
                            ...newClientFlags,
                            otherPrecautions: newClientOtherPrecautions,
                            medications: newClientMedications,
                            existingConditions: newClientExistingConditions,
                          },
                          street1: newClientStreet1.trim() || null,
                          street2: newClientStreet2.trim() || null,
                          suburb: newClientSuburb.trim() || null,
                          state: newClientState.trim() || null,
                          postcode: newClientPostcode.trim() || null,
                          country: newClientCountry.trim() || null,
                        })
                        .select()
                        .single();

                      if (error) {
                        console.error("Supabase error creating client:", error);
                        
                        if (error.code === "42P01" || error.message?.includes("does not exist")) {
                          alert("The clients table does not exist yet. Please create it in your database first. See the SQL in the code comments.");
                          return;
                        }
                        
                        throw new Error(error.message || `Failed to create client: ${error.code || "Unknown error"}`);
                      }

                      if (!data) {
                        throw new Error("Client created but no data returned.");
                      }

                      // Update clients list
                      setClients((prev) => [...prev, data]);
                      setSelectedClientId(data.id);
                      setCreateClientModalOpen(false);
                      setNewClientFirstName("");
                      setNewClientLastName("");
                      setNewClientEmail("");
                      setNewClientPhone("");
                      setNewClientDob("");
                      setNewClientFlags({
                        pregnancy: false,
                        lactation: false,
                        anticoagulants: false,
                        pediatric: false,
                        kidneyDisease: false,
                        liverDisease: false,
                      });
                      setNewClientMedications([]);
                      setNewClientExistingConditions([]);
                      setNewClientOtherPrecautions([]);
                      setShowAddressFields(false);
                      setNewClientStreet1("");
                      setNewClientStreet2("");
                      setNewClientSuburb("");
                      setNewClientState("");
                      setNewClientPostcode("");
                      setNewClientCountry("");
                      markUnsaved();
                    } catch (e: any) {
                      console.error("Failed to create client:", e);
                      const errorMessage = e?.message || "Failed to create client. Please try again.";
                      alert(errorMessage);
                    } finally {
                      setCreatingClient(false);
                    }
                  }}
                  disabled={!newClientFirstName.trim() || creatingClient}
                  className="px-4 py-2 text-[12px] bg-[#72B01D] hover:bg-[#6AA318] rounded-lg font-semibold text-white border border-[#72B01D] disabled:opacity-50"
                >
                  {creatingClient ? "Creating..." : "Create Client"}
                </button>
              </div>
            </div>
          </div>
          </div>
        )}
      </MainContent>
    </>
  );
}
