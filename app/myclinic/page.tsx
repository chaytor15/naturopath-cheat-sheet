"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import AppHeader from "@/components/AppHeader";
import Sidebar from "@/components/Sidebar";
import MainContent from "@/components/MainContent";

type ConsultTypePricing = {
  id?: string;
  practitioner_id: string;
  consult_type: string;
  name: string;
  duration_minutes: number;
  price: number;
  is_custom: boolean;
  display_order: number;
  enabled: boolean;
};

type ClinicSettings = {
  timezone: string;
  email_templates: Record<string, {
    client_subject?: string;
    client_body?: string;
    practitioner_subject?: string;
    practitioner_body?: string;
  }>;
};

const DEFAULT_CONSULT_TYPES = [
  { consult_type: "initial", name: "Initial Consultation", duration_minutes: 60, price: 150, is_custom: false, display_order: 0 },
  { consult_type: "follow-up", name: "Follow-up Consultation", duration_minutes: 30, price: 100, is_custom: false, display_order: 1 },
  { consult_type: "check-in", name: "Check-in", duration_minutes: 15, price: 50, is_custom: false, display_order: 2 },
];

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function MyClinicPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [consultTypes, setConsultTypes] = useState<ConsultTypePricing[]>([]);
  const [clinicSettings, setClinicSettings] = useState<ClinicSettings>({
    timezone: "Australia/Sydney",
    email_templates: {},
  });
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [newConsultType, setNewConsultType] = useState({
    name: "",
    duration_minutes: 30,
    price: 100,
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/login");
      }
    });
  }, [router]);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load consult types
      const { data: consultTypesData, error: consultTypesError } = await supabase
        .from("consult_type_pricing")
        .select("*")
        .eq("practitioner_id", user.id)
        .order("display_order")
        .order("consult_type");

      if (consultTypesError) {
        console.error("Error loading consult types:", consultTypesError);
      }

      let types: ConsultTypePricing[] = consultTypesData || [];

      // If no types exist, initialize with defaults
      if (types.length === 0) {
        const defaultTypes = DEFAULT_CONSULT_TYPES.map((type) => ({
          ...type,
          practitioner_id: user.id,
          enabled: true,
        }));

        // Insert defaults
        const { error: insertError } = await supabase
          .from("consult_type_pricing")
          .insert(defaultTypes);

        if (!insertError) {
          types = defaultTypes;
        }
      }

      setConsultTypes(types);

      // Load clinic settings
      const { data: settingsData, error: settingsError } = await supabase
        .from("clinic_settings")
        .select("timezone, email_templates")
        .eq("user_id", user.id)
        .single();

      if (settingsError && settingsError.code !== "PGRST116") {
        console.error("Error loading clinic settings:", settingsError);
      }

      if (settingsData) {
        setClinicSettings({
          timezone: settingsData.timezone || "Australia/Sydney",
          email_templates: settingsData.email_templates || {},
        });
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConsultTypes = async () => {
    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Upsert all consult types
      const updates = consultTypes.map((type) => ({
        ...type,
        practitioner_id: user.id,
      }));

      const { error } = await supabase
        .from("consult_type_pricing")
        .upsert(updates, {
          onConflict: "practitioner_id,consult_type",
        });

      if (error) throw error;

      alert("Consult types saved successfully!");
    } catch (error: any) {
      console.error("Error saving consult types:", error);
      alert(`Error saving consult types: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleAddNewConsultType = async () => {
    if (!newConsultType.name.trim()) {
      alert("Please enter a consult type name");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const slug = generateSlug(newConsultType.name);
    const maxOrder = Math.max(...consultTypes.map((t) => t.display_order), -1);

    const newType: ConsultTypePricing = {
      practitioner_id: user.id,
      consult_type: slug,
      name: newConsultType.name,
      duration_minutes: newConsultType.duration_minutes,
      price: newConsultType.price,
      is_custom: true,
      display_order: maxOrder + 1,
      enabled: true,
    };

    setConsultTypes([...consultTypes, newType]);
    setNewConsultType({ name: "", duration_minutes: 30, price: 100 });
  };

  const handleDeleteConsultType = async (consultType: ConsultTypePricing) => {
    if (!confirm(`Delete "${consultType.name}"? This cannot be undone.`)) return;

    if (consultType.id) {
      const { error } = await supabase
        .from("consult_type_pricing")
        .delete()
        .eq("id", consultType.id);

      if (error) {
        alert(`Error deleting consult type: ${error.message}`);
        return;
      }
    }

    setConsultTypes(consultTypes.filter((t) => t.consult_type !== consultType.consult_type));
  };

  const handleUpdateConsultType = (index: number, field: keyof ConsultTypePricing, value: any) => {
    const updated = [...consultTypes];
    updated[index] = { ...updated[index], [field]: value };
    setConsultTypes(updated);
  };

  const handleSaveEmailTemplates = async () => {
    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("clinic_settings")
        .upsert({
          user_id: user.id,
          timezone: clinicSettings.timezone,
          email_templates: clinicSettings.email_templates,
        }, {
          onConflict: "user_id",
        });

      if (error) throw error;

      alert("Email templates saved successfully!");
      setEditingTemplate(null);
    } catch (error: any) {
      console.error("Error saving email templates:", error);
      alert(`Error saving email templates: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateEmailTemplate = (consultType: string, field: string, value: string) => {
    setClinicSettings({
      ...clinicSettings,
      email_templates: {
        ...clinicSettings.email_templates,
        [consultType]: {
          ...clinicSettings.email_templates[consultType],
          [field]: value,
        },
      },
    });
  };

  if (loading) {
    return (
      <>
        <AppHeader />
        <Sidebar />
        <MainContent>
          <div className="p-8">Loading...</div>
        </MainContent>
      </>
    );
  }

  const handleSaveTimezone = async () => {
    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("clinic_settings")
        .upsert({
          user_id: user.id,
          timezone: clinicSettings.timezone,
          email_templates: clinicSettings.email_templates,
        }, {
          onConflict: "user_id",
        });

      if (error) throw error;

      alert("Timezone saved successfully!");
    } catch (error: any) {
      console.error("Error saving timezone:", error);
      alert(`Error saving timezone: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Common timezones
  const timezones = [
    { value: "Pacific/Auckland", label: "Auckland, New Zealand (NZST/NZDT)" },
    { value: "Australia/Sydney", label: "Sydney, Australia (AEST/AEDT)" },
    { value: "Australia/Melbourne", label: "Melbourne, Australia (AEST/AEDT)" },
    { value: "Australia/Brisbane", label: "Brisbane, Australia (AEST)" },
    { value: "Australia/Adelaide", label: "Adelaide, Australia (ACST/ACDT)" },
    { value: "Australia/Perth", label: "Perth, Australia (AWST)" },
    { value: "Europe/London", label: "London, UK (GMT/BST)" },
    { value: "Europe/Paris", label: "Paris, France (CET/CEST)" },
    { value: "Europe/Berlin", label: "Berlin, Germany (CET/CEST)" },
    { value: "America/New_York", label: "New York, USA (EST/EDT)" },
    { value: "America/Chicago", label: "Chicago, USA (CST/CDT)" },
    { value: "America/Denver", label: "Denver, USA (MST/MDT)" },
    { value: "America/Los_Angeles", label: "Los Angeles, USA (PST/PDT)" },
    { value: "America/Toronto", label: "Toronto, Canada (EST/EDT)" },
    { value: "Asia/Tokyo", label: "Tokyo, Japan (JST)" },
    { value: "Asia/Hong_Kong", label: "Hong Kong (HKT)" },
    { value: "Asia/Singapore", label: "Singapore (SGT)" },
  ];

  return (
    <>
      <AppHeader />
      <Sidebar />
      <MainContent>
        <div className="p-8">
          <h1 className="text-2xl font-semibold mb-6 text-slate-900">My Clinic</h1>

          {/* Timezone Section */}
          <div className="rounded-2xl border border-white/50 bg-white/80 backdrop-blur-lg p-6 shadow-lg shadow-black/5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Clinic Timezone</h2>
                <p className="text-sm text-slate-600 mt-1">
                  Set your clinic's timezone. All booking times will be displayed in this timezone for clients.
                </p>
              </div>
              <button
                onClick={handleSaveTimezone}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium rounded-md bg-[#72B01D] hover:bg-[#6AA318] text-white disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Timezone"}
              </button>
            </div>
            <div className="max-w-md">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Timezone
              </label>
              <select
                value={clinicSettings.timezone}
                onChange={(e) => setClinicSettings({ ...clinicSettings, timezone: e.target.value })}
                className="w-full px-4 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                {timezones.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-2">
                Clients will see booking times in this timezone, regardless of their location.
              </p>
            </div>
          </div>

          {/* Consultation Types Section */}
          <div className="rounded-2xl border border-white/50 bg-white/80 backdrop-blur-lg p-6 shadow-lg shadow-black/5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Consultation Types</h2>
                <p className="text-sm text-slate-600 mt-1">
                  Manage your consultation types, durations, and pricing
                </p>
              </div>
              <button
                onClick={handleSaveConsultTypes}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium rounded-md bg-[#72B01D] hover:bg-[#6AA318] text-white disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>

            {/* Existing Consult Types */}
            <div className="space-y-4 mb-6">
              {consultTypes.map((type, index) => (
                <div
                  key={type.consult_type}
                  className="p-4 border border-slate-200 rounded-lg bg-white"
                >
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Name
                      </label>
                      <input
                        type="text"
                        value={type.name}
                        onChange={(e) => handleUpdateConsultType(index, "name", e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                        disabled={!type.is_custom}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Duration (minutes)
                      </label>
                      <input
                        type="number"
                        value={type.duration_minutes}
                        onChange={(e) => handleUpdateConsultType(index, "duration_minutes", parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Price ($)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={type.price}
                        onChange={(e) => handleUpdateConsultType(index, "price", parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                      />
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={type.enabled}
                          onChange={(e) => handleUpdateConsultType(index, "enabled", e.target.checked)}
                          className="rounded"
                        />
                        <span className="text-sm text-slate-700">Enabled</span>
                      </label>
                    </div>
                    <div className="flex items-end">
                      {type.is_custom && (
                        <button
                          onClick={() => handleDeleteConsultType(type)}
                          className="px-3 py-2 text-sm font-medium rounded-md border border-red-300 bg-red-50 hover:bg-red-100 text-red-700"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Add New Consult Type */}
            <div className="p-4 border-2 border-dashed border-slate-300 rounded-lg">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Add New Consult Type</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={newConsultType.name}
                    onChange={(e) => setNewConsultType({ ...newConsultType, name: e.target.value })}
                    placeholder="e.g., Extended Consultation"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Duration (minutes)
                  </label>
                  <input
                    type="number"
                    value={newConsultType.duration_minutes}
                    onChange={(e) => setNewConsultType({ ...newConsultType, duration_minutes: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Price ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={newConsultType.price}
                    onChange={(e) => setNewConsultType({ ...newConsultType, price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleAddNewConsultType}
                    className="w-full px-4 py-2 text-sm font-medium rounded-md bg-[#72B01D] hover:bg-[#6AA318] text-white"
                  >
                    Add Type
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Email Templates Section */}
          <div className="rounded-2xl border border-white/50 bg-white/80 backdrop-blur-lg p-6 shadow-lg shadow-black/5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Email Templates</h2>
                <p className="text-sm text-slate-600 mt-1">
                  Customize email templates for each consultation type
                </p>
              </div>
              {editingTemplate && (
                <button
                  onClick={handleSaveEmailTemplates}
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium rounded-md bg-[#72B01D] hover:bg-[#6AA318] text-white disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Templates"}
                </button>
              )}
            </div>

            <div className="space-y-4">
              {consultTypes.filter((t) => t.enabled).map((type) => {
                const template = clinicSettings.email_templates[type.consult_type] || {};
                const isEditing = editingTemplate === type.consult_type;

                return (
                  <div key={type.consult_type} className="p-4 border border-slate-200 rounded-lg bg-white">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-slate-900">{type.name}</h3>
                      <button
                        onClick={() => setEditingTemplate(isEditing ? null : type.consult_type)}
                        className="px-3 py-1.5 text-sm font-medium rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700"
                      >
                        {isEditing ? "Cancel" : "Edit Template"}
                      </button>
                    </div>

                    {isEditing && (
                      <div className="space-y-4 mt-4">
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            Client Email Subject
                          </label>
                          <input
                            type="text"
                            value={template.client_subject || ""}
                            onChange={(e) => handleUpdateEmailTemplate(type.consult_type, "client_subject", e.target.value)}
                            placeholder="Appointment Confirmation"
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            Client Email Body
                          </label>
                          <textarea
                            value={template.client_body || ""}
                            onChange={(e) => handleUpdateEmailTemplate(type.consult_type, "client_body", e.target.value)}
                            placeholder="Dear {{client_name}}, your appointment is confirmed..."
                            rows={6}
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            Practitioner Email Subject
                          </label>
                          <input
                            type="text"
                            value={template.practitioner_subject || ""}
                            onChange={(e) => handleUpdateEmailTemplate(type.consult_type, "practitioner_subject", e.target.value)}
                            placeholder="New Appointment Booking"
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            Practitioner Email Body
                          </label>
                          <textarea
                            value={template.practitioner_body || ""}
                            onChange={(e) => handleUpdateEmailTemplate(type.consult_type, "practitioner_body", e.target.value)}
                            placeholder="You have a new appointment..."
                            rows={6}
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </MainContent>
    </>
  );
}

