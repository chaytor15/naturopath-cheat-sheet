"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import AppHeader from "@/components/AppHeader";
import Sidebar from "@/components/Sidebar";
import MainContent from "@/components/MainContent";
import TagInput from "@/components/TagInput";

type Client = {
  id: string;
  user_id: string;
  full_name?: string; // Keep for backward compatibility, will migrate to first_name/last_name
  first_name?: string;
  last_name?: string;
  email: string | null;
  phone: string | null;
  dob: string | null;
  tags: string[] | null;
  flags: {
    pregnancy?: boolean;
    lactation?: boolean;
    anticoagulants?: boolean;
    pediatric?: boolean;
    kidneyDisease?: boolean;
    liverDisease?: boolean;
    otherPrecautions?: string[]; // Changed from allergies to otherPrecautions (array)
    medications?: string | string[];
    existingConditions?: string | string[];
  } | null;
  created_at: string;
  last_interaction_at: string | null;
};

type ClientNote = {
  id: string;
  client_id: string;
  user_id: string;
  note: string;
  created_at: string;
};

type Formula = {
  id: string;
  client_id: string | null;
  user_id: string;
  title: string | null;
  status: "draft" | "final";
  created_at: string;
  formula_data?: any; // JSONB field storing full tonic data
};

export default function ClientsPage() {
  const router = useRouter();

  // Helper function to get display name (handles migration from full_name to first_name/last_name)
  const getClientDisplayName = (client: Client): string => {
    if (client.first_name || client.last_name) {
      return `${client.first_name || ""} ${client.last_name || ""}`.trim();
    }
    return client.full_name || "Unnamed Client";
  };

  // Helper function to get last interaction date (most recent of client creation, formulas, or notes)
  const getLastInteractionDate = (client: Client): string => {
    const dates: Date[] = [new Date(client.created_at)];
    
    // Check all formulas for this client
    const clientFormulas = allFormulas.filter(f => f.client_id === client.id);
    clientFormulas.forEach(f => {
      if (f.created_at) dates.push(new Date(f.created_at));
    });
    
    // Check all notes for this client
    const clientNotes = allNotes.filter(n => n.client_id === client.id);
    clientNotes.forEach(n => {
      if (n.created_at) dates.push(new Date(n.created_at));
    });
    
    // Return the most recent date
    return new Date(Math.max(...dates.map(d => d.getTime()))).toISOString();
  };

  // Helper function to check if client is active (last interaction within 30 days)
  const isClientActive = (lastInteractionDate: string): boolean => {
    const lastInteraction = new Date(lastInteractionDate);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return lastInteraction >= thirtyDaysAgo;
  };

  // Format last interaction date
  const formatLastInteraction = (date: string): string => {
    const d = new Date(date);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [notes, setNotes] = useState<ClientNote[]>([]);
  const [formulas, setFormulas] = useState<Formula[]>([]);
  // Store all formulas and notes for all clients to calculate last interaction
  const [allFormulas, setAllFormulas] = useState<Formula[]>([]);
  const [allNotes, setAllNotes] = useState<ClientNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newClientFirstName, setNewClientFirstName] = useState("");
  const [newClientLastName, setNewClientLastName] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [creating, setCreating] = useState(false);

  // Form state for editing client
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editDob, setEditDob] = useState("");
  const [editFlags, setEditFlags] = useState({
    pregnancy: false,
    lactation: false,
    anticoagulants: false,
    pediatric: false,
    kidneyDisease: false,
    liverDisease: false,
  });
  const [editOtherPrecautions, setEditOtherPrecautions] = useState<string[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "unsaved" | "saving">("saved");

  // New note state
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  // Active tab state
  const [activeTab, setActiveTab] = useState<"overview" | "notes" | "formulas" | "profile">("overview");
  
  // Client list collapse state
  const [isClientListCollapsed, setIsClientListCollapsed] = useState(false);

  // Edit mode for snapshot
  const [isEditingSnapshot, setIsEditingSnapshot] = useState(false);

  // Client medications and existing conditions (synced from workspace) - stored as arrays
  const [editMedications, setEditMedications] = useState<string[]>([]);
  const [editExistingConditions, setEditExistingConditions] = useState<string[]>([]);

  // New client form state (for modal)
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
  const [newClientOtherPrecautions, setNewClientOtherPrecautions] = useState<string[]>([]);
  const [newClientMedications, setNewClientMedications] = useState<string[]>([]);
  const [newClientExistingConditions, setNewClientExistingConditions] = useState<string[]>([]);

  // Auth check
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/login");
      }
    });
  }, [router]);

  // Load clients and all formulas/notes for last interaction calculation
  useEffect(() => {
    const loadClients = async () => {
      try {
        const { data: userRes } = await supabase.auth.getUser();
        if (!userRes.user) return;

        // Load clients
        const { data, error } = await supabase
          .from("clients")
          .select("*")
          .eq("user_id", userRes.user.id)
          .order("created_at", { ascending: false });

        if (error) {
          // If table doesn't exist, just set empty array
          if (error.code === "42P01" || error.message?.includes("does not exist")) {
            console.log("Clients table does not exist yet.");
            setClients([]);
            setLoading(false);
            return;
          }
          throw error;
        }
        
        // Migrate full_name to first_name for existing clients
        const migratedClients = (data || []).map((client: any) => {
          if (client.full_name && !client.first_name) {
            return {
              ...client,
              first_name: client.full_name,
              last_name: null,
            };
          }
          return client;
        });
        
        setClients(migratedClients);

        // Load all formulas for all clients
        const { data: formulasData, error: formulasError } = await supabase
          .from("formulas")
          .select("id, client_id, created_at")
          .eq("user_id", userRes.user.id)
          .order("created_at", { ascending: false });

        if (!formulasError && formulasData) {
          setAllFormulas(formulasData as Formula[]);
        }

        // Load all notes for all clients
        const { data: notesData, error: notesError } = await supabase
          .from("client_notes")
          .select("id, client_id, created_at")
          .eq("user_id", userRes.user.id)
          .order("created_at", { ascending: false });

        if (!notesError && notesData) {
          setAllNotes(notesData as ClientNote[]);
        }
      } catch (e: any) {
        console.error("Failed to load clients:", e);
        setError(e?.message || "Failed to load clients");
      } finally {
        setLoading(false);
      }
    };

    loadClients();
  }, []);

  // Load client details when selected
  useEffect(() => {
    if (!selectedClient) {
      setNotes([]);
      setFormulas([]);
      return;
    }

    const loadDetails = async () => {
      try {
        const { data: userRes } = await supabase.auth.getUser();
        if (!userRes.user) return;

        // Load notes
        const { data: notesData, error: notesError } = await supabase
          .from("client_notes")
          .select("*")
          .eq("client_id", selectedClient.id)
          .eq("user_id", userRes.user.id)
          .order("created_at", { ascending: false });

        if (notesError) throw notesError;
        setNotes(notesData || []);

        // Load formulas
        const { data: formulasData, error: formulasError } = await supabase
          .from("formulas")
          .select("*")
          .eq("client_id", selectedClient.id)
          .eq("user_id", userRes.user.id)
          .order("created_at", { ascending: false })
          .limit(5);

        if (formulasError) throw formulasError;
        setFormulas(formulasData || []);

        // Reload all formulas and notes to update last interaction dates
        const { data: allFormulasData } = await supabase
          .from("formulas")
          .select("id, client_id, created_at")
          .eq("user_id", userRes.user.id)
          .order("created_at", { ascending: false });

        if (allFormulasData) {
          setAllFormulas(allFormulasData as Formula[]);
        }

        const { data: allNotesData } = await supabase
          .from("client_notes")
          .select("id, client_id, created_at")
          .eq("user_id", userRes.user.id)
          .order("created_at", { ascending: false });

        if (allNotesData) {
          setAllNotes(allNotesData as ClientNote[]);
        }

        // Initialize edit form
        // Migrate full_name to first_name if needed
        if (selectedClient.full_name && !selectedClient.first_name) {
          setEditFirstName(selectedClient.full_name);
          setEditLastName("");
        } else {
          setEditFirstName(selectedClient.first_name || "");
          setEditLastName(selectedClient.last_name || "");
        }
        setEditEmail(selectedClient.email || "");
        setEditPhone(selectedClient.phone || "");
        setEditDob(selectedClient.dob || "");
        setEditFlags({
          pregnancy: selectedClient.flags?.pregnancy || false,
          lactation: selectedClient.flags?.lactation || false,
          anticoagulants: selectedClient.flags?.anticoagulants || false,
          pediatric: selectedClient.flags?.pediatric || false,
          kidneyDisease: selectedClient.flags?.kidneyDisease || false,
          liverDisease: selectedClient.flags?.liverDisease || false,
        });
        // Handle otherPrecautions (migrated from allergies)
        const otherPrecautions = selectedClient.flags?.otherPrecautions || [];
        setEditOtherPrecautions(Array.isArray(otherPrecautions) ? otherPrecautions : []);
        const medications = selectedClient.flags?.medications;
        const existingConditions = selectedClient.flags?.existingConditions;
        setEditMedications(Array.isArray(medications) ? medications : medications ? [medications] : []);
        setEditExistingConditions(Array.isArray(existingConditions) ? existingConditions : existingConditions ? [existingConditions] : []);
        setHasUnsavedChanges(false);
        setSaveStatus("saved");
        setIsEditingSnapshot(false); // Reset edit mode when selecting a client
      } catch (e: any) {
        setError(e?.message || "Failed to load client details");
      }
    };

    loadDetails();
  }, [selectedClient]);

  // Filter clients
  const filteredClients = clients.filter((client) => {
    const displayName = getClientDisplayName(client);
    const matchesSearch = displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (client.email && client.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (client.tags && client.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())));
    
    return matchesSearch;
  });

  // Keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder*="Search by name"]') as HTMLInputElement;
        searchInput?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Calculate age from DOB
  const calculateAge = (dob: string | null): string | null => {
    if (!dob) return null;
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age.toString();
  };


  // Save client updates
  const handleSaveClient = async () => {
    if (!selectedClient) return;

    setSaving(true);
    setSaveStatus("saving");
    try {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) throw new Error("Not authenticated");

      // Merge flags with existing flags to preserve any other fields
      // Explicitly set each flag to ensure false values are saved
      const updatedFlags = {
        ...(selectedClient.flags || {}),
        pregnancy: editFlags.pregnancy === true,
        lactation: editFlags.lactation === true,
        anticoagulants: editFlags.anticoagulants === true,
        pediatric: editFlags.pediatric === true,
        kidneyDisease: editFlags.kidneyDisease === true,
        liverDisease: editFlags.liverDisease === true,
        otherPrecautions: editOtherPrecautions,
        medications: editMedications,
        existingConditions: editExistingConditions,
      };

      console.log("Updating client with:", {
        id: selectedClient.id,
        first_name: editFirstName.trim(),
        last_name: editLastName.trim(),
        flags: updatedFlags,
      });

      // Combine first_name and last_name into full_name for backward compatibility
      const fullName = `${editFirstName.trim()} ${editLastName.trim()}`.trim() || null;

      const { error, data } = await supabase
        .from("clients")
        .update({
          first_name: editFirstName.trim() || null,
          last_name: editLastName.trim() || null,
          full_name: fullName, // Keep for backward compatibility
          email: editEmail.trim() || null,
          phone: editPhone.trim() || null,
          dob: editDob || null,
          flags: updatedFlags,
        })
        .eq("id", selectedClient.id)
        .eq("user_id", userRes.user.id)
        .select();

      if (error) {
        console.error("Supabase error details:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          fullError: error,
        });
        throw new Error(error.message || error.details || `Failed to save client: ${JSON.stringify(error)}`);
      }
      
      if (!data || data.length === 0) {
        throw new Error("No data returned from update - client may not exist or you may not have permission");
      }
      
      console.log("Successfully saved client:", data);

      // Update local state
      // Store first_name and last_name in the client object for display purposes
      const updatedClient: Client = {
        ...selectedClient,
        first_name: editFirstName.trim() || undefined,
        last_name: editLastName.trim() || undefined,
        full_name: fullName || undefined, // Also update full_name for backward compatibility
        email: editEmail.trim() || null,
        phone: editPhone.trim() || null,
        dob: editDob || null,
        flags: updatedFlags,
      };
      setSelectedClient(updatedClient);
      setClients(clients.map((c) => (c.id === selectedClient.id ? updatedClient : c)));

      setHasUnsavedChanges(false);
      setSaveStatus("saved");
    } catch (e: any) {
      const errorMessage = e?.message || e?.toString() || JSON.stringify(e) || "Failed to save client";
      console.error("Error in handleSaveClient:", e);
      setError(errorMessage);
      setSaveStatus("unsaved");
      alert(`Error saving client: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  // Add note
  const handleAddNote = async () => {
    if (!selectedClient || !newNote.trim()) return;

    setAddingNote(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("client_notes")
        .insert({
          client_id: selectedClient.id,
          user_id: userRes.user.id,
          note: newNote.trim(),
        })
        .select()
        .single();

      if (error) throw error;

      setNotes([data, ...notes]);
      // Update allNotes for last interaction calculation
      setAllNotes([data, ...allNotes]);
      setNewNote("");
    } catch (e: any) {
      setError(e?.message || "Failed to add note");
    } finally {
      setAddingNote(false);
    }
  };

  // Track form changes
  useEffect(() => {
    if (!selectedClient) return;

    const currentFirstName = selectedClient.first_name || (selectedClient.full_name || "");
    const currentLastName = selectedClient.last_name || "";
    const currentOtherPrecautions = selectedClient.flags?.otherPrecautions || [];
    
    const hasChanges =
      editFirstName !== currentFirstName ||
      editLastName !== currentLastName ||
      editEmail !== (selectedClient.email || "") ||
      editPhone !== (selectedClient.phone || "") ||
      editDob !== (selectedClient.dob || "") ||
      editFlags.pregnancy !== (selectedClient.flags?.pregnancy || false) ||
      editFlags.lactation !== (selectedClient.flags?.lactation || false) ||
      editFlags.anticoagulants !== (selectedClient.flags?.anticoagulants || false) ||
      editFlags.pediatric !== (selectedClient.flags?.pediatric || false) ||
      editFlags.kidneyDisease !== (selectedClient.flags?.kidneyDisease || false) ||
      editFlags.liverDisease !== (selectedClient.flags?.liverDisease || false) ||
      JSON.stringify(editOtherPrecautions) !== JSON.stringify(currentOtherPrecautions) ||
      JSON.stringify(editMedications) !== JSON.stringify(Array.isArray(selectedClient.flags?.medications) ? selectedClient.flags.medications : selectedClient.flags?.medications ? [selectedClient.flags.medications] : []) ||
      JSON.stringify(editExistingConditions) !== JSON.stringify(Array.isArray(selectedClient.flags?.existingConditions) ? selectedClient.flags.existingConditions : selectedClient.flags?.existingConditions ? [selectedClient.flags.existingConditions] : []);

    setHasUnsavedChanges(hasChanges);
    if (hasChanges && saveStatus === "saved") {
      setSaveStatus("unsaved");
    }
  }, [editFirstName, editLastName, editEmail, editPhone, editDob, editFlags, editOtherPrecautions, editMedications, editExistingConditions, selectedClient, saveStatus]);

  return (
    <>
      <AppHeader />
      <Sidebar />
      <MainContent className="h-screen flex flex-col">
        <div className="flex-1 flex min-h-0">
          {/* LEFT PANEL: Client List - Full Height Library */}
          <div className={`${isClientListCollapsed ? 'w-[70px] lg:w-[70px]' : 'w-full lg:w-1/4'} flex flex-col h-full ${!isClientListCollapsed ? 'border-r border-slate-200' : ''} bg-white overflow-hidden transition-all duration-300`}>
              {/* Sticky Header */}
              <div className="flex-shrink-0 p-4 border-b border-slate-200 bg-white/90">
                {isClientListCollapsed ? (
                  <div className="flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => setIsClientListCollapsed(!isClientListCollapsed)}
                      className="p-2 rounded-lg hover:bg-black/5 transition-colors text-[#4B543B]"
                      aria-label="Expand client list"
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
                ) : (
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-[13px] font-semibold tracking-wide text-[#4B543B]">
                      Clients
                    </h2>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCreateModalOpen(true)}
                        className="text-[10px] font-medium text-[#72B01D] hover:text-[#6AA318] hover:underline"
                      >
                        + New client
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsClientListCollapsed(!isClientListCollapsed)}
                        className="p-2 rounded-lg hover:bg-black/5 transition-colors text-[#4B543B]"
                        aria-label="Collapse client list"
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
                )}

                {!isClientListCollapsed && (
                  <>
                    {/* Search Input with Icon */}
                    <div className="relative mb-3">
                      <svg
                        className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <input
                        type="text"
                        placeholder="Search by name, email, tag…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-16 py-2 rounded-lg border border-slate-200 bg-white/70 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#72B01D66] focus:border-[#72B01D]"
                      />
                      <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[10px] text-slate-400">
                        Ctrl K
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Scrollable List or Collapsed Text */}
              {isClientListCollapsed ? (
                <div className="flex-1 flex items-start justify-center pt-4 px-4">
                  <span className="text-[15px] font-semibold text-[#4B543B] whitespace-nowrap leading-tight" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', letterSpacing: '0.05em' }}>
                    Client List
                  </span>
                </div>
              ) : (
              <div className="flex-1 overflow-y-auto stable-scroll [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-slate-400">
                {loading ? (
                  <div className="px-4 py-3">
                    <p className="text-[13px] text-slate-600">Loading...</p>
                  </div>
                ) : filteredClients.length === 0 ? (
                  <div className="px-4 py-3">
                    <p className="text-[13px] text-slate-600">
                      {searchQuery ? "No matches for your search." : "No clients yet."}
                    </p>
                  </div>
                ) : (
                  <div>
                    {filteredClients.map((client, index) => {
                      const lastInteractionDate = getLastInteractionDate(client);
                      const isActive = isClientActive(lastInteractionDate);
                      const isSelected = selectedClient?.id === client.id;
                      
                      return (
                        <button
                          key={client.id}
                          type="button"
                          onClick={() => setSelectedClient(client)}
                          className={`w-full text-left px-4 py-3 border-b border-slate-200 transition-colors ${
                            isSelected
                              ? "bg-slate-50 border-l-2 border-l-[#72B01D]"
                              : "hover:bg-[#EDEFE6]"
                          } ${index % 2 === 0 ? "bg-white/80" : "bg-[#F7F8F3]/80"}`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-[13px] text-slate-900 truncate">
                                {getClientDisplayName(client)}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              )}

              {/* Footer with Count */}
              {!isClientListCollapsed && (
              <div className="flex-shrink-0 px-4 py-2 border-t border-slate-200 bg-white/90">
                <p className="text-[10px] text-slate-500 text-center">
                  {filteredClients.length} {filteredClients.length === 1 ? "client" : "clients"}
                </p>
              </div>
              )}
            </div>

          {/* RIGHT PANEL: Client Detail */}
          <div className={`hidden lg:flex ${isClientListCollapsed ? 'lg:w-full' : 'lg:w-3/4'} flex justify-center stable-scroll bg-[#F7F8F3]`}>
            <div className="w-full max-w-3xl p-6">
                {!selectedClient ? (
                  <div className="flex items-center justify-center h-full min-h-[400px]">
                    <p className="text-[13px] text-slate-500">Select a client</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Client Context Header - Not a card, just orientation */}
                    <div className="pb-4 border-b border-slate-200">
                      <div className="flex items-start justify-between mb-3">
                        <h1 className="text-2xl font-semibold text-slate-900">
                          {getClientDisplayName(selectedClient)}
                        </h1>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveTab("profile");
                              // Re-initialize edit flags when starting to edit
                              if (selectedClient) {
                                setEditFlags({
                                  pregnancy: selectedClient.flags?.pregnancy || false,
                                  lactation: selectedClient.flags?.lactation || false,
                                  anticoagulants: selectedClient.flags?.anticoagulants || false,
                                  pediatric: selectedClient.flags?.pediatric || false,
                                  kidneyDisease: selectedClient.flags?.kidneyDisease || false,
                                  liverDisease: selectedClient.flags?.liverDisease || false,
                                });
                              }
                              setIsEditingSnapshot(true);
                            }}
                            className="px-3 py-1.5 text-[12px] font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700"
                          >
                            Edit Client
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              router.push(`/app?client=${selectedClient.id}`);
                            }}
                            className="px-3 py-1.5 text-[12px] font-semibold rounded-lg border border-[#72B01D80] bg-[#72B01D] hover:bg-[#6AA318] text-white"
                          >
                            + New Tonic
                          </button>
                        </div>
                      </div>
                      
                      {/* Medications and Precautions - all on one line */}
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {/* Medications */}
                        {editMedications.map((med, index) => (
                          <span
                            key={`med-${index}`}
                            className="inline-block px-2.5 py-1 rounded-full bg-white/60 backdrop-blur-sm border border-white/40 text-[11px] text-slate-700 shadow-sm"
                          >
                            {med}
                          </span>
                        ))}
                        
                        {/* Precautions - subtle warning emphasis */}
                        {selectedClient.flags?.pregnancy && (
                          <span className="inline-block px-2.5 py-1 rounded-full bg-pink-50/60 backdrop-blur-sm border border-pink-200/50 text-[11px] text-pink-700 shadow-sm">
                            Pregnant
                          </span>
                        )}
                        {selectedClient.flags?.lactation && (
                          <span className="inline-block px-2.5 py-1 rounded-full bg-blue-50/60 backdrop-blur-sm border border-blue-200/50 text-[11px] text-blue-700 shadow-sm">
                            Lactation
                          </span>
                        )}
                        {selectedClient.flags?.anticoagulants && (
                          <span className="inline-block px-2.5 py-1 rounded-full bg-orange-50/60 backdrop-blur-sm border border-orange-200/50 text-[11px] text-orange-700 shadow-sm">
                            Anticoagulants
                          </span>
                        )}
                        {selectedClient.flags?.pediatric && (
                          <span className="inline-block px-2.5 py-1 rounded-full bg-purple-50/60 backdrop-blur-sm border border-purple-200/50 text-[11px] text-purple-700 shadow-sm">
                            Pediatric
                          </span>
                        )}
                        {selectedClient.flags?.kidneyDisease && (
                          <span className="inline-block px-2.5 py-1 rounded-full bg-amber-50/60 backdrop-blur-sm border border-amber-200/50 text-[11px] text-amber-700 shadow-sm">
                            Kidney Disease
                          </span>
                        )}
                        {selectedClient.flags?.liverDisease && (
                          <span className="inline-block px-2.5 py-1 rounded-full bg-yellow-50/60 backdrop-blur-sm border border-yellow-200/50 text-[11px] text-yellow-700 shadow-sm">
                            Liver Disease
                          </span>
                        )}
                        {selectedClient.flags?.otherPrecautions && selectedClient.flags.otherPrecautions.length > 0 && (
                          <>
                            {selectedClient.flags.otherPrecautions.map((precaution, index) => (
                              <span key={`prec-${index}`} className="inline-block px-2.5 py-1 rounded-full bg-red-50/60 backdrop-blur-sm border border-red-200/50 text-[11px] text-red-700 shadow-sm">
                                {precaution}
                              </span>
                            ))}
                          </>
                        )}
                      </div>
                      
                      {/* Last Interaction */}
                      <p className="text-[11px] text-slate-500 mb-0">
                        Last interaction: {formatLastInteraction(getLastInteractionDate(selectedClient))}
                      </p>
                    </div>

                    {/* Tabs */}
                    <div className="border-b border-slate-200">
                      <div className="flex gap-6">
                        {(["overview", "notes", "formulas", "profile"] as const).map((tab) => (
                          <button
                            key={tab}
                            type="button"
                            onClick={() => setActiveTab(tab)}
                            className={`pb-3 px-1 text-[11px] font-medium uppercase tracking-wide transition-colors ${
                              activeTab === tab
                                ? "text-[#4B543B] border-b-2 border-[#4B543B]"
                                : "text-slate-500 hover:text-slate-700"
                            }`}
                          >
                            {tab === "overview" ? "Overview" : tab === "notes" ? "Notes" : tab === "formulas" ? "Formulas" : "Profile"}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Tab Content */}
                    <div className="pt-4 pb-16">
                      {activeTab === "overview" && (
                        <div className="space-y-6">
                          {/* Last Tonic */}
                          <div>
                            <h3 className="text-[11px] font-semibold text-[#4B543B] uppercase tracking-wide mb-3">
                              Last Tonic
                            </h3>
                            {formulas.length > 0 ? (() => {
                              const lastFormula = formulas[0]; // Most recent (already sorted)
                              const formulaData = lastFormula.formula_data as any;
                              const bottleSize = formulaData?.bottleSize || "";
                              const doseMl = formulaData?.doseMl || "";
                              const frequencyPerDay = formulaData?.frequencyPerDay || "";
                              const doseText = doseMl && frequencyPerDay ? `${doseMl} mL × ${frequencyPerDay} times daily` : "Not set";
                              
                              return (
                                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                                  <p className="text-[13px] font-medium text-slate-900 mb-1">
                                    {lastFormula.title || "Untitled Tonic"}
                                  </p>
                                  {formulaData?.tonicPurpose && (
                                    <p className="text-[12px] text-slate-600 mb-2">
                                      {formulaData.tonicPurpose}
                                    </p>
                                  )}
                                  <div className="text-[11px] text-slate-500 space-y-0.5">
                                    <p>Created: {new Date(lastFormula.created_at).toLocaleDateString()}</p>
                                    <p>Dosage: {doseText}</p>
                                  </div>
                                </div>
                              );
                            })() : (
                              <p className="text-[12px] text-slate-500">No tonics created yet.</p>
                            )}
                          </div>

                          {/* Current Medications */}
                          <div>
                            <h3 className="text-[11px] font-semibold text-[#4B543B] uppercase tracking-wide mb-3">
                              Current Medications
                            </h3>
                            <div className="space-y-3">
                              {editMedications.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {editMedications.map((med, index) => (
                                    <span
                                      key={index}
                                      className="inline-block px-2.5 py-1 rounded-full bg-white/60 backdrop-blur-sm border border-white/40 text-[11px] text-slate-700 shadow-sm"
                                    >
                                      {med}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[12px] text-slate-500">No medications noted.</p>
                              )}
                            </div>
                          </div>

                          {/* Recent Activity */}
                          <div>
                            <h3 className="text-[11px] font-semibold text-[#4B543B] uppercase tracking-wide mb-3">
                              Recent Activity
                            </h3>
                            <div className="space-y-2">
                              {(() => {
                                // Combine notes and formulas, sort by date
                                const activities: Array<{type: "note" | "formula", date: string, text: string}> = [];
                                notes.slice(0, 5).forEach(note => {
                                  activities.push({
                                    type: "note",
                                    date: note.created_at,
                                    text: `Note added: ${note.note.substring(0, 50)}${note.note.length > 50 ? "..." : ""}`
                                  });
                                });
                                formulas.slice(0, 5).forEach(formula => {
                                  activities.push({
                                    type: "formula",
                                    date: formula.created_at,
                                    text: `Tonic ${formula.status === "final" ? "created" : "saved"}: ${formula.title || "Untitled"}`
                                  });
                                });
                                activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                                return activities.slice(0, 5).map((activity, index) => (
                                  <div key={index} className="text-[12px] text-slate-600 py-1.5 border-b border-slate-100 last:border-0">
                                    <span className="text-slate-400 text-[11px]">
                                      {new Date(activity.date).toLocaleDateString()} •{" "}
                                    </span>
                                    {activity.text}
                                  </div>
                                ));
                              })()}
                              {notes.length === 0 && formulas.length === 0 && (
                                <p className="text-[12px] text-slate-500">No recent activity.</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {activeTab === "notes" && (
                        <div className="space-y-4">
                          <div className="space-y-2 max-h-[500px] overflow-y-auto stable-scroll">
                            {notes.length === 0 ? (
                              <p className="text-[12px] text-slate-500">No notes yet.</p>
                            ) : (
                              notes.map((note) => (
                                <div
                                  key={note.id}
                                  className="p-3 rounded-lg bg-slate-50 border border-slate-200"
                                >
                                  <p className="text-[12px] text-slate-700 whitespace-pre-wrap mb-2">
                                    {note.note}
                                  </p>
                                  <p className="text-[10px] text-slate-500">
                                    {new Date(note.created_at).toLocaleString()}
                                  </p>
                                </div>
                              ))
                            )}
                          </div>

                          <div className="space-y-2 pt-4 border-t border-slate-200">
                            <textarea
                              value={newNote}
                              onChange={(e) => setNewNote(e.target.value)}
                              placeholder="Add a note..."
                              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#72B01D66] focus:border-[#72B01D] min-h-[80px]"
                            />
                            <button
                              type="button"
                              onClick={handleAddNote}
                              disabled={!newNote.trim() || addingNote}
                              className="px-3 py-1 text-[12px] font-semibold rounded-lg border border-[#72B01D80] bg-[#72B01D] hover:bg-[#6AA318] text-white tracking-[0.08em] uppercase disabled:opacity-50"
                            >
                              {addingNote ? "Adding..." : "Add Note"}
                            </button>
                          </div>
                        </div>
                      )}

                      {activeTab === "formulas" && (
                        <div className="space-y-4">
                          <div className="space-y-2 max-h-[500px] overflow-y-auto stable-scroll">
                            {formulas.length === 0 ? (
                              <p className="text-[12px] text-slate-500">No formulas yet.</p>
                            ) : (
                              formulas.map((formula) => {
                                const formulaData = formula.formula_data as any;
                                const herbs = formulaData?.workspaceHerbs || [];
                                const bottleSize = formulaData?.bottleSize || "";
                                const doseMl = formulaData?.doseMl || "";
                                const frequencyPerDay = formulaData?.frequencyPerDay || "";
                                const doseText = doseMl && frequencyPerDay ? `${doseMl} mL x ${frequencyPerDay} times daily` : "Not set";
                                const bottleText = bottleSize ? `${bottleSize} mL` : "Not set";
                                
                                return (
                                  <div
                                    key={formula.id}
                                    className="p-3 rounded-lg bg-slate-50 border border-slate-200"
                                  >
                                    <div className="flex items-start justify-between mb-2">
                                      <div className="flex-1">
                                        <p className="text-[12px] font-medium text-slate-900 mb-1">
                                          {formula.title || "Untitled"}
                                        </p>
                                        <p className="text-[10px] text-slate-500 mb-1">
                                          {new Date(formula.created_at).toLocaleDateString()} •{" "}
                                          <span
                                            className={
                                              formula.status === "final"
                                                ? "text-green-700"
                                                : "text-amber-700"
                                            }
                                          >
                                            {formula.status}
                                          </span>
                                        </p>
                                        <div className="text-[10px] text-slate-600 space-y-0.5 mt-2">
                                          <p><span className="font-medium">Bottle size:</span> {bottleText}</p>
                                          <p><span className="font-medium">Dose:</span> {doseText}</p>
                                          <p><span className="font-medium">Herbs:</span> {herbs.length > 0 ? herbs.map((h: any) => h?.herb?.herbName || h?.herbName || "Unknown").filter(Boolean).join(", ") : "None"}</p>
                                          {formulaData?.tonicPurpose && (
                                            <p className="mt-2"><span className="font-medium">Tonic purpose:</span> {formulaData.tonicPurpose}</p>
                                          )}
                                          {formulaData?.patientInstructions && (
                                            <p className="mt-2"><span className="font-medium">Notes:</span> {formulaData.patientInstructions}</p>
                                          )}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2 ml-2">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            router.push(`/app?formula=${formula.id}`);
                                          }}
                                          className="px-3 py-1 text-[10px] font-semibold rounded-full border border-[#72B01D80] bg-[#72B01D] hover:bg-[#6AA318] text-white tracking-[0.08em] uppercase"
                                        >
                                          Load to Workspace
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (formula.formula_data) {
                                              const newName = prompt("Enter a name for the duplicated tonic:", `${formula.title || "Untitled"} (Copy)`);
                                              if (newName) {
                                                router.push(`/app?duplicate=${formula.id}&name=${encodeURIComponent(newName)}`);
                                              }
                                            }
                                          }}
                                          className="px-3 py-1 text-[10px] font-semibold rounded-full border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 tracking-[0.08em] uppercase"
                                        >
                                          Duplicate
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      )}

                      {activeTab === "profile" && (
                        <div className="space-y-6">
                          <div className="mb-4">
                            <h3 className="text-[11px] font-semibold text-[#4B543B] uppercase tracking-wide">
                              Client Profile
                            </h3>
                          </div>

                          {isEditingSnapshot ? (
                            <div className="space-y-4">
                              {/* Name Fields */}
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-[10px] mb-1.5 text-slate-600 font-medium uppercase tracking-wide">
                                    First Name *
                                  </label>
                                  <input
                                    type="text"
                                    value={editFirstName}
                                    onChange={(e) => {
                                      setEditFirstName(e.target.value);
                                      setHasUnsavedChanges(true);
                                      setSaveStatus("unsaved");
                                    }}
                                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-[13px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#72B01D66] focus:border-[#72B01D]"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] mb-1.5 text-slate-600 font-medium uppercase tracking-wide">
                                    Last Name
                                  </label>
                                  <input
                                    type="text"
                                    value={editLastName}
                                    onChange={(e) => {
                                      setEditLastName(e.target.value);
                                      setHasUnsavedChanges(true);
                                      setSaveStatus("unsaved");
                                    }}
                                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-[13px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#72B01D66] focus:border-[#72B01D]"
                                  />
                                </div>
                              </div>

                              {/* Contact Fields */}
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-[10px] mb-1.5 text-slate-600 font-medium uppercase tracking-wide">
                                    Email
                                  </label>
                                  <input
                                    type="email"
                                    value={editEmail}
                                    onChange={(e) => {
                                      setEditEmail(e.target.value);
                                      setHasUnsavedChanges(true);
                                      setSaveStatus("unsaved");
                                    }}
                                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-[13px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#72B01D66] focus:border-[#72B01D]"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] mb-1.5 text-slate-600 font-medium uppercase tracking-wide">
                                    Phone
                                  </label>
                                  <input
                                    type="tel"
                                    value={editPhone}
                                    onChange={(e) => {
                                      setEditPhone(e.target.value);
                                      setHasUnsavedChanges(true);
                                      setSaveStatus("unsaved");
                                    }}
                                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-[13px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#72B01D66] focus:border-[#72B01D]"
                                  />
                                </div>
                              </div>

                              {/* DOB */}
                              <div>
                                <label className="block text-[10px] mb-1.5 text-slate-600 font-medium uppercase tracking-wide">
                                  Date of Birth
                                </label>
                                <input
                                  type="date"
                                  value={editDob}
                                  onChange={(e) => {
                                    setEditDob(e.target.value);
                                    setHasUnsavedChanges(true);
                                    setSaveStatus("unsaved");
                                  }}
                                  className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-[14px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#72B01D66] focus:border-[#72B01D]"
                                />
                              </div>

                              {/* Medications */}
                              <div className="border-t border-slate-200 pt-4">
                                <label className="block text-[10px] mb-2 text-slate-600 font-medium uppercase tracking-wide">
                                  Medications
                                </label>
                                <TagInput
                                  tags={editMedications}
                                  onChange={(newTags) => {
                                    setEditMedications(newTags);
                                    setHasUnsavedChanges(true);
                                    setSaveStatus("unsaved");
                                  }}
                                  placeholder="Type medication and press Enter..."
                                />
                              </div>

                              {/* Existing Conditions */}
                              <div className="border-t border-slate-200 pt-4">
                                <label className="block text-[10px] mb-2 text-slate-600 font-medium uppercase tracking-wide">
                                  Existing Conditions
                                </label>
                                <TagInput
                                  tags={editExistingConditions}
                                  onChange={(newTags) => {
                                    setEditExistingConditions(newTags);
                                    setHasUnsavedChanges(true);
                                    setSaveStatus("unsaved");
                                  }}
                                  placeholder="Type condition and press Enter..."
                                />
                              </div>

                              {/* Precautions - 3x2 Grid */}
                              <div className="border-t border-slate-200 pt-4">
                                <label className="block text-[10px] mb-2 text-slate-600 font-medium uppercase tracking-wide">
                                  Precautions
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                  <label className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={editFlags.pregnancy}
                                      onChange={(e) => {
                                        setEditFlags({ ...editFlags, pregnancy: e.target.checked });
                                        setHasUnsavedChanges(true);
                                        setSaveStatus("unsaved");
                                      }}
                                      className="rounded border-slate-300"
                                    />
                                    <span className="text-[12px] text-slate-700">Pregnant</span>
                                  </label>
                                  <label className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={editFlags.lactation}
                                      onChange={(e) => {
                                        setEditFlags({ ...editFlags, lactation: e.target.checked });
                                        setHasUnsavedChanges(true);
                                        setSaveStatus("unsaved");
                                      }}
                                      className="rounded border-slate-300"
                                    />
                                    <span className="text-[12px] text-slate-700">Lactation</span>
                                  </label>
                                  <label className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={editFlags.anticoagulants}
                                      onChange={(e) => {
                                        setEditFlags({ ...editFlags, anticoagulants: e.target.checked });
                                        setHasUnsavedChanges(true);
                                        setSaveStatus("unsaved");
                                      }}
                                      className="rounded border-slate-300"
                                    />
                                    <span className="text-[12px] text-slate-700">Anticoagulants</span>
                                  </label>
                                  <label className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={editFlags.pediatric}
                                      onChange={(e) => {
                                        setEditFlags({ ...editFlags, pediatric: e.target.checked });
                                        setHasUnsavedChanges(true);
                                        setSaveStatus("unsaved");
                                      }}
                                      className="rounded border-slate-300"
                                    />
                                    <span className="text-[12px] text-slate-700">Pediatric</span>
                                  </label>
                                  <label className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={editFlags.kidneyDisease}
                                      onChange={(e) => {
                                        setEditFlags({ ...editFlags, kidneyDisease: e.target.checked });
                                        setHasUnsavedChanges(true);
                                        setSaveStatus("unsaved");
                                      }}
                                      className="rounded border-slate-300"
                                    />
                                    <span className="text-[12px] text-slate-700">Kidney Disease</span>
                                  </label>
                                  <label className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={editFlags.liverDisease}
                                      onChange={(e) => {
                                        setEditFlags({ ...editFlags, liverDisease: e.target.checked });
                                        setHasUnsavedChanges(true);
                                        setSaveStatus("unsaved");
                                      }}
                                      className="rounded border-slate-300"
                                    />
                                    <span className="text-[12px] text-slate-700">Liver Disease</span>
                                  </label>
                                </div>
                                <div className="mt-3">
                                  <label className="block text-[10px] mb-2 text-slate-600 font-medium uppercase tracking-wide">
                                    Other Precautions
                                  </label>
                                  <TagInput
                                    tags={editOtherPrecautions}
                                    onChange={(newTags) => {
                                      setEditOtherPrecautions(newTags);
                                      setHasUnsavedChanges(true);
                                      setSaveStatus("unsaved");
                                    }}
                                    placeholder="Type precaution and press Enter..."
                                  />
                                </div>
                              </div>

                              {/* Save/Cancel Buttons */}
                              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsEditingSnapshot(false);
                                    // Reset form
                                    if (selectedClient.full_name && !selectedClient.first_name) {
                                      setEditFirstName(selectedClient.full_name);
                                      setEditLastName("");
                                    } else {
                                      setEditFirstName(selectedClient.first_name || "");
                                      setEditLastName(selectedClient.last_name || "");
                                    }
                                    setEditEmail(selectedClient.email || "");
                                    setEditPhone(selectedClient.phone || "");
                                    setEditDob(selectedClient.dob || "");
                                    setEditFlags({
                                      pregnancy: selectedClient.flags?.pregnancy || false,
                                      lactation: selectedClient.flags?.lactation || false,
                                      anticoagulants: selectedClient.flags?.anticoagulants || false,
                                      pediatric: selectedClient.flags?.pediatric || false,
                                      kidneyDisease: selectedClient.flags?.kidneyDisease || false,
                                      liverDisease: selectedClient.flags?.liverDisease || false,
                                    });
                                    const otherPrecautions = selectedClient.flags?.otherPrecautions || [];
                                    setEditOtherPrecautions(Array.isArray(otherPrecautions) ? otherPrecautions : []);
                                    const medications = selectedClient.flags?.medications;
                                    const existingConditions = selectedClient.flags?.existingConditions;
                                    setEditMedications(Array.isArray(medications) ? medications : medications ? [medications] : []);
                                    setEditExistingConditions(Array.isArray(existingConditions) ? existingConditions : existingConditions ? [existingConditions] : []);
                                    setHasUnsavedChanges(false);
                                    setSaveStatus("saved");
                                  }}
                                  className="px-3 py-1.5 text-[12px] font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await handleSaveClient();
                                    setIsEditingSnapshot(false);
                                  }}
                                  disabled={!hasUnsavedChanges || saving}
                                  className="px-3 py-1.5 text-[12px] font-semibold rounded-lg border border-[#72B01D80] bg-[#72B01D] hover:bg-[#6AA318] text-white disabled:opacity-50"
                                >
                                  {saving ? "Saving..." : "Save"}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-6">
                              {/* Read-only view */}
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-[10px] mb-1.5 text-slate-600 font-medium uppercase tracking-wide">
                                    First Name
                                  </label>
                                  <p className="text-[13px] text-slate-900">{editFirstName || "—"}</p>
                                </div>
                                <div>
                                  <label className="block text-[10px] mb-1.5 text-slate-600 font-medium uppercase tracking-wide">
                                    Last Name
                                  </label>
                                  <p className="text-[13px] text-slate-900">{editLastName || "—"}</p>
                                </div>
                                <div>
                                  <label className="block text-[10px] mb-1.5 text-slate-600 font-medium uppercase tracking-wide">
                                    Email
                                  </label>
                                  <p className="text-[13px] text-slate-900">{selectedClient.email || "—"}</p>
                                </div>
                                <div>
                                  <label className="block text-[10px] mb-1.5 text-slate-600 font-medium uppercase tracking-wide">
                                    Phone
                                  </label>
                                  <p className="text-[13px] text-slate-900">{selectedClient.phone || "—"}</p>
                                </div>
                                <div>
                                  <label className="block text-[10px] mb-1.5 text-slate-600 font-medium uppercase tracking-wide">
                                    Date of Birth
                                  </label>
                                  <p className="text-[13px] text-slate-900">
                                    {selectedClient.dob ? new Date(selectedClient.dob).toLocaleDateString() : "—"}
                                  </p>
                                </div>
                              </div>

                              <div className="border-t border-slate-200 pt-4">
                                <label className="block text-[10px] mb-2 text-slate-600 font-medium uppercase tracking-wide">
                                  Medications
                                </label>
                                <div className="flex flex-wrap gap-1.5">
                                  {editMedications.length > 0 ? (
                                    editMedications.map((med, index) => (
                                      <span
                                        key={index}
                                        className="inline-block px-2.5 py-1 rounded-full bg-white/60 backdrop-blur-sm border border-white/40 text-[11px] text-slate-700 shadow-sm"
                                      >
                                        {med}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-[12px] text-slate-500">No medications added</span>
                                  )}
                                </div>
                              </div>

                              <div className="border-t border-slate-200 pt-4">
                                <label className="block text-[10px] mb-2 text-slate-600 font-medium uppercase tracking-wide">
                                  Existing Conditions
                                </label>
                                <div className="flex flex-wrap gap-1.5">
                                  {editExistingConditions.length > 0 ? (
                                    editExistingConditions.map((condition, index) => (
                                      <span
                                        key={index}
                                        className="inline-block px-2.5 py-1 rounded-full bg-white/60 backdrop-blur-sm border border-white/40 text-[11px] text-slate-700 shadow-sm"
                                      >
                                        {condition}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-[12px] text-slate-500">No conditions added</span>
                                  )}
                                </div>
                              </div>

                              <div className="border-t border-slate-200 pt-4">
                                <label className="block text-[10px] mb-2 text-slate-600 font-medium uppercase tracking-wide">
                                  Precautions
                                </label>
                                <div className="space-y-2">
                                  <div className="grid grid-cols-2 gap-3">
                                    {selectedClient.flags?.pregnancy && (
                                      <span className="inline-block px-2.5 py-1 rounded-full bg-pink-50 text-[11px] text-pink-600 border border-pink-200">
                                        Pregnant
                                      </span>
                                    )}
                                    {selectedClient.flags?.lactation && (
                                      <span className="inline-block px-2.5 py-1 rounded-full bg-blue-50 text-[11px] text-blue-600 border border-blue-200">
                                        Lactation
                                      </span>
                                    )}
                                    {selectedClient.flags?.anticoagulants && (
                                      <span className="inline-block px-2.5 py-1 rounded-full bg-orange-50 text-[11px] text-orange-600 border border-orange-200">
                                        Anticoagulants
                                      </span>
                                    )}
                                    {selectedClient.flags?.pediatric && (
                                      <span className="inline-block px-2.5 py-1 rounded-full bg-purple-50 text-[11px] text-purple-600 border border-purple-200">
                                        Pediatric
                                      </span>
                                    )}
                                    {selectedClient.flags?.kidneyDisease && (
                                      <span className="inline-block px-2.5 py-1 rounded-full bg-amber-50 text-[11px] text-amber-600 border border-amber-200">
                                        Kidney Disease
                                      </span>
                                    )}
                                    {selectedClient.flags?.liverDisease && (
                                      <span className="inline-block px-2.5 py-1 rounded-full bg-yellow-50 text-[11px] text-yellow-600 border border-yellow-200">
                                        Liver Disease
                                      </span>
                                    )}
                                  </div>
                                  {editOtherPrecautions.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                      {editOtherPrecautions.map((precaution, index) => (
                                        <span
                                          key={index}
                                          className="inline-block px-2.5 py-1 rounded-full bg-red-50 text-[11px] text-red-600 border border-red-200"
                                        >
                                          {precaution}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  {!selectedClient.flags?.pregnancy && !selectedClient.flags?.lactation && !selectedClient.flags?.anticoagulants && !selectedClient.flags?.pediatric && !selectedClient.flags?.kidneyDisease && !selectedClient.flags?.liverDisease && editOtherPrecautions.length === 0 && (
                                    <span className="text-[12px] text-slate-500">No precautions set</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Create Client Modal */}
        {createModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm overflow-y-auto">
            <div className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 p-6 shadow-2xl my-8 max-h-[90vh] overflow-y-auto stable-scroll">
              <h3 className="text-lg font-semibold mb-4 text-slate-900">Create New Client</h3>

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
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-[13px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#72B01D66] focus:border-[#72B01D]"
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
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-[13px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#72B01D66] focus:border-[#72B01D]"
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
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-[13px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#72B01D66] focus:border-[#72B01D]"
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
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-[13px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#72B01D66] focus:border-[#72B01D]"
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
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-[13px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#72B01D66] focus:border-[#72B01D]"
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
                  <label className="block text-[11px] mb-1 text-slate-700 font-medium">
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
                    <label className="block text-[11px] mb-1 text-slate-700 font-medium">
                      Other Precautions
                    </label>
                    <TagInput
                      tags={newClientOtherPrecautions}
                      onChange={setNewClientOtherPrecautions}
                      placeholder="Type precaution and press Enter..."
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setCreateModalOpen(false);
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
                    setNewClientOtherPrecautions([]);
                    setNewClientMedications([]);
                    setNewClientExistingConditions([]);
                  }}
                  className="px-4 py-2 text-[12px] rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!newClientFirstName.trim()) return;

                    setCreating(true);
                    try {
                      const { data: userRes } = await supabase.auth.getUser();
                      if (!userRes.user) throw new Error("Not authenticated");

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
                        })
                        .select()
                        .single();

                      if (error) throw error;

                      setClients([data, ...clients]);
                      setSelectedClient(data);
                      setCreateModalOpen(false);
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
                      setNewClientOtherPrecautions([]);
                      setNewClientMedications([]);
                      setNewClientExistingConditions([]);
                      setError(null);
                    } catch (e: any) {
                      setError(e?.message || "Failed to create client");
                      alert(e?.message || "Failed to create client");
                    } finally {
                      setCreating(false);
                    }
                  }}
                  disabled={!newClientFirstName.trim() || creating}
                  className="px-4 py-2 text-[12px] bg-[#72B01D] hover:bg-[#6AA318] rounded-lg font-semibold text-white border border-[#72B01D] disabled:opacity-50"
                >
                  {creating ? "Creating..." : "Create Client"}
                </button>
              </div>
            </div>
          </div>
        )}
      </MainContent>
    </>
  );
}
