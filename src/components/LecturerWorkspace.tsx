import React, { useState, useEffect, useRef } from "react";
import { useSignBridge } from "../context/SignBridgeContext";
import { useNavigate, useParams } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMicrophone,
  faMicrophoneSlash,
  faRightFromBracket,
  faPaperPlane,
  faWifi,
  faRadio,
  faBookOpen,
  faPlus,
  faCopy,
  faCheck,
  faShareNodes,
  faLightbulb,
  faUsers,
  faGear,
  faCircleDot,
  faExclamationTriangle,
  faStopwatch,
  faStar,
  faThumbtack,
  faGraduationCap,
  faChalkboardUser,
  faQuestionCircle,
  faPenToSquare,
  faTrashCan,
  faCommentDots,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { useSpeechToText } from "../hooks/useSpeechToText";
import { Navbar } from "./Navbar";
import { Loader } from "./Loader";

type RightTab = "vocab" | "cards";

export const LecturerWorkspace: React.FC = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  // UI State
  const [loading, setLoading] = useState(true);
  const [customText, setCustomText] = useState("");
  const [showTerminateModal, setShowTerminateModal] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  // Classroom Teaching State
  const [pinnedLineId, setPinnedLineId] = useState<string | null>(null);
  const [highlightedLineIds, setHighlightedLineIds] = useState<Set<string>>(new Set());
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [activeGlossaryTerm, setActiveGlossaryTerm] = useState<{ keyword: string; definition: string; details?: string } | null>(null);

  // Vocab / Card Form
  const [sessionKeyword, setSessionKeyword] = useState("");
  const [sessionAliases, setSessionAliases] = useState("");
  const [sessionDefinition, setSessionDefinition] = useState("");
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [rightTab, setRightTab] = useState<RightTab>("vocab");
  const [sessionDuration, setSessionDuration] = useState(0);
  const [studentCount, setStudentCount] = useState(0);
  const sessionStartRef = useRef<number>(Date.now());

  // Refs
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Context
  const {
    activeSession,
    setActiveSession,
    loadSessionDetails,
    isRecording,
    toggleRecording,
    endSession,
    addMockTranscriptLine,
    broadcastInterimTranscript,
    addSessionVocab,
    isPlaceholder,
  } = useSignBridge();

  const sessionKeywords = activeSession?.customVocab?.map((v) => v.keyword) || [];

  // AssemblyAI Real-Time Streaming
  const {
    interimTranscript,
    startListening,
    stopListening,
    connectionStatus,
    activeEngine,
    hasSpeechKey,
  } = useSpeechToText({
    onFinalResult: (rawText) => {
      addMockTranscriptLine(rawText);
    },
    onInterimResult: (draftText) => {
      broadcastInterimTranscript(draftText);
    },
    keywords: sessionKeywords,
  });

  // ── Sync recording with speech engine ────────────────────────────────────────
  useEffect(() => {
    if (isRecording) startListening();
    else stopListening();
  }, [isRecording, startListening, stopListening]);

  // ── Load session ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (sessionId && (!activeSession || activeSession.id !== sessionId)) {
      setLoading(true);
      loadSessionDetails(sessionId).then((session) => {
        if (session) setActiveSession(session);
        else navigate("/dashboard");
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [sessionId, activeSession?.id]);

  // ── Session duration timer ────────────────────────────────────────────────────
  useEffect(() => {
    sessionStartRef.current = Date.now();
    const interval = setInterval(() => {
      setSessionDuration(Math.floor((Date.now() - sessionStartRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatDuration = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
  };

  // ── Simulated student presence counter (increments as transcript grows) ───────
  // In production this would use Supabase presence on the channel
  useEffect(() => {
    if (!activeSession) return;
    const count = Math.min(activeSession.transcript?.length || 0, 1) > 0 ? Math.max(1, studentCount) : 0;
    setStudentCount(count);
  }, [activeSession?.transcript?.length]);

  // ── Auto-scroll transcript ────────────────────────────────────────────────────
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSession?.transcript]);

  // ── Auto-switch right tab when concept cards appear ──────────────────────────
  useEffect(() => {
    if ((activeSession?.conceptCards?.length || 0) > 0) {
      setRightTab("cards");
    }
  }, [activeSession?.conceptCards?.length]);

  // ── Audio Volume Analyser ─────────────────────────────────────────────────────
  useEffect(() => {
    let canceled = false;
    const stopAudio = () => {
      canceled = true;
      if (animationFrameRef.current) { cancelAnimationFrame(animationFrameRef.current); animationFrameRef.current = null; }
      if (audioStreamRef.current) { audioStreamRef.current.getTracks().forEach((t) => t.stop()); audioStreamRef.current = null; }
      if (audioContextRef.current) {
        const ctx = audioContextRef.current; audioContextRef.current = null;
        try { if (ctx.state !== "closed") ctx.close().catch(() => {}); } catch (_) {}
      }
      setAudioLevel(0);
    };

    if (isRecording) {
      (async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          if (canceled) { stream.getTracks().forEach((t) => t.stop()); return; }
          audioStreamRef.current = stream;
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          const audioCtx = new AudioContextClass();
          if (canceled) { audioCtx.close().catch(() => {}); stream.getTracks().forEach((t) => t.stop()); return; }
          audioContextRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);
          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const tick = () => {
            if (canceled || !audioContextRef.current) return;
            analyser.getByteFrequencyData(dataArray);
            const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
            setAudioLevel(Math.min(100, Math.round((avg / 255) * 400)));
            animationFrameRef.current = requestAnimationFrame(tick);
          };
          tick();
        } catch (e) {
          console.warn("Mic access denied:", e);
        }
      })();
    } else {
      stopAudio();
    }
    return () => stopAudio();
  }, [isRecording]);

  // ── Handlers ──────────────────────────────────────────────────────────────────
  const handleAddSessionTerm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionKeyword.trim() || !sessionDefinition.trim()) return;
    await addSessionVocab({
      keyword: sessionKeyword.trim(),
      aliases: sessionAliases.trim() || undefined,
      definition: sessionDefinition.trim(),
      details: "Added during live lecture.",
    });
    setSessionKeyword(""); setSessionAliases(""); setSessionDefinition("");
  };

  // FIX #5/#14: Custom text input is independent of recording state
  const handleSendCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customText.trim()) return;
    addMockTranscriptLine(customText.trim());
    setCustomText("");
  };

  const handleCopyCode = () => {
    if (!activeSession?.code) return;
    navigator.clipboard.writeText(activeSession.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    if (!activeSession?.code) return;
    navigator.clipboard.writeText(`${window.location.origin}/student/${activeSession.code}`);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // ── Classroom Teaching Helpers ─────────────────────────────────────────────
  const getTeachingCategory = (text: string) => {
    const lower = text.toLowerCase();
    if (text.includes("?")) {
      return { label: "Classroom Question", icon: faQuestionCircle, badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" };
    }
    if (lower.includes("principle") || lower.includes("carbohydrate") || lower.includes("definition") || lower.includes("concept") || lower.includes("structure") || sessionKeywords.some(k => lower.includes(k.toLowerCase()))) {
      return { label: "Core Concept", icon: faGraduationCap, badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" };
    }
    if (lower.includes("for example") || lower.includes("instance") || lower.includes("such as") || lower.includes("like")) {
      return { label: "Teaching Example", icon: faLightbulb, badgeClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" };
    }
    if (lower.includes("good morning") || lower.includes("today") || lower.includes("going through") || lower.includes("welcome")) {
      return { label: "Lesson Topic", icon: faChalkboardUser, badgeClass: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20" };
    }
    return { label: "Teaching Stream", icon: faCommentDots, badgeClass: "bg-[var(--surface)] text-[var(--text-muted)] border-[var(--border)]" };
  };

  const toggleHighlightLine = (id: string) => {
    setHighlightedLineIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDeleteLine = (id: string) => {
    if (!activeSession) return;
    const updated = activeSession.transcript.filter((t) => t.id !== id);
    setActiveSession({ ...activeSession, transcript: updated });
    if (pinnedLineId === id) setPinnedLineId(null);
  };

  const handleSaveEdit = (id: string) => {
    if (!activeSession || !editingText.trim()) return;
    const updated = activeSession.transcript.map((t) =>
      t.id === id ? { ...t, text: editingText.trim() } : t
    );
    setActiveSession({ ...activeSession, transcript: updated });
    setEditingLineId(null);
    setEditingText("");
  };

  const renderClassroomText = (text: string) => {
    const vocabList = activeSession?.customVocab || [];
    const keywords = vocabList.map((v) => v.keyword).filter(Boolean);
    
    // Default fallback academic keyterms if no custom vocab exists yet
    const activeKeywords = keywords.length > 0 ? keywords : ["carbohydrates", "carbohydrate", "principle", "glucose", "energy"];

    const pattern = new RegExp(`\\b(${activeKeywords.map((k) => k.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")).join("|")})\\b`, "gi");
    const parts = text.split(pattern);

    return parts.map((part, i) => {
      const matchedVocab = vocabList.find((v) => v.keyword.toLowerCase() === part.toLowerCase());
      const isKeyterm = matchedVocab || activeKeywords.some((k) => k.toLowerCase() === part.toLowerCase());

      if (isKeyterm) {
        const displayDefinition = matchedVocab?.definition || `Core lesson keyterm (${part}). Primary subject concept discussed during this lecture session.`;
        return (
          <span
            key={i}
            onClick={() => setActiveGlossaryTerm({ keyword: part, definition: displayDefinition, details: matchedVocab?.details })}
            className="inline-flex items-baseline gap-1 px-1.5 py-0.5 rounded bg-[var(--primary)]/15 border border-[var(--primary)]/30 text-[var(--primary)] font-bold text-xs sm:text-sm cursor-pointer hover:bg-[var(--primary)]/25 transition-colors my-0.5 font-mono shadow-2xs"
            title="Click to inspect Sign Gloss & Definition"
          >
            <span>{part}</span>
            <span className="text-[9px] font-mono opacity-80 uppercase tracking-tighter">🤟 GLOSS</span>
          </span>
        );
      }
      return part;
    });
  };

  const handleEndSession = async () => {
    const summaryId = await endSession();
    navigate(summaryId ? `/review/${summaryId}` : "/dashboard");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)] text-[var(--text)]">
        <Loader label="Loading classroom broadcast..." />
      </div>
    );
  }

  if (!activeSession) return null;

  const hasCards = (activeSession.conceptCards || []).length > 0;

  return (
    <div className="min-h-screen pt-12 bg-[var(--background)] text-[var(--text)] transition-colors duration-150">
      <Navbar variant="workspace" contextLabel={activeSession.title} onBack={() => setShowTerminateModal(true)} />

      {isPlaceholder && (
        <div className="bg-yellow-500/10 border-b border-yellow-500/20 text-yellow-500 text-[10px] py-1.5 px-4 text-center font-mono">
          Demo Mode Active
        </div>
      )}

      {/* ── Speech Key Missing Warning ─────────────────────────────────────── */}
      {!hasSpeechKey && (
        <div className="border-b border-yellow-500/20 bg-yellow-500/8 px-4 sm:px-6 py-2.5 flex items-center gap-3 text-xs">
          <FontAwesomeIcon icon={faExclamationTriangle} className="text-yellow-500 text-sm shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-yellow-600 dark:text-yellow-400">Speech Engine key not set</span>
            <span className="text-[var(--text-muted)] ml-2">Real-time speech transcription requires a Speech Engine Key to function.</span>
          </div>
          <button
            onClick={() => navigate("/settings")}
            className="h-6 px-2.5 border border-yellow-500/40 text-yellow-500 hover:bg-yellow-500/10 rounded text-[10px] font-medium flex items-center gap-1 cursor-pointer transition-colors shrink-0"
          >
            <FontAwesomeIcon icon={faGear} className="text-[9px]" /> Settings
          </button>
        </div>
      )}

      {/* ── Top Workspace Bar (Fixed to Top below Navbar) ────────────────────────── */}
      <header className="fixed top-12 left-0 right-0 z-20 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-md px-4 sm:px-6 py-3 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-sm">
        {/* Left: Mic + Waveform */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          <button
            onClick={toggleRecording}
            disabled={!hasSpeechKey}
            title={!hasSpeechKey ? "Set your Speech Engine Key in Settings to enable recording" : undefined}
            className={`h-10 px-4 sm:px-5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shrink-0 shadow-sm ${
              !hasSpeechKey
                ? "opacity-50 cursor-not-allowed bg-[var(--surface)] border border-[var(--border)] text-[var(--text-muted)]"
                : isRecording
                ? "bg-red-500 hover:bg-red-600 text-white cursor-pointer"
                : "bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-black cursor-pointer"
            }`}
          >
            {isRecording ? (
              <><FontAwesomeIcon icon={faMicrophoneSlash} className="text-xs" /> Stop Mic</>
            ) : (
              <><FontAwesomeIcon icon={faMicrophone} className="text-xs" /> Start Speaking</>
            )}
          </button>

          {/* Audio Waveform */}
          <div className="h-10 flex items-center gap-1 px-3 border border-[var(--border)] rounded-xl bg-[var(--background)] shrink-0">
            {isRecording
              ? Array.from({ length: 10 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-1 rounded-full bg-[var(--primary)] transition-all duration-150"
                    style={{ height: `${Math.max(8, Math.sin(i * 0.6) * audioLevel * 0.4 + audioLevel * 0.4)}%` }}
                  />
                ))
              : Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="w-1 h-1 rounded-full bg-[var(--border)]" />
                ))}
          </div>

          {/* Session duration timer */}
          <div className="flex items-center gap-1.5 border border-[var(--border)] rounded-lg bg-[var(--background)] px-2.5 py-1.5 text-xs shrink-0">
            <FontAwesomeIcon icon={faStopwatch} className="text-[10px] text-[var(--text-muted)]" />
            <span className="font-mono text-[var(--text-muted)] text-[11px]">{formatDuration(sessionDuration)}</span>
          </div>

          {/* Student connection indicator */}
          <div className="flex items-center gap-1.5 border border-[var(--border)] rounded-lg bg-[var(--background)] px-2.5 py-1.5 text-xs shrink-0" title="Estimated connected students">
            <FontAwesomeIcon icon={faUsers} className="text-[10px] text-[var(--primary)]" />
            <span className="font-mono text-[var(--text-muted)] text-[11px]">
              {studentCount > 0 ? `${studentCount} student${studentCount > 1 ? "s" : ""}` : "Waiting for students"}
            </span>
          </div>
        </div>

        {/* Right: Room code + Connection status + End Lecture */}
        <div className="flex items-center justify-between md:justify-end gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 border border-[var(--border)] rounded-lg bg-[var(--background)] px-2.5 py-1.5 text-xs max-w-full overflow-x-auto">
            <span className="text-[var(--text-muted)] text-[11px] font-mono whitespace-nowrap">Room:</span>
            <span className="font-mono font-bold text-[var(--text)] text-xs tracking-wider whitespace-nowrap">{activeSession.code}</span>
            <div className="flex items-center gap-1 ml-1 pl-2 border-l border-[var(--border)] shrink-0">
              <button
                onClick={handleCopyCode}
                className="px-2 py-0.5 rounded text-[11px] font-medium border border-[var(--border)] hover:border-[var(--primary)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors cursor-pointer flex items-center gap-1"
                title="Copy Room Code"
              >
                <FontAwesomeIcon icon={copiedCode ? faCheck : faCopy} className={`text-[10px] ${copiedCode ? "text-[var(--primary)]" : ""}`} />
                <span>{copiedCode ? "Copied" : "Copy Code"}</span>
              </button>
              <button
                onClick={handleCopyLink}
                className="px-2 py-0.5 rounded text-[11px] font-medium border border-[var(--border)] hover:border-[var(--primary)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors cursor-pointer flex items-center gap-1"
                title="Copy Student Join Link"
              >
                <FontAwesomeIcon icon={copiedLink ? faCheck : faShareNodes} className={`text-[10px] ${copiedLink ? "text-[var(--primary)]" : ""}`} />
                <span>{copiedLink ? "Link Copied" : "Copy Link"}</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto md:ml-0">
            <span className="text-[10px] font-mono text-[var(--text-muted)] flex items-center gap-1.5 border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 rounded-lg whitespace-nowrap">
              <FontAwesomeIcon
                icon={faRadio}
                className={`text-[12px] ${connectionStatus === "connected" ? "text-[var(--primary)] animate-pulse" : "text-yellow-500"}`}
              />
              <span className="hidden sm:inline">
                {connectionStatus === "connected"
                  ? `Live (${activeEngine === "deepgram" ? "AI Speech Engine" : "Browser Speech"})`
                  : connectionStatus === "connecting"
                  ? "Connecting Speech AI..."
                  : "Offline"}
              </span>
            </span>
            <button
              onClick={() => setShowTerminateModal(true)}
              className="h-9 px-3 text-[10px] font-bold border border-red-500/30 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap"
            >
              <FontAwesomeIcon icon={faRightFromBracket} className="text-[12px]" /> End Lecture
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Workspace (offset for fixed header) ────────────────────────── */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-3 sm:px-6 pt-24 md:pt-20 pb-6 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">

        {/* Left Column (8/12): Classroom Live Teaching Flow */}
        <div className="lg:col-span-8 space-y-4">
          {/* ── Active Classroom Teaching Header & Whiteboard Anchor ── */}
          <div className="border border-[var(--border)] rounded-2xl bg-[var(--surface)] p-4 sm:p-5 text-left shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center font-bold text-base shrink-0 border border-[var(--primary)]/20">
                  <FontAwesomeIcon icon={faChalkboardUser} />
                </div>
                <div>
                  <h1 className="text-sm sm:text-base font-bold text-[var(--text)] leading-tight flex items-center gap-2">
                    <span>{activeSession.title || "Live Lecture Session"}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--primary)]/10 text-[var(--primary)] font-semibold border border-[var(--primary)]/20">
                      Live Classroom
                    </span>
                  </h1>
                  <p className="text-[11px] text-[var(--text-muted)] font-mono flex items-center gap-2 mt-0.5">
                    <span>Subject: General Science</span>
                    <span>•</span>
                    <span>Room: {activeSession.code}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Pinned Teaching Point Anchor */}
            {pinnedLineId ? (() => {
              const pinnedLine = activeSession.transcript?.find(t => t.id === pinnedLineId);
              if (!pinnedLine) return null;
              return (
                <div className="bg-[var(--background)] border border-[var(--primary)]/40 rounded-xl p-3.5 flex items-start justify-between gap-3 animate-fade-in shadow-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--primary)] font-mono uppercase tracking-wider">
                      <FontAwesomeIcon icon={faThumbtack} className="text-[11px]" /> Active Classroom Board Focus
                    </div>
                    <p className="text-xs sm:text-sm font-semibold text-[var(--text)] leading-relaxed">
                      {renderClassroomText(pinnedLine.text)}
                    </p>
                  </div>
                  <button
                    onClick={() => setPinnedLineId(null)}
                    className="text-[10px] font-mono px-2.5 py-1 border border-[var(--border)] hover:border-red-500/40 text-[var(--text-muted)] hover:text-red-500 rounded bg-[var(--surface)] transition-colors cursor-pointer shrink-0"
                  >
                    Unpin Focus
                  </button>
                </div>
              );
            })() : (
              <div className="text-[11px] text-[var(--text-muted)] flex items-center gap-2 py-1 px-3 bg-[var(--background)] rounded-lg border border-[var(--border)]/60">
                <FontAwesomeIcon icon={faLightbulb} className="text-[var(--primary)] text-xs shrink-0" />
                <span>Click <strong>Pin Focus</strong> on any paragraph below to highlight active teaching concepts for your students.</span>
              </div>
            )}
          </div>

          {/* ── Main Classroom Transcript Feed ── */}
          <div className="border border-[var(--border)] rounded-2xl bg-[var(--surface)] p-4 sm:p-6 text-left flex flex-col min-h-[420px] sm:min-h-[540px] shadow-sm">
            <div className="border-b border-[var(--border)] pb-3 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2">
              <h2 className="text-xs font-bold tracking-wider uppercase text-[var(--text-muted)] flex items-center gap-2">
                <FontAwesomeIcon icon={faBookOpen} className="text-xs text-[var(--primary)]" />
                Live Pedagogical Stream ({activeSession.transcript?.length || 0} Teaching Blocks)
              </h2>
              <span className="text-[10px] font-mono text-[var(--text-muted)]">Broadcasts formatted teaching blocks to connected students</span>
            </div>

            {/* Transcript list */}
            <div className="flex-1 overflow-y-auto max-h-[50vh] sm:max-h-[55vh] space-y-3.5 pr-1">
              {activeSession.transcript?.length === 0 && !interimTranscript ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-12 sm:py-20 text-[var(--text-muted)] space-y-3 px-2">
                  <FontAwesomeIcon icon={faWifi} className="text-2xl sm:text-3xl animate-pulse text-[var(--primary)]" />
                  <p className="font-bold text-xs sm:text-sm text-[var(--text)]">Microphone Classroom Stream Ready</p>
                  <p className="text-[11px] sm:text-xs max-w-xs leading-relaxed">
                    Click "Start Speaking" above to begin live teaching captions for connected students.
                  </p>
                  {!hasSpeechKey && (
                    <div className="flex items-center gap-1.5 text-[10px] text-yellow-500 border border-yellow-500/20 bg-yellow-500/5 px-3 py-2 rounded-lg">
                      <FontAwesomeIcon icon={faExclamationTriangle} />
                      <span>Set your Speech Engine Key in <button onClick={() => navigate("/settings")} className="underline cursor-pointer">Settings</button> to enable live transcription</span>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {activeSession.transcript?.map((line, idx) => {
                    const category = getTeachingCategory(line.text);
                    const isPinned = pinnedLineId === line.id;
                    const isHighlighted = highlightedLineIds.has(line.id);
                    const isEditing = editingLineId === line.id;
                    const time = new Date(line.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

                    return (
                      <div
                        key={line.id}
                        className={`p-4 border rounded-2xl bg-[var(--background)] space-y-3 transition-all animate-fade-in text-left shadow-2xs relative ${
                          isPinned
                            ? "border-[var(--primary)] ring-1 ring-[var(--primary)]/30 bg-[var(--primary)]/5"
                            : isHighlighted
                            ? "border-amber-500/50 bg-amber-500/5"
                            : "border-[var(--border)] hover:border-[var(--border)]/80"
                        }`}
                      >
                        {/* Card Header: Category Badge + Timestamp + Lecturer Actions */}
                        <div className="flex items-center justify-between border-b border-[var(--border)]/60 pb-2 flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border flex items-center gap-1.5 font-mono ${category.badgeClass}`}>
                              <FontAwesomeIcon icon={category.icon} className="text-[9px]" />
                              {category.label}
                            </span>
                            <span className="text-[10px] font-mono text-[var(--text-muted)]">
                              Block #{idx + 1} · {time}
                            </span>
                          </div>

                          {/* Action Toolbar */}
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setPinnedLineId(isPinned ? null : line.id)}
                              className={`h-6 px-2 text-[10px] font-medium border rounded flex items-center gap-1 transition-colors cursor-pointer ${
                                isPinned
                                  ? "bg-[var(--primary)] text-black border-[var(--primary)] font-bold"
                                  : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] bg-[var(--surface)]"
                              }`}
                              title={isPinned ? "Unpin from whiteboard" : "Pin to classroom whiteboard header"}
                            >
                              <FontAwesomeIcon icon={faThumbtack} className="text-[9px]" />
                              <span>{isPinned ? "Pinned" : "Pin Focus"}</span>
                            </button>

                            <button
                              onClick={() => toggleHighlightLine(line.id)}
                              className={`h-6 w-6 flex items-center justify-center border rounded transition-colors cursor-pointer ${
                                isHighlighted
                                  ? "bg-amber-500 text-black border-amber-500 font-bold"
                                  : "border-[var(--border)] text-[var(--text-muted)] hover:text-amber-500 bg-[var(--surface)]"
                              }`}
                              title="Highlight key teaching block"
                            >
                              <FontAwesomeIcon icon={faStar} className="text-[10px]" />
                            </button>

                            <button
                              onClick={() => {
                                setEditingLineId(line.id);
                                setEditingText(line.text);
                              }}
                              className="h-6 w-6 flex items-center justify-center border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] bg-[var(--surface)] rounded transition-colors cursor-pointer"
                              title="Edit teaching line"
                            >
                              <FontAwesomeIcon icon={faPenToSquare} className="text-[10px]" />
                            </button>

                            <button
                              onClick={() => handleDeleteLine(line.id)}
                              className="h-6 w-6 flex items-center justify-center border border-[var(--border)] text-[var(--text-muted)] hover:text-red-500 bg-[var(--surface)] rounded transition-colors cursor-pointer"
                              title="Delete teaching line"
                            >
                              <FontAwesomeIcon icon={faTrashCan} className="text-[10px]" />
                            </button>
                          </div>
                        </div>

                        {/* Card Body: Text or Inline Editor */}
                        {isEditing ? (
                          <div className="space-y-2 pt-1">
                            <textarea
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                              className="w-full text-xs p-2.5 border border-[var(--primary)] rounded-xl bg-[var(--surface)] text-[var(--text)] focus:outline-none min-h-[70px]"
                            />
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => setEditingLineId(null)}
                                className="px-2.5 py-1 text-[10px] border border-[var(--border)] rounded text-[var(--text-muted)] hover:bg-[var(--surface)]"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleSaveEdit(line.id)}
                                className="px-3 py-1 text-[10px] bg-[var(--primary)] text-black font-bold rounded hover:bg-[var(--primary-hover)]"
                              >
                                Save Fix
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm sm:text-base text-[var(--text)] leading-relaxed font-sans font-normal">
                            {renderClassroomText(line.text)}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {interimTranscript && (
                    <div className="p-4 border border-dashed border-[var(--primary)] bg-[var(--primary)]/5 rounded-2xl space-y-1.5 text-left animate-fade-in">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-mono text-[var(--primary)] font-bold uppercase tracking-wider flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-[var(--primary)] animate-ping" />
                          Live Speaking Draft...
                        </span>
                        <span className="text-[9px] font-mono text-[var(--text-muted)]">Transcribing live</span>
                      </div>
                      <p className="text-sm text-[var(--text)] italic leading-relaxed">{interimTranscript}</p>
                    </div>
                  )}
                </>
              )}
              <div ref={transcriptEndRef} />
            </div>

            {/* FIX #5/#14: Custom text input works independently of recording */}
            <form onSubmit={handleSendCustom} className="mt-4 flex gap-2 pt-3 border-t border-[var(--border)]">
              <input
                type="text"
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Type text to broadcast directly to students (works without mic)..."
                className="flex-1 text-xs px-3.5 py-2.5 border border-[var(--border)] rounded-xl bg-[var(--background)] text-[var(--text)] focus:outline-none focus:border-[var(--primary)] transition-colors"
              />
              <button
                type="submit"
                disabled={!customText.trim()}
                className="h-10 px-4 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-black font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                <FontAwesomeIcon icon={faPaperPlane} className="text-[13px]" /> Send
              </button>
            </form>
          </div>
        </div>

        {/* Right Column (4/12): Vocabulary + Concept Cards Tabs */}
        <div className="lg:col-span-4 space-y-4">
          <div className="border border-[var(--border)] rounded-2xl bg-[var(--surface)] text-left shadow-sm min-h-[540px] flex flex-col overflow-hidden">

            {/* FIX #7: Tabbed panel — Vocabulary & AI Concept Cards */}
            <div className="border-b border-[var(--border)] flex items-center bg-[var(--background)]">
              <button
                onClick={() => setRightTab("vocab")}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-3 text-[11px] font-semibold border-b-2 transition-colors cursor-pointer ${
                  rightTab === "vocab" ? "border-[var(--primary)] text-[var(--primary)]" : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                <FontAwesomeIcon icon={faBookOpen} className="text-[11px]" />
                <span>Vocabulary</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${rightTab === "vocab" ? "bg-[var(--primary)] text-black" : "bg-[var(--border)] text-[var(--text-muted)]"}`}>
                  {activeSession.customVocab?.length || 0}
                </span>
              </button>
              <button
                onClick={() => setRightTab("cards")}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-3 text-[11px] font-semibold border-b-2 transition-colors cursor-pointer relative ${
                  rightTab === "cards" ? "border-[var(--primary)] text-[var(--primary)]" : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                <FontAwesomeIcon icon={faLightbulb} className="text-[11px]" />
                <span>AI Concepts</span>
                {hasCards && (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${rightTab === "cards" ? "bg-[var(--primary)] text-black" : "bg-green-500/20 text-green-500 border border-green-500/30"}`}>
                    {activeSession.conceptCards.length}
                  </span>
                )}
              </button>
            </div>

            {/* ── Vocabulary Tab ── */}
            {rightTab === "vocab" && (
              <div className="flex-1 flex flex-col p-5 sm:p-6 space-y-4 overflow-hidden">
                <div>
                  <h3 className="text-xs font-bold tracking-wider uppercase text-[var(--text)] flex items-center gap-2">
                    <FontAwesomeIcon icon={faRadio} className="text-xs text-violet-400" />
                    Course Vocabulary
                  </h3>
                  <p className="text-[10px] text-[var(--text-muted)] mt-1 leading-relaxed">
                    Add terms here — students see them highlighted in the live transcript.
                  </p>
                </div>

                <form onSubmit={handleAddSessionTerm} className="space-y-2.5">
                  <input
                    type="text"
                    required
                    placeholder="Keyterm (e.g. Mitochondria)"
                    value={sessionKeyword}
                    onChange={(e) => setSessionKeyword(e.target.value)}
                    className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--text)] text-xs focus:outline-none focus:border-[var(--primary)] transition-colors"
                  />
                  <input
                    type="text"
                    placeholder="Aliases / Phonetics (optional)"
                    value={sessionAliases}
                    onChange={(e) => setSessionAliases(e.target.value)}
                    className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--text)] text-xs focus:outline-none focus:border-[var(--primary)] transition-colors"
                  />
                  <textarea
                    rows={2}
                    required
                    placeholder="Definition (e.g. Powerhouse of the cell)"
                    value={sessionDefinition}
                    onChange={(e) => setSessionDefinition(e.target.value)}
                    className="w-full p-2.5 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--text)] text-xs focus:outline-none focus:border-[var(--primary)] resize-none font-sans transition-colors"
                  />
                  <button
                    type="submit"
                    className="w-full h-9 bg-[var(--background)] border border-[var(--border)] hover:border-[var(--primary)] text-[var(--text)] font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <FontAwesomeIcon icon={faPlus} className="text-[13px]" /> Add Keyterm
                  </button>
                </form>

                <div className="space-y-2 overflow-y-auto flex-1 border-t border-[var(--border)] pt-3 max-h-48">
                  {activeSession.customVocab?.length === 0 ? (
                    <p className="text-[10px] text-[var(--text-muted)] italic text-center py-4">No vocabulary keyterms added yet.</p>
                  ) : (
                    activeSession.customVocab?.map((term, i) => (
                      <div key={i} className="p-3 border border-[var(--border)] rounded-lg bg-[var(--background)] space-y-1">
                        <span className="text-xs font-mono font-bold text-[var(--primary)] block">{term.keyword}</span>
                        <p className="text-[11px] text-[var(--text)] leading-normal">{term.definition}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* ── AI Concept Cards Tab (what students see) ── */}
            {rightTab === "cards" && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="px-5 py-3 border-b border-[var(--border)] bg-[var(--background)]">
                  <p className="text-[10px] text-[var(--text-muted)] flex items-center gap-1.5">
                    <FontAwesomeIcon icon={faStar} className="text-[var(--primary)] text-[10px]" />
                    Live view of concept cards your students are seeing — extracted by Gemini AI
                  </p>
                </div>
                <div className="flex-1 p-4 overflow-y-auto space-y-3 max-h-[58vh]">
                  {!hasCards ? (
                    <div className="flex flex-col items-center justify-center text-center py-12 space-y-3 text-[var(--text-muted)]">
                      <FontAwesomeIcon icon={faLightbulb} className="text-2xl opacity-30" />
                      <p className="text-xs">No concept cards yet.</p>
                      <p className="text-[10px] max-w-[200px] leading-relaxed">
                        As you speak, Gemini AI will extract technical concepts and surface them here and on student screens.
                      </p>
                    </div>
                  ) : (
                    activeSession.conceptCards.map((card) => (
                      <div key={card.id} className="p-3.5 border border-[var(--border)] rounded-xl bg-[var(--background)] space-y-1.5 animate-fade-in hover:border-[var(--primary)]/30 transition-all">
                        <div className="flex items-center gap-1.5">
                          <FontAwesomeIcon icon={faCircleDot} className="text-[var(--primary)] text-[9px] shrink-0" />
                          <h4 className="font-bold text-xs text-[var(--primary)] font-mono">{card.concept}</h4>
                        </div>
                        <p className="text-[11px] text-[var(--text)] leading-relaxed pl-3.5">{card.definition}</p>
                        {card.details && (
                          <p className="text-[10px] text-[var(--text-muted)] leading-relaxed italic border-t border-[var(--border)] pt-1.5 pl-3.5">{card.details}</p>
                        )}
                        <span className="text-[9px] font-mono text-[var(--text-muted)] pl-3.5 block">
                          {new Date(card.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ── Sign Language Gloss & Keyterm Modal ────────────────────────────── */}
      {activeGlossaryTerm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="border border-[var(--border)] rounded-2xl bg-[var(--surface)] p-6 max-w-md w-full space-y-4 shadow-xl text-left relative">
            <button
              onClick={() => setActiveGlossaryTerm(null)}
              className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-[var(--text)] text-sm cursor-pointer"
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[var(--primary)]/15 text-[var(--primary)] border border-[var(--primary)]/30 uppercase tracking-wider">
                🤟 Sign Language Token & Concept
              </span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-[var(--text)] capitalize flex items-center gap-2">
                {activeGlossaryTerm.keyword}
              </h3>
              <p className="text-xs font-mono text-[var(--primary)] font-semibold mt-1">
                [ASL GLOSS: {activeGlossaryTerm.keyword.toUpperCase().split("").join("-")}]
              </p>
            </div>
            <div className="border-t border-[var(--border)] pt-3 space-y-2">
              <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider font-mono text-[10px]">
                Classroom Definition:
              </p>
              <p className="text-xs sm:text-sm text-[var(--text)] leading-relaxed bg-[var(--background)] p-3 rounded-xl border border-[var(--border)]">
                {activeGlossaryTerm.definition}
              </p>
              {activeGlossaryTerm.details && (
                <p className="text-[11px] text-[var(--text-muted)] italic">
                  Context: {activeGlossaryTerm.details}
                </p>
              )}
            </div>
            <button
              onClick={() => setActiveGlossaryTerm(null)}
              className="w-full py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-black font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              Close Token Inspector
            </button>
          </div>
        </div>
      )}

      {/* ── End Lecture Modal ───────────────────────────────────────────────────── */}
      {showTerminateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="border border-[var(--border)] rounded-2xl bg-[var(--surface)] p-6 max-w-sm w-full space-y-4 shadow-xl text-left">
            <h3 className="text-base font-bold text-[var(--text)]">End Live Classroom Session?</h3>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              This will close the microphone stream and conclude the live caption feed for all connected students.
            </p>
            {/* FIX #8: Inform about AI summary generation */}
            <div className="bg-[var(--primary)]/5 border border-[var(--primary)]/20 rounded-lg p-3 text-[11px] space-y-1.5">
              <p className="font-semibold text-[var(--primary)] flex items-center gap-1.5">
                <FontAwesomeIcon icon={faStar} className="text-[11px]" />
                What happens next:
              </p>
              <p className="text-[var(--text-muted)]">• A Smart Lecture Summary will be auto-generated by Gemini AI</p>
              <p className="text-[var(--text-muted)]">• All transcripts, concept cards, and smart notes are saved</p>
              <p className="text-[var(--text-muted)]">• You'll be taken to the Post-Lecture Review page</p>
            </div>
            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => setShowTerminateModal(false)}
                className="flex-1 py-2.5 border border-[var(--border)] rounded-xl text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text)] transition-colors cursor-pointer"
              >
                Cancel — Keep Going
              </button>
              <button
                onClick={handleEndSession}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                End Lecture
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
