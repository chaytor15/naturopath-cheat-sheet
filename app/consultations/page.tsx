"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import AppHeader from "@/components/AppHeader";
import Sidebar from "@/components/Sidebar";
import MainContent from "@/components/MainContent";

type Client = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  email: string | null;
};

type ConsultType = "initial" | "follow-up" | "check-in";
type ConsultStatus = "idle" | "recording" | "paused" | "processing" | "complete";
type OutputType = "SOAP" | "DAP" | "Narrative" | "Patient Summary";

type ConsultOutput = {
  type: OutputType;
  content: string;
  version: number;
};

type Consult = {
  id: string;
  client_id: string | null;
  practitioner_id: string;
  consult_type: ConsultType;
  status: ConsultStatus | string;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
};

export default function ConsultationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ---- Deepgram streaming (browser PCM -> local WS proxy -> Deepgram) ----
  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);

  const [finalTranscript, setFinalTranscript] = useState("");
  const [partialTranscript, setPartialTranscript] = useState("");
  const finalTranscriptRef = useRef("");
  
  // Client selection
  const [clients, setClients] = useState<Client[]>([]);
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [showCreateClientForm, setShowCreateClientForm] = useState(false);
  const [newClientFirstName, setNewClientFirstName] = useState("");
  const [newClientLastName, setNewClientLastName] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [creatingClient, setCreatingClient] = useState(false);
  const clientDropdownRef = useRef<HTMLDivElement>(null);

  // Consult type
  const [consultType, setConsultType] = useState<ConsultType | null>(null);
  const [clientLocked, setClientLocked] = useState(false);

  // Consult state
  const [consultStatus, setConsultStatus] = useState<ConsultStatus>("idle");
  const [currentConsultId, setCurrentConsultId] = useState<string | null>(null);
  const [recordingStartTime, setRecordingStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [pausedTime, setPausedTime] = useState<number | null>(null);
  const [totalElapsedBeforePause, setTotalElapsedBeforePause] = useState(0);

  // Transcript
  // (Kept for persistence UX; actual live transcript is finalTranscript + partialTranscript)
  const [transcriptVersion, setTranscriptVersion] = useState(1);

  // Outputs
  const [activeOutputTab, setActiveOutputTab] = useState<OutputType>("SOAP");
  const [outputs, setOutputs] = useState<Record<OutputType, ConsultOutput>>({
    SOAP: { type: "SOAP", content: "", version: 1 },
    DAP: { type: "DAP", content: "", version: 1 },
    Narrative: { type: "Narrative", content: "", version: 1 },
    "Patient Summary": { type: "Patient Summary", content: "", version: 1 },
  });

  // Loading states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [consultList, setConsultList] = useState<Consult[]>([]);
  const [loadingConsultList, setLoadingConsultList] = useState(false);
  const [hasUnsavedEdits, setHasUnsavedEdits] = useState(false);
  const [savingEdits, setSavingEdits] = useState(false);
  const outputEditorRef = useRef<HTMLDivElement>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const formatSupabaseError = (err: any): string => {
    if (!err) return "Unknown error";
    if (typeof err === "string") return err;
    if (err?.message) return String(err.message);
    try {
      return JSON.stringify(err);
    } catch {
      return "Unknown error";
    }
  };

  // Check for client or consult from query params
  useEffect(() => {
    const clientId = searchParams.get("client");
    const consultId = searchParams.get("consult");
    
    if (consultId && !loadingConsultList) {
      // Load the specific consult
      const loadConsult = async () => {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) return;
        
        const { data: consultData } = await supabase
          .from("consults")
          .select("*")
          .eq("id", consultId)
          .eq("practitioner_id", sessionData.session.user.id)
          .single();
        
        if (consultData) {
          const consultClient = clients.find(c => c.id === consultData.client_id);
          if (consultClient) {
            setSelectedClient(consultClient);
            setClientLocked(true);
            setConsultType(consultData.consult_type);
            setCurrentConsultId(consultData.id);
            setConsultStatus(consultData.status as ConsultStatus);
            
            // Load transcript
            const { data: transcriptData } = await supabase
              .from("consult_transcripts")
              .select("transcript_text")
              .eq("consult_id", consultId)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            
            if (transcriptData?.transcript_text) {
              setFinalTranscript(transcriptData.transcript_text);
              finalTranscriptRef.current = transcriptData.transcript_text;
            }
            
            // Load outputs
            const { data: outputsData } = await supabase
              .from("consult_outputs")
              .select("*")
              .eq("consult_id", consultId)
              .order("version", { ascending: false });
            
            if (outputsData) {
              const nextOutputs: Record<OutputType, ConsultOutput> = {
                SOAP: { type: "SOAP", content: "", version: 1 },
                DAP: { type: "DAP", content: "", version: 1 },
                Narrative: { type: "Narrative", content: "", version: 1 },
                "Patient Summary": { type: "Patient Summary", content: "", version: 1 },
              };
              outputsData.forEach((r) => {
                if (r.type in nextOutputs) {
                  const existing = nextOutputs[r.type as OutputType];
                  if (r.version > existing.version) {
                    nextOutputs[r.type as OutputType] = { type: r.type as OutputType, content: r.content, version: r.version };
                  }
                }
              });
              setOutputs(nextOutputs);
            }
          }
        }
      };
      loadConsult();
    } else if (clientId && clients.length > 0) {
      const client = clients.find((c) => c.id === clientId);
      if (client) {
        setSelectedClient(client);
        setClientLocked(true);
      }
    }
  }, [searchParams, clients, loadingConsultList]);

  // Load clients
  useEffect(() => {
    const loadClients = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.replace("/login");
        return;
      }

      const { data: clientsData, error } = await supabase
        .from("clients")
        .select("id, first_name, last_name, full_name, email")
        .eq("user_id", sessionData.session.user.id)
        .order("first_name", { ascending: true });

      if (!error && clientsData) {
        setClients(clientsData);
      }
      setLoading(false);
    };

    loadClients();
  }, [router]);

  // Load consult list for selected client (and practitioner)
  useEffect(() => {
    const loadConsults = async () => {
      if (!selectedClient || !clientLocked) {
        setConsultList([]);
        return;
      }

      setLoadingConsultList(true);
      try {
        const { data: userRes } = await supabase.auth.getUser();
        if (!userRes.user) return;

        const { data, error } = await supabase
          .from("consults")
          .select("*")
          .eq("client_id", selectedClient.id)
          .eq("practitioner_id", userRes.user.id)
          .order("created_at", { ascending: false })
          .limit(50);

        if (!error && data) {
          setConsultList(data as Consult[]);
        }
      } catch {
        // ignore for beta
      } finally {
        setLoadingConsultList(false);
      }
    };

    loadConsults();
  }, [clientLocked, selectedClient]);

  const loadConsultDetails = async (consultId: string) => {
    try {
      // Latest transcript
      const { data: tr } = await supabase
        .from("consult_transcripts")
        .select("transcript_text, created_at")
        .eq("consult_id", consultId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const transcriptText = tr?.transcript_text ?? "";
      setFinalTranscript(transcriptText);
      finalTranscriptRef.current = transcriptText;
      setPartialTranscript("");

      // Latest outputs per tab
      const types: OutputType[] = ["SOAP", "DAP", "Narrative", "Patient Summary"];
      const results = await Promise.all(
        types.map(async (t) => {
          const { data } = await supabase
            .from("consult_outputs")
            .select("content, version, created_at")
            .eq("consult_id", consultId)
            .eq("type", t)
            .order("version", { ascending: false })
            .limit(1)
            .maybeSingle();
          return { type: t, content: data?.content ?? "", version: data?.version ?? 1 };
        })
      );

      const nextOutputs: Record<OutputType, ConsultOutput> = {
        SOAP: { type: "SOAP", content: "", version: 1 },
        DAP: { type: "DAP", content: "", version: 1 },
        Narrative: { type: "Narrative", content: "", version: 1 },
        "Patient Summary": { type: "Patient Summary", content: "", version: 1 },
      };
      results.forEach((r) => {
        nextOutputs[r.type] = { type: r.type, content: r.content, version: r.version };
      });
      setOutputs(nextOutputs);
      setHasUnsavedEdits(false);
    } catch {
      // ignore for beta
    }
  };

  // Timer for recording (pauses when paused)
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if ((consultStatus === "recording" || consultStatus === "paused") && recordingStartTime) {
      interval = setInterval(() => {
        if (consultStatus === "recording") {
          const elapsed = Math.floor((Date.now() - recordingStartTime.getTime()) / 1000);
          setElapsedTime(elapsed);
        }
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [consultStatus, recordingStartTime]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(event.target as Node)) {
        setShowClientDropdown(false);
      }
    };
    if (showClientDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showClientDropdown]);

  const getClientDisplayName = (client: Client): string => {
    if (client.first_name || client.last_name) {
      return `${client.first_name || ""} ${client.last_name || ""}`.trim();
    }
    return client.full_name || "Unnamed Client";
  };

  const filteredClients = clients.filter((client) => {
    const name = getClientDisplayName(client).toLowerCase();
    const email = (client.email || "").toLowerCase();
    const query = clientSearchQuery.toLowerCase();
    return name.includes(query) || email.includes(query);
  });

  const handleCreateClient = async () => {
    if (!newClientFirstName.trim()) return;

    setCreatingClient(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("clients")
        .insert({
          user_id: sessionData.session.user.id,
          first_name: newClientFirstName.trim(),
          last_name: newClientLastName.trim(),
          email: newClientEmail.trim() || null,
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setClients([...clients, data]);
        setSelectedClient(data);
        setClientLocked(true);
        setShowCreateClientForm(false);
        setNewClientFirstName("");
        setNewClientLastName("");
        setNewClientEmail("");
        setClientSearchQuery("");
        setShowClientDropdown(false);
      }
    } catch (error: any) {
      console.error("Error creating client:", error);
      alert(error.message || "Failed to create client");
    } finally {
      setCreatingClient(false);
    }
  };

  const proxyWsUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    // Local proxy runs on 3001 by default
    return `${protocol}://${window.location.hostname}:3001?model=nova-2&language=en`;
  }, []);

  const downsampleBuffer = (buffer: Float32Array, inputSampleRate: number, outputSampleRate: number) => {
    if (outputSampleRate === inputSampleRate) return buffer;
    const sampleRateRatio = inputSampleRate / outputSampleRate;
    const newLength = Math.round(buffer.length / sampleRateRatio);
    const result = new Float32Array(newLength);
    let offsetResult = 0;
    let offsetBuffer = 0;
    while (offsetResult < result.length) {
      const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
      let accum = 0;
      let count = 0;
      for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
        accum += buffer[i];
        count++;
      }
      result[offsetResult] = count > 0 ? accum / count : 0;
      offsetResult++;
      offsetBuffer = nextOffsetBuffer;
    }
    return result;
  };

  const floatTo16BitPCM = (input: Float32Array) => {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return output;
  };

  const startStreaming = async () => {
    // Reset transcript buffers for a new run
    setFinalTranscript("");
    setPartialTranscript("");
    finalTranscriptRef.current = "";

    // WS
    const ws = new WebSocket(proxyWsUrl);
    wsRef.current = ws;

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(String(evt.data)) as { type: string; text?: string; message?: string };
        if (msg.type === "partial" && msg.text) {
          setPartialTranscript(msg.text);
        }
        if (msg.type === "final" && msg.text) {
          setPartialTranscript("");
          setFinalTranscript((prev) => {
            const next = (prev ? prev + "\n" : "") + msg.text;
            finalTranscriptRef.current = next;
            return next;
          });
        }
      } catch {}
    };

    // Mic + PCM capture
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaStreamRef.current = stream;

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioContextRef.current = audioContext;

    const source = audioContext.createMediaStreamSource(stream);
    sourceNodeRef.current = source;

    // Create analyser for audio level visualization
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    analyserRef.current = analyser;

    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor;

    const gain = audioContext.createGain();
    gain.gain.value = 0; // mute to avoid feedback
    gainRef.current = gain;

    processor.onaudioprocess = (e) => {
      if (ws.readyState !== WebSocket.OPEN) return;
      if (consultStatus !== "recording") return;

      const input = e.inputBuffer.getChannelData(0);
      const downsampled = downsampleBuffer(input, audioContext.sampleRate, 16000);
      const pcm16 = floatTo16BitPCM(downsampled);
      ws.send(pcm16.buffer);

      // Calculate audio level for visualization (always calculate when processor is running)
      let sum = 0;
      for (let i = 0; i < input.length; i++) {
        sum += Math.abs(input[i]);
      }
      const average = sum / input.length;
      // Convert to dB-like scale (0-100) with better sensitivity for visualization
      const level = Math.min(100, Math.round(Math.sqrt(average) * 300));
      setAudioLevel(level);
    };

    source.connect(analyser);
    analyser.connect(processor);
    processor.connect(gain);
    gain.connect(audioContext.destination);
  };

  const stopStreaming = async () => {
    try {
      processorRef.current?.disconnect();
    } catch {}
    try {
      analyserRef.current?.disconnect();
    } catch {}
    try {
      sourceNodeRef.current?.disconnect();
    } catch {}
    try {
      gainRef.current?.disconnect();
    } catch {}

    if (audioContextRef.current) {
      try {
        await audioContextRef.current.close();
      } catch {}
    }

    if (mediaStreamRef.current) {
      for (const t of mediaStreamRef.current.getTracks()) {
        try {
          t.stop();
        } catch {}
      }
    }

    audioContextRef.current = null;
    mediaStreamRef.current = null;
    sourceNodeRef.current = null;
    processorRef.current = null;
    analyserRef.current = null;
    gainRef.current = null;
    setAudioLevel(0);

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }
  };

  // Create a consult draft once client + type are selected (beta: minimal persistence)
  useEffect(() => {
    const run = async () => {
      if (!selectedClient || !consultType || !clientLocked) return;
      if (consultStatus !== "idle") return;
      if (currentConsultId) return;
      if (drafting) return;

      setDrafting(true);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) return;

        const { data, error } = await supabase
          .from("consults")
          .insert({
            client_id: selectedClient.id,
            practitioner_id: sessionData.session.user.id,
            consult_type: consultType,
            status: "idle",
          })
          .select()
          .single();

        if (!error && data?.id) {
          setCurrentConsultId(data.id);
        }
      } catch (e) {
        // ignore draft errors for beta
      } finally {
        setDrafting(false);
      }
    };
    run();
  }, [clientLocked, consultStatus, consultType, currentConsultId, drafting, selectedClient]);

  const handleStartConsult = async () => {
    if (!selectedClient || !consultType) return;

    setConsultStatus("recording");
    setRecordingStartTime(new Date());
    setElapsedTime(0);
    setTranscriptVersion((v) => v + 1);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error("Not authenticated");

      // Ensure consult exists
      let consultId = currentConsultId;
      if (!consultId) {
        const { data, error } = await supabase
          .from("consults")
          .insert({
            client_id: selectedClient.id,
            practitioner_id: sessionData.session.user.id,
            consult_type: consultType,
            status: "idle",
          })
          .select()
          .single();
        if (error) throw error;
        consultId = data?.id ?? null;
        setCurrentConsultId(consultId);
      }

      if (!consultId) throw new Error("Failed to create consult");

      await supabase
        .from("consults")
        .update({
          status: "recording",
          started_at: new Date().toISOString(),
        })
        .eq("id", consultId);

      await startStreaming();
    } catch (error: any) {
      console.error("Error starting consult:", error);
      const msg = formatSupabaseError(error);
      if (
        msg.includes("Could not find the 'consults'") ||
        msg.includes("public.consults") ||
        msg.toLowerCase().includes("schema cache")
      ) {
        setFatalError(
          "Consult tables are missing in Supabase. Apply the migration `migrations/create_consult_tables.sql` (or ask me to apply it), then refresh."
        );
      } else {
        alert(msg || "Failed to start consult");
      }
      setConsultStatus("idle");
      await stopStreaming();
    }
  };

  const handlePauseConsult = async () => {
    if (!currentConsultId || consultStatus !== "recording") return;
    await stopStreaming();
    // Save current elapsed time before pausing
    if (recordingStartTime) {
      const currentElapsed = Math.floor((Date.now() - recordingStartTime.getTime()) / 1000);
      setTotalElapsedBeforePause(currentElapsed);
    }
    setPausedTime(Date.now());
    setConsultStatus("paused");
  };

  const handleResumeConsult = async () => {
    if (!currentConsultId || consultStatus !== "paused") return;
    // Adjust start time to account for already elapsed time (so timer continues)
    const adjustedStartTime = new Date(Date.now() - (totalElapsedBeforePause * 1000));
    setRecordingStartTime(adjustedStartTime);
    setPausedTime(null);
    setConsultStatus("recording");
    await startStreaming();
  };

  const handleStopConsult = async () => {
    if (!currentConsultId) return;

    setConsultStatus("processing");
    await stopStreaming();

    // Give Deepgram a moment to flush final results (beta)
    setTimeout(async () => {
      const finalText = finalTranscriptRef.current.trim();

      try {
        await supabase
          .from("consults")
          .update({
            status: "complete",
            ended_at: new Date().toISOString(),
          })
          .eq("id", currentConsultId);

        if (finalText) {
          await supabase.from("consult_transcripts").insert({
            consult_id: currentConsultId,
            transcript_text: finalText,
          });
        }

        // Set status to complete before generating notes
        setConsultStatus("complete");
        setPartialTranscript("");

        // Auto-generate notes after stopping (force=true to bypass status check)
        await handleGenerateNotes(true);
        
        // Refresh consult list to show the new consult
        if (selectedClient) {
          const { data: userRes } = await supabase.auth.getUser();
          if (userRes.user) {
            const { data } = await supabase
              .from("consults")
              .select("*")
              .eq("client_id", selectedClient.id)
              .eq("practitioner_id", userRes.user.id)
              .order("created_at", { ascending: false })
              .limit(50);
            
            if (data) {
              setConsultList(data as Consult[]);
              // Ensure the current consult stays selected and loaded
              if (currentConsultId) {
                await loadConsultDetails(currentConsultId);
              }
            }
          }
        }
      } catch (error: any) {
        console.error("Error stopping consult:", error);
        setConsultStatus("complete");
      }
    }, 700);
  };

  const handleGenerateNotes = async (force = false) => {
    if (!currentConsultId) return;
    if (!force && consultStatus !== "complete") return;

    setSaving(true);

    const { data: userRes } = await supabase.auth.getUser();
    const userId = userRes.user?.id || null;

    // Mock outputs
    const mockOutputs: Record<OutputType, string> = {
      SOAP: `Subjective:
Patient reports fatigue and digestive issues over the past 3 weeks. Symptoms include bloating after meals and irregular bowel movements. Patient notes increased work stress recently.

Objective:
- General appearance: Appears tired
- Vital signs: Within normal limits
- Abdominal exam: Mild distension noted

Assessment:
- Stress-related digestive dysfunction
- Possible food sensitivities
- Adrenal fatigue secondary to chronic stress

Plan:
1. Implement stress management techniques
2. Dietary modifications to support digestion
3. Consider digestive enzymes
4. Follow-up in 2 weeks`,
      DAP: `Data:
- 3 weeks of digestive symptoms
- Bloating after meals
- Irregular bowel movements
- Increased work stress
- Fatigue

Assessment:
Stress-related digestive dysfunction with possible food sensitivities. Adrenal function may be compromised.

Plan:
1. Stress reduction strategies
2. Digestive support protocol
3. Dietary assessment and modifications
4. Re-evaluation in 2 weeks`,
      Narrative: `The patient presented with a 3-week history of fatigue and digestive complaints. The symptoms began around the time of increased work stress. The patient reports bloating after meals and irregular bowel movements. Physical examination revealed mild abdominal distension. The assessment suggests stress-related digestive dysfunction, and a comprehensive plan was developed focusing on stress management, dietary modifications, and digestive support.`,
      "Patient Summary": `Patient Name: ${getClientDisplayName(selectedClient!)}
Consult Type: ${consultType === "initial" ? "Initial Consult" : consultType === "follow-up" ? "Follow-up Consult" : "Check-in"}
Date: ${new Date().toLocaleDateString()}

Chief Complaint: Fatigue and digestive issues (3 weeks duration)

History of Present Illness:
Patient reports onset of symptoms approximately 3 weeks ago, coinciding with increased work stress. Symptoms include bloating after meals and irregular bowel movements.

Assessment:
Stress-related digestive dysfunction with possible food sensitivities.

Treatment Plan:
1. Stress management techniques
2. Dietary modifications
3. Digestive support protocol
4. Follow-up in 2 weeks`,
    };

    // Update outputs
    const updatedOutputs: Record<OutputType, ConsultOutput> = {
      SOAP: { type: "SOAP", content: mockOutputs.SOAP, version: 1 },
      DAP: { type: "DAP", content: mockOutputs.DAP, version: 1 },
      Narrative: { type: "Narrative", content: mockOutputs.Narrative, version: 1 },
      "Patient Summary": { type: "Patient Summary", content: mockOutputs["Patient Summary"], version: 1 },
    };

    setOutputs(updatedOutputs);

    // Save to database
    try {
      for (const output of Object.values(updatedOutputs)) {
        await supabase.from("consult_outputs").insert({
          consult_id: currentConsultId,
          type: output.type,
          content: output.content,
          version: output.version,
        });
      }

      // Also save Patient Summary into client profile (beta: store as a client note)
      if (selectedClient?.id && userId && updatedOutputs["Patient Summary"]?.content) {
        const header = `Patient Summary — ${new Date().toLocaleString()}`;
        await supabase.from("client_notes").insert({
          client_id: selectedClient.id,
          user_id: userId,
          note: `${header}\n\n${updatedOutputs["Patient Summary"].content}`,
        });
      }
    } catch (error: any) {
      console.error("Error saving outputs:", error);
    }

    setSaving(false);
  };

  const handleOutputChange = (type: OutputType, content: string) => {
    setHasUnsavedEdits(true);
    setOutputs((prev) => ({
      ...prev,
      [type]: {
        ...prev[type],
        content,
        version: prev[type].version + 1,
      },
    }));
  };

  // Sync contentEditable with state when tab or content changes
  useEffect(() => {
    if (outputEditorRef.current) {
      const currentContent = outputs[activeOutputTab].content || "";
      if (outputEditorRef.current.innerHTML !== currentContent) {
        outputEditorRef.current.innerHTML = currentContent;
      }
    }
  }, [activeOutputTab, outputs]);

  const saveEdits = async () => {
    if (!currentConsultId) return;
    if (!selectedClient?.id) return;
    setSavingEdits(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user?.id || null;

      const types: OutputType[] = ["SOAP", "DAP", "Narrative", "Patient Summary"];
      for (const t of types) {
        const content = outputs[t]?.content || "";
        if (!content.trim()) continue;

        const { data: latest } = await supabase
          .from("consult_outputs")
          .select("version")
          .eq("consult_id", currentConsultId)
          .eq("type", t)
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle();

        const nextVersion = (latest?.version ?? 0) + 1;

        await supabase.from("consult_outputs").insert({
          consult_id: currentConsultId,
          type: t,
          content,
          version: nextVersion,
        });

        // Keep Patient Summary mirrored into client profile (beta: append as a note)
        if (t === "Patient Summary" && userId) {
          const header = `Patient Summary (edited) — ${new Date().toLocaleString()}`;
          await supabase.from("client_notes").insert({
            client_id: selectedClient.id,
            user_id: userId,
            note: `${header}\n\n${content}`,
          });
        }
      }

      setHasUnsavedEdits(false);
    } catch (e) {
      console.error("Failed to save edits:", e);
      alert("Failed to save changes. Please try again.");
    } finally {
      setSavingEdits(false);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <>
        <AppHeader />
        <Sidebar />
        <MainContent>
          <div className="flex items-center justify-center h-screen">
            <div className="w-6 h-6 border-2 border-[#4B543B] border-t-transparent rounded-full animate-spin"></div>
          </div>
        </MainContent>
      </>
    );
  }

  return (
    <>
      <AppHeader />
      <Sidebar />
      <MainContent>
        <div className="h-screen flex flex-col">
          {fatalError && (
            <div className="flex-shrink-0 p-4 bg-red-50 border-b border-red-200">
              <p className="text-[12px] text-red-700">{fatalError}</p>
            </div>
          )}
          {/* Header */}
          <div className="flex-shrink-0 p-6 border-b border-slate-200 bg-white">
            <div className="flex items-center gap-4">
              {/* Client Selection */}
              <div className="flex-1 relative" ref={clientDropdownRef}>
                <label className="block text-[11px] font-semibold text-[#4B543B] uppercase tracking-wide mb-1">
                  Client
                </label>
                {selectedClient && clientLocked ? (
                  <div className="relative">
                    <select
                      value={selectedClient.id}
                      onChange={(e) => {
                        const newClient = clients.find(c => c.id === e.target.value);
                        if (newClient) {
                          stopStreaming();
                          setSelectedClient(newClient);
                          setConsultType(null);
                          setConsultStatus("idle");
                          setCurrentConsultId(null);
                          setFinalTranscript("");
                          setPartialTranscript("");
                          finalTranscriptRef.current = "";
                          setOutputs({
                            SOAP: { type: "SOAP", content: "", version: 1 },
                            DAP: { type: "DAP", content: "", version: 1 },
                            Narrative: { type: "Narrative", content: "", version: 1 },
                            "Patient Summary": { type: "Patient Summary", content: "", version: 1 },
                          });
                        }
                      }}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-[12px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#72B01D66] focus:border-[#72B01D]"
                    >
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {getClientDisplayName(client)}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      value={clientSearchQuery}
                      onChange={(e) => {
                        setClientSearchQuery(e.target.value);
                        setShowClientDropdown(true);
                      }}
                      onFocus={() => setShowClientDropdown(true)}
                      placeholder="Search or create client..."
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-[12px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#72B01D66] focus:border-[#72B01D]"
                    />
                    {showClientDropdown && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {filteredClients.length > 0 ? (
                          filteredClients.map((client) => (
                            <button
                              key={client.id}
                              onClick={() => {
                                setSelectedClient(client);
                                setClientLocked(true);
                                setShowClientDropdown(false);
                                setClientSearchQuery("");
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-slate-50 text-[12px] text-slate-900"
                            >
                              {getClientDisplayName(client)}
                              {client.email && (
                                <span className="text-slate-500 ml-2">({client.email})</span>
                              )}
                            </button>
                          ))
                        ) : (
                          <div className="px-3 py-2">
                            <button
                              onClick={() => {
                                setShowCreateClientForm(true);
                                setShowClientDropdown(false);
                              }}
                              className="text-[12px] text-[#72B01D] hover:text-[#6AA318] font-medium"
                            >
                              + Create new client
                            </button>
                          </div>
                        )}
                        {filteredClients.length > 0 && (
                          <div className="border-t border-slate-200 px-3 py-2">
                            <button
                              onClick={() => {
                                setShowCreateClientForm(true);
                                setShowClientDropdown(false);
                              }}
                              className="text-[12px] text-[#72B01D] hover:text-[#6AA318] font-medium"
                            >
                              + Create new client
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Consult Type */}
              <div className="w-48">
                <label className="block text-[11px] font-semibold text-[#4B543B] uppercase tracking-wide mb-1">
                  Consult Type
                </label>
                <select
                  value={consultType || ""}
                  onChange={(e) => setConsultType(e.target.value as ConsultType)}
                  disabled={clientLocked && consultStatus !== "idle"}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-[12px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#72B01D66] focus:border-[#72B01D] disabled:bg-slate-50 disabled:text-slate-500"
                >
                  <option value="">Select type...</option>
                  <option value="initial">Initial Consult</option>
                  <option value="follow-up">Follow-up Consult</option>
                  <option value="check-in">Check-in</option>
                </select>
              </div>
            </div>

            {/* Create Client Form */}
            {showCreateClientForm && (
              <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <h3 className="text-[12px] font-semibold text-slate-900 mb-3">Create New Client</h3>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="First Name *"
                    value={newClientFirstName}
                    onChange={(e) => setNewClientFirstName(e.target.value)}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-[12px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#72B01D66] focus:border-[#72B01D]"
                  />
                  <input
                    type="text"
                    placeholder="Last Name"
                    value={newClientLastName}
                    onChange={(e) => setNewClientLastName(e.target.value)}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-[12px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#72B01D66] focus:border-[#72B01D]"
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    value={newClientEmail}
                    onChange={(e) => setNewClientEmail(e.target.value)}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-[12px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#72B01D66] focus:border-[#72B01D]"
                  />
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={handleCreateClient}
                    disabled={!newClientFirstName.trim() || creatingClient}
                    className="px-3 py-1.5 text-[12px] font-medium rounded-lg bg-[#72B01D] hover:bg-[#6AA318] text-white disabled:opacity-50"
                  >
                    {creatingClient ? "Creating..." : "Create"}
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateClientForm(false);
                      setNewClientFirstName("");
                      setNewClientLastName("");
                      setNewClientEmail("");
                    }}
                    className="px-3 py-1.5 text-[12px] font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Main Content - Consult List + 2 Panels */}
          <div className="flex-1 flex min-h-0">
            {/* Consult List */}
            <aside className="hidden lg:flex w-[260px] border-r border-slate-200 bg-white flex-col">
              <div className="flex-shrink-0 p-4 border-b border-slate-200">
                <h2 className="text-[11px] font-semibold text-[#4B543B] uppercase tracking-wide">Consults</h2>
              </div>
              <div className="flex-1 overflow-y-auto stable-scroll p-2">
                {loadingConsultList ? (
                  <div className="p-3 text-[12px] text-slate-500">Loading…</div>
                ) : consultList.length === 0 ? (
                  <div className="p-3 text-[12px] text-slate-500">No consults yet.</div>
                ) : (
                  <div className="space-y-1">
                    {consultList.map((c) => {
                      const isActive = c.id === currentConsultId;
                      const typeLabel =
                        c.consult_type === "initial"
                          ? "Initial"
                          : c.consult_type === "follow-up"
                          ? "Follow-up"
                          : "Check-in";
                      const when = new Date(c.started_at || c.created_at).toLocaleDateString();
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={async () => {
                            setCurrentConsultId(c.id);
                            setConsultType(c.consult_type);
                            setConsultStatus((c.status as any) || "idle");
                            await loadConsultDetails(c.id);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                            isActive
                              ? "bg-[#EDEFE6] border-[#72B01D80]"
                              : "bg-white border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[12px] font-medium text-slate-900">{typeLabel}</span>
                            {c.started_at && c.ended_at ? (
                              <span className="text-[10px] text-slate-500">
                                {(() => {
                                  const start = new Date(c.started_at);
                                  const end = new Date(c.ended_at);
                                  const duration = Math.floor((end.getTime() - start.getTime()) / 1000);
                                  const mins = Math.floor(duration / 60);
                                  const secs = duration % 60;
                                  return `${mins}:${secs.toString().padStart(2, "0")}`;
                                })()}
                              </span>
                            ) : (
                              <span className="text-[10px] uppercase tracking-wide text-slate-500">
                                {String(c.status)}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-600">{when}</div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </aside>

            {/* Transcript Panel */}
            <div className="flex-1 border-r border-slate-200 flex flex-col bg-white">
              <div className="flex-shrink-0 p-4 border-b border-slate-200">
                <h2 className="text-[11px] font-semibold text-[#4B543B] uppercase tracking-wide">Transcript</h2>
              </div>
              <div className="flex-1 p-4 overflow-y-auto stable-scroll">
                {finalTranscript || partialTranscript || consultStatus === "recording" || consultStatus === "processing" ? (
                  <div className="text-[12px] text-slate-700 whitespace-pre-wrap font-mono leading-relaxed">
                    {finalTranscript}
                    {partialTranscript ? (
                      <span className="text-slate-500">{(finalTranscript ? "\n" : "") + partialTranscript}</span>
                    ) : consultStatus === "recording" && !finalTranscript ? (
                      <span className="text-slate-500 italic">Listening…</span>
                    ) : consultStatus === "processing" && !finalTranscript ? (
                      <span className="text-slate-500 italic">Finalizing transcript…</span>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-[12px] text-slate-500 italic">Transcript will appear here after recording</p>
                )}
              </div>
            </div>

            {/* Output Tabs */}
            <div className="flex-1 flex flex-col bg-white">
              <div className="flex-shrink-0 border-b border-slate-200">
                <div className="flex">
                  {(["SOAP", "DAP", "Narrative", "Patient Summary"] as OutputType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => setActiveOutputTab(type)}
                      className={`px-4 py-3 text-[11px] font-medium uppercase tracking-wide transition-colors border-b-2 ${
                        activeOutputTab === type
                          ? "text-[#4B543B] border-[#4B543B]"
                          : "text-slate-500 border-transparent hover:text-slate-700"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 flex flex-col">
                {/* Rich Text Toolbar */}
                <div className="flex-shrink-0 flex items-center gap-2 p-2 border-b border-slate-200 bg-slate-50">
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      document.execCommand("bold", false);
                    }}
                    className="px-2 py-1 text-[11px] font-semibold rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700"
                    title="Bold"
                  >
                    B
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      document.execCommand("backColor", false, "#fef08a");
                    }}
                    className="px-2 py-1 text-[11px] rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700"
                    title="Highlight"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      document.execCommand("insertUnorderedList", false);
                    }}
                    className="px-2 py-1 text-[11px] rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700"
                    title="Bullet List"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
                <div
                  ref={outputEditorRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={(e) => {
                    const content = e.currentTarget.innerHTML;
                    handleOutputChange(activeOutputTab, content);
                  }}
                  onBlur={(e) => {
                    if (!e.currentTarget.innerHTML.trim()) {
                      e.currentTarget.innerHTML = "";
                    }
                  }}
                  className="flex-1 p-4 overflow-y-auto stable-scroll px-3 py-2 rounded-lg border border-slate-300 bg-white text-[12px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#72B01D66] focus:border-[#72B01D] min-h-0 empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400"
                  style={{ minHeight: 0 }}
                  data-placeholder={`${activeOutputTab} notes will appear here after generating...`}
                />
              </div>
            </div>
          </div>

          {/* Bottom Action Bar */}
          <div className="flex-shrink-0 sticky bottom-0 bg-white border-t border-slate-200 p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              {consultStatus === "recording" && (
                <>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                    <span className="text-[12px] font-medium text-slate-900">Recording</span>
                  </div>
                  <div className="text-[12px] font-mono text-slate-600">{formatTime(elapsedTime)}</div>
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                    <div className="flex items-center gap-0.5 h-4 w-20 bg-slate-200 rounded-full overflow-hidden">
                      {Array.from({ length: 10 }).map((_, i) => {
                        const threshold = (i + 1) * 10;
                        const isActive = audioLevel >= threshold;
                        return (
                          <div
                            key={i}
                            className={`flex-1 h-full transition-colors ${
                              isActive ? "bg-[#72B01D]" : "bg-slate-300"
                            }`}
                          />
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
              {consultStatus === "paused" && (
                <>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                    <span className="text-[12px] font-medium text-slate-900">Paused</span>
                  </div>
                  <div className="text-[12px] font-mono text-slate-600">{formatTime(elapsedTime)}</div>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              {consultStatus === "idle" && (
                <button
                  onClick={handleStartConsult}
                  disabled={!selectedClient || !consultType}
                  className="px-4 py-2 text-[12px] font-semibold rounded-lg bg-[#72B01D] hover:bg-[#6AA318] text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Start Consult
                </button>
              )}
              {consultStatus === "recording" && (
                <>
                  <button
                    onClick={handlePauseConsult}
                    className="px-4 py-2 text-[12px] font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700"
                  >
                    Pause Consult
                  </button>
                  <button
                    onClick={handleStopConsult}
                    className="px-4 py-2 text-[12px] font-semibold rounded-lg border border-[#72B01D80] bg-[#72B01D] hover:bg-[#6AA318] text-white"
                  >
                    Finish Consult
                  </button>
                </>
              )}
              {consultStatus === "paused" && (
                <>
                  <button
                    onClick={handleResumeConsult}
                    className="px-4 py-2 text-[12px] font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700"
                  >
                    Resume Consult
                  </button>
                  <button
                    onClick={handleStopConsult}
                    className="px-4 py-2 text-[12px] font-semibold rounded-lg border border-[#72B01D80] bg-[#72B01D] hover:bg-[#6AA318] text-white"
                  >
                    Finish Consult
                  </button>
                </>
              )}
              {consultStatus === "processing" && (
                <div className="flex items-center gap-2 px-4 py-2">
                  <div className="w-4 h-4 border-2 border-[#72B01D] border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-[12px] text-slate-600">Processing...</span>
                </div>
              )}
              {consultStatus === "complete" && hasUnsavedEdits && (
                <button
                  type="button"
                  onClick={saveEdits}
                  disabled={savingEdits}
                  className="px-4 py-2 text-[12px] font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-50"
                >
                  {savingEdits ? "Saving..." : "Save changes"}
                </button>
              )}
            </div>
          </div>
        </div>
      </MainContent>
    </>
  );
}
