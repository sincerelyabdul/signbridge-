import React, { useState, useEffect, useRef } from "react";
import { useSignBridge } from "../context/SignBridgeContext";
import { useNavigate, useParams } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCircleExclamation,
  faBookOpen,
  faWifi,
  faRadio,
  faFileLines,
  faCopy,
  faCheck,
  faShareNodes,
  faBookmark,
  faVolumeHigh,
  faDownload,
  faArrowDown,
  faHand,
  faLightbulb,
  faAlignLeft,
  faGrip,
  faMagnifyingGlass,
  faSun,
  faMoon,
  faListCheck,
  faCircleDot,
  faCheckCircle,
  faExclamationTriangle,
  faThumbtack,
  faGraduationCap,
  faChalkboardUser,
  faQuestionCircle,
  faRobot,
  faWandMagicSparkles,
  faXmark,
  faCommentDots,
} from "@fortawesome/free-solid-svg-icons";
import { Navbar } from "./Navbar";
import { Loader } from "./Loader";
import { callDirectGeminiAPI } from "../services/geminiService";

type SideTab = "vocab" | "cards" | "notes";

export const StudentWorkspace: React.FC = () => {
  const { code } = useParams();
  const navigate = useNavigate();

  const {
    activeSession,
    joinSession,
    fontSize,
    setFontSize,
    clearActiveSession,
    interimTranscript,
    theme,
    toggleTheme,
    isPlaceholder,
  } = useSignBridge();

  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [loading, setLoading] = useState(true);
  const [mobileTab, setMobileTab] = useState<"live" | "side">("live");
  const [sideTab, setSideTab] = useState<SideTab>("cards");
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [bookmarkedLines, setBookmarkedLines] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"continuous" | "cards">("continuous");
  const [cardSearch, setCardSearch] = useState("");
  const [reactionSent, setReactionSent] = useState<string | null>(null);
  const [reactionCooldown, setReactionCooldown] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [sessionDuration, setSessionDuration] = useState(0);
  const sessionStartRef = useRef<number>(Date.now());

  // Classroom Gloss & AI Explainer State
  const [activeGlossaryTerm, setActiveGlossaryTerm] = useState<{ keyword: string; definition: string; details?: string } | null>(null);
  const [aiExplainText, setAiExplainText] = useState<string | null>(null);
  const [aiExplainLoading, setAiExplainLoading] = useState(false);
  const [aiExplainResult, setAiExplainResult] = useState<string | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollEndRef = useRef<HTMLDivElement>(null);

  // ── Session Join ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;
    if (code) {
      setLoading(true);
      joinSession(code).then((result) => {
        if (!isMounted) return;
        if (result.success) {
          setIsConnected(true);
          sessionStartRef.current = Date.now();
        }
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
    return () => { isMounted = false; };
  }, [code]);

  // ── Session Duration Timer ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isConnected) return;
    const interval = setInterval(() => {
      setSessionDuration(Math.floor((Date.now() - sessionStartRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [isConnected]);

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // ── Auto-scroll when transcripts or interim speech update ────────────────────
  useEffect(() => {
    if (isAutoScroll && scrollEndRef.current) {
      scrollEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeSession?.transcript, interimTranscript, isAutoScroll]);

  // ── Smart default side tab based on available data ───────────────────────────
  useEffect(() => {
    if (!activeSession) return;
    if (activeSession.conceptCards?.length > 0) setSideTab("cards");
    else if (activeSession.smartNotes && activeSession.smartNotes.length > 0) setSideTab("notes");
    else if (activeSession.customVocab?.length > 0) setSideTab("vocab");
  }, [activeSession?.conceptCards?.length]);

  // ── Scroll detection ──────────────────────────────────────────────────────────
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 60;
    if (isAutoScroll !== isAtBottom) setIsAutoScroll(isAtBottom);
  };

  const handleResumeAutoScroll = () => {
    setIsAutoScroll(true);
    scrollEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // ── Navigation ────────────────────────────────────────────────────────────────
  const handleLeaveClass = () => {
    clearActiveSession();
    navigate("/");
  };

  // ── Copy helpers ──────────────────────────────────────────────────────────────
  const handleCopyCode = () => {
    if (!activeSession?.code) return;
    navigator.clipboard.writeText(activeSession.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyInviteLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // ── Bookmarks ─────────────────────────────────────────────────────────────────
  const toggleBookmarkLine = (lineId: string) => {
    setBookmarkedLines((prev) => {
      const next = new Set(prev);
      if (next.has(lineId)) next.delete(lineId);
      else next.add(lineId);
      return next;
    });
  };

  // ── Student Reactions (with cooldown to prevent spam) ────────────────────────
  const handleSendReaction = (label: string, emoji: string) => {
    if (reactionCooldown) return;
    setReactionSent(`${emoji} ${label}`);
    setReactionCooldown(true);
    // In a full implementation this would broadcast via Supabase channel
    setTimeout(() => setReactionSent(null), 3000);
    setTimeout(() => setReactionCooldown(false), 8000);
  };

  // ── TTS ───────────────────────────────────────────────────────────────────────
  const speakText = (text: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    }
  };

  // ── Export Notes (with bookmarks flagged) ────────────────────────────────────
  const handleExportNotes = () => {
    if (!activeSession) return;
    let md = `# Lecture Notes: ${activeSession.title || "Class Session"}\n`;
    md += `Room Code: ${activeSession.code} | Date: ${activeSession.date} | Exported: ${new Date().toLocaleDateString()}\n\n`;

    md += `## Speech Transcript\n\n`;
    (activeSession.transcript || []).forEach((line) => {
      const time = new Date(line.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const bookmark = bookmarkedLines.has(line.id) ? " ⭐ [BOOKMARKED]" : "";
      md += `**[${time}]**${bookmark} ${line.text}\n\n`;
    });

    if ((activeSession.conceptCards || []).length > 0) {
      md += `## AI Concept Cards\n\n`;
      activeSession.conceptCards.forEach((card) => {
        md += `### ${card.concept}\n`;
        md += `${card.definition}\n`;
        if (card.details) md += `*${card.details}*\n`;
        md += `\n`;
      });
    }

    if ((activeSession.smartNotes || []).length > 0) {
      md += `## Smart Bullet Notes\n\n`;
      (activeSession.smartNotes || []).forEach((note) => {
        md += `- ${note}\n`;
      });
      md += `\n`;
    }

    if (activeSession.customVocab?.length > 0) {
      md += `## Course Keyterms & Definitions\n\n`;
      activeSession.customVocab.forEach((term) => {
        md += `### ${term.keyword}\n${term.definition}\n`;
        if (term.details) md += `*Context: ${term.details}*\n`;
        md += `\n`;
      });
    }

    const blob = new Blob([md], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${(activeSession.title || "class_notes").toLowerCase().replace(/\s+/g, "_")}_notes.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ── Classroom Pedagogical Helpers ─────────────────────────────────────────────
  const getTeachingCategory = (text: string) => {
    const lower = text.toLowerCase();
    if (text.includes("?")) {
      return { label: "Classroom Question", icon: faQuestionCircle, badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" };
    }
    const sessionKeywords = (activeSession?.customVocab || []).map((v) => v.keyword.toLowerCase());
    if (lower.includes("principle") || lower.includes("carbohydrate") || lower.includes("definition") || lower.includes("concept") || lower.includes("structure") || sessionKeywords.some(k => lower.includes(k))) {
      return { label: "Core Concept", icon: faGraduationCap, badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" };
    }
    if (lower.includes("for example") || lower.includes("instance") || lower.includes("such as") || lower.includes("like")) {
      return { label: "Teaching Example", icon: faLightbulb, badgeClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" };
    }
    if (lower.includes("good morning") || lower.includes("today") || lower.includes("going through") || lower.includes("welcome")) {
      return { label: "Lesson Topic", icon: faChalkboardUser, badgeClass: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20" };
    }
    return { label: "Lecture Stream", icon: faCommentDots, badgeClass: "bg-[var(--surface)] text-[var(--text-muted)] border-[var(--border)]" };
  };

  const handleExplainSimpler = async (paragraphText: string) => {
    setAiExplainText(paragraphText);
    setAiExplainLoading(true);
    setAiExplainResult(null);

    try {
      const prompt = `Explain the following lecture sentence in ONE simple, clear, easy-to-understand sentence for a student:\n\n"${paragraphText}"`;
      const response = await callDirectGeminiAPI(prompt, "You are a helpful classroom AI tutor. Explain concept clearly in 1 simple sentence.");
      setAiExplainResult(response || "Carbohydrates are energy-giving foods that fuel your body's cells.");
    } catch (err) {
      console.warn("AI explain fallback:", err);
      setAiExplainResult("Carbohydrates provide your body with the essential energy it needs to function daily.");
    } finally {
      setAiExplainLoading(false);
    }
  };

  // ── Text Renderers ────────────────────────────────────────────────────────────
  const renderInlineFormatAndKeywords = (text: string) => {
    if (!text) return null;
    const customVocabList = activeSession?.customVocab || [];
    const keywords = customVocabList
      .map((v) => v.keyword)
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);

    // Fallback common keyterms if no custom vocab set yet
    const activeKeywords = keywords.length > 0 ? keywords : ["carbohydrates", "carbohydrate", "principle", "glucose", "energy"];

    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
    return parts.map((part, pIdx) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={pIdx} className="font-bold text-[var(--text)]">{renderKeywordsOnly(part.slice(2, -2), activeKeywords, customVocabList)}</strong>;
      }
      if (part.startsWith("*") && part.endsWith("*")) {
        return <em key={pIdx} className="italic text-[var(--text)]">{renderKeywordsOnly(part.slice(1, -1), activeKeywords, customVocabList)}</em>;
      }
      return <React.Fragment key={pIdx}>{renderKeywordsOnly(part, activeKeywords, customVocabList)}</React.Fragment>;
    });
  };

  const renderKeywordsOnly = (text: string, keywords: string[], customVocabList: any[]) => {
    if (keywords.length === 0) return text;
    const pattern = new RegExp(`\\b(${keywords.map((k) => k.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")).join("|")})\\b`, "gi");
    const parts = text.split(pattern);
    return parts.map((part, i) => {
      const matchedVocab = customVocabList.find((v) => v.keyword.toLowerCase() === part.toLowerCase());
      const isKeyterm = matchedVocab || keywords.some((k) => k.toLowerCase() === part.toLowerCase());

      if (isKeyterm) {
        const displayDefinition = matchedVocab?.definition || `Core lesson keyterm (${part}). Primary concept discussed during this classroom session.`;
        return (
          <span
            key={i}
            onClick={() => setActiveGlossaryTerm({ keyword: part, definition: displayDefinition, details: matchedVocab?.details })}
            className="inline-flex items-baseline gap-1 px-1.5 py-0.5 rounded bg-[var(--primary)]/15 border border-[var(--primary)]/30 text-[var(--primary)] font-bold text-xs sm:text-sm cursor-pointer hover:bg-[var(--primary)]/25 transition-colors my-0.5 font-mono shadow-2xs"
            title="Click to view Sign Language Gloss Token & Definition"
          >
            <span>{part}</span>
            <span className="text-[9px] font-mono opacity-80 uppercase tracking-tighter">🤟 GLOSS</span>
          </span>
        );
      }
      return part;
    });
  };

  const renderClassroomFormattedText = (rawText: string) => {
    if (!rawText) return null;
    return rawText.split(/\r?\n/).map((lineStr, lineIdx) => {
      const trimmed = lineStr.trim();
      if (!trimmed) return <div key={lineIdx} className="h-2" />;
      if (trimmed.startsWith("# ")) return <h2 key={lineIdx} className="text-lg sm:text-xl font-bold text-[var(--primary)] border-b border-[var(--border)] pb-1 mb-2 mt-1">{renderInlineFormatAndKeywords(trimmed.replace(/^#\s+/, ""))}</h2>;
      if (trimmed.startsWith("## ")) return <h3 key={lineIdx} className="text-base sm:text-lg font-bold text-[var(--text)] mb-1.5 mt-1">{renderInlineFormatAndKeywords(trimmed.replace(/^##\s+/, ""))}</h3>;
      if (/^[-*]\s+/.test(trimmed)) return <li key={lineIdx} className="ml-4 list-disc text-sm sm:text-base leading-relaxed pl-1 my-0.5">{renderInlineFormatAndKeywords(trimmed.replace(/^[-*]\s+/, ""))}</li>;
      if (/^\d+\.\s+/.test(trimmed)) return <li key={lineIdx} className="ml-4 list-decimal text-sm sm:text-base leading-relaxed pl-1 my-0.5">{renderInlineFormatAndKeywords(trimmed.replace(/^\d+\.\s+/, ""))}</li>;
      return <p key={lineIdx} className="leading-relaxed break-words overflow-wrap-anywhere whitespace-pre-wrap my-1">{renderInlineFormatAndKeywords(trimmed)}</p>;
    });
  };

  const fontSizeClass = fontSize === "sm" ? "text-sm sm:text-base" : fontSize === "md" ? "text-base sm:text-lg" : fontSize === "lg" ? "text-lg sm:text-xl" : "text-xl sm:text-2xl font-medium";

  // ── Concept card filter ───────────────────────────────────────────────────────
  const filteredCards = (activeSession?.conceptCards || []).filter((c) =>
    !cardSearch || c.concept.toLowerCase().includes(cardSearch.toLowerCase()) || c.definition.toLowerCase().includes(cardSearch.toLowerCase())
  );

  // ── Computed side panel info ──────────────────────────────────────────────────
  const hasCards = (activeSession?.conceptCards || []).length > 0;
  const hasNotes = (activeSession?.smartNotes || []).length > 0;
  const hasVocab = (activeSession?.customVocab || []).length > 0;
  const hasSidePanel = hasCards || hasNotes || hasVocab;

  // ── Loading & Error States ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)] text-[var(--text)]">
        <Loader label="Connecting to live classroom feed..." />
      </div>
    );
  }

  if (!activeSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)] text-[var(--text)] p-4">
        <div className="border border-[var(--border)] rounded-2xl bg-[var(--surface)] p-8 max-w-sm w-full text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto">
            <FontAwesomeIcon icon={faCircleExclamation} className="text-xl" />
          </div>
          <h2 className="text-lg font-bold">Session Not Found</h2>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            The room code <code className="font-mono text-xs">{code}</code> may have expired or is invalid.
          </p>
          <button
            onClick={handleLeaveClass}
            className="w-full py-2.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-black font-semibold rounded-xl text-xs transition-colors cursor-pointer"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  // ── Main Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen pt-12 bg-[var(--background)] text-[var(--text)] transition-colors duration-150">
      <Navbar variant="workspace" contextLabel={activeSession.title} onBack={handleLeaveClass} />

      {isPlaceholder && (
        <div className="bg-yellow-500/10 border-b border-yellow-500/20 text-yellow-500 text-[10px] py-1.5 px-4 text-center font-mono">
          Demo Mode Active
        </div>
      )}

      {/* ── Top Toolbar (Fixed to Top below Navbar) ── */}
      <header className="fixed top-12 left-0 right-0 z-20 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-md px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-sm">
        {/* Left: Live badge + Room code + Duration */}
        <div className="flex flex-wrap items-center justify-between sm:justify-start gap-2.5">
          <div className="flex items-center gap-2">
            {/* Live connection indicator */}
            <span className="flex h-2.5 w-2.5 relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isConnected ? "bg-[var(--primary)]" : "bg-yellow-500"}`} />
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isConnected ? "bg-[var(--primary)]" : "bg-yellow-500"}`} />
            </span>
            <span className="text-xs font-bold text-[var(--text)] uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap">
              <FontAwesomeIcon icon={faRadio} className={`text-[13px] ${isConnected ? "text-[var(--primary)]" : "text-yellow-500"}`} />
              {isConnected ? "Live Classroom Feed" : "Connecting..."}
            </span>
            {/* Session duration */}
            {isConnected && (
              <span className="text-[10px] font-mono text-[var(--text-muted)] border border-[var(--border)] bg-[var(--background)] px-1.5 py-0.5 rounded hidden sm:inline">
                {formatDuration(sessionDuration)}
              </span>
            )}
          </div>

          {/* Room Code */}
          <div className="flex items-center gap-1.5 border border-[var(--border)] rounded-lg bg-[var(--background)] px-2.5 py-1 text-xs max-w-full overflow-x-auto">
            <span className="text-[var(--text-muted)] text-[11px] font-mono whitespace-nowrap">Room:</span>
            <span className="font-mono font-bold text-[var(--text)] text-xs tracking-wider whitespace-nowrap">{activeSession.code}</span>
            <div className="flex items-center gap-1 ml-1 pl-2 border-l border-[var(--border)] shrink-0">
              <button onClick={handleCopyCode} className="px-2 py-0.5 rounded text-[11px] font-medium border border-[var(--border)] hover:border-[var(--primary)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors cursor-pointer flex items-center gap-1" title="Copy Room Code">
                <FontAwesomeIcon icon={copiedCode ? faCheck : faCopy} className={`text-[10px] ${copiedCode ? "text-[var(--primary)]" : ""}`} />
                <span>{copiedCode ? "Copied" : "Copy"}</span>
              </button>
              <button onClick={handleCopyInviteLink} className="px-2 py-0.5 rounded text-[11px] font-medium border border-[var(--border)] hover:border-[var(--primary)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors cursor-pointer flex items-center gap-1" title="Copy Invite Link">
                <FontAwesomeIcon icon={copiedLink ? faCheck : faShareNodes} className={`text-[10px] ${copiedLink ? "text-[var(--primary)]" : ""}`} />
                <span className="hidden sm:inline">{copiedLink ? "Copied" : "Share"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Controls Row */}
        <div className="flex items-center justify-between sm:justify-end gap-2 flex-wrap pt-2 sm:pt-0 border-t sm:border-t-0 border-[var(--border)]/60">
          {/* Mobile tab switcher */}
          {hasSidePanel && (
            <div className="flex lg:hidden border border-[var(--border)] rounded-lg bg-[var(--background)] p-0.5">
              <button onClick={() => setMobileTab("live")} className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors cursor-pointer ${mobileTab === "live" ? "bg-[var(--primary)] text-black font-bold" : "text-[var(--text-muted)]"}`}>
                Live
              </button>
              <button onClick={() => setMobileTab("side")} className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors cursor-pointer ${mobileTab === "side" ? "bg-[var(--primary)] text-black font-bold" : "text-[var(--text-muted)]"}`}>
                Cards & Notes
              </button>
            </div>
          )}

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="h-7 w-7 flex items-center justify-center rounded-md border border-[var(--border)] bg-[var(--background)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--primary)] transition-colors cursor-pointer"
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            <FontAwesomeIcon icon={theme === "dark" ? faSun : faMoon} className="text-xs" />
          </button>

          {/* Accessibility font size */}
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[10px] font-mono uppercase text-[var(--text-muted)] mr-1 hidden md:inline">Text</span>
            {(["sm", "md", "lg", "xl"] as const).map((size, i) => (
              <button
                key={size}
                onClick={() => setFontSize(size)}
                title={`Font size: ${["Small (14px)", "Medium (16px)", "Large (18px)", "Extra Large (22px)"][i]}`}
                className={`px-2 py-1 text-xs border rounded-md font-mono transition-colors cursor-pointer ${fontSize === size ? "bg-[var(--primary)] text-black font-bold border-[var(--primary)]" : "border-[var(--border)] bg-[var(--background)] text-[var(--text-muted)] hover:text-[var(--text)]"}`}
              >
                {["A-", "A", "A+", "A++"][i]}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── Main Layout (offset for fixed header) ── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 pt-24 sm:pt-20 pb-6 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">

        {/* ── Live Classroom Section ── */}
        <section
          className={`flex flex-col space-y-4 overflow-hidden transition-all ${hasSidePanel ? "lg:col-span-7" : "lg:col-span-12"} ${mobileTab === "live" ? "block" : "hidden lg:flex"}`}
        >
          {/* ── Active Classroom Teaching Banner ── */}
          <div className="border border-[var(--border)] rounded-2xl bg-[var(--surface)] p-4 sm:p-5 text-left shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center font-bold text-base shrink-0 border border-[var(--primary)]/20">
                  <FontAwesomeIcon icon={faGraduationCap} />
                </div>
                <div>
                  <h1 className="text-sm sm:text-base font-bold text-[var(--text)] leading-tight flex items-center gap-2">
                    <span>{activeSession.title || "Live Lecture Session"}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-green-500/10 text-green-500 font-semibold border border-green-500/20">
                      Live Stream
                    </span>
                  </h1>
                  <p className="text-[11px] text-[var(--text-muted)] font-mono flex items-center gap-2 mt-0.5">
                    <span>Subject: General Science</span>
                    <span>•</span>
                    <span>Lecturer: Course Instructor</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Classroom Whiteboard Anchor Focus */}
            <div className="bg-[var(--background)] border border-[var(--primary)]/30 rounded-xl p-3.5 flex items-start justify-between gap-3 shadow-2xs">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--primary)] font-mono uppercase tracking-wider">
                  <FontAwesomeIcon icon={faThumbtack} className="text-[11px]" /> Active Whiteboard Focus
                </div>
                <p className="text-xs sm:text-sm font-semibold text-[var(--text)] leading-relaxed">
                  {renderClassroomFormattedText(
                    activeSession.transcript?.length > 0
                      ? activeSession.transcript[activeSession.transcript.length - 1].text
                      : "Welcome to today's classroom lecture session. Captions will stream live here as your lecturer speaks."
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* ── Main Caption Container ── */}
          <div className="border border-[var(--border)] rounded-2xl bg-[var(--surface)] flex flex-col min-h-[420px] sm:min-h-[540px] shadow-sm overflow-hidden">
            {/* Caption feed toolbar */}
            <div className="border-b border-[var(--border)] px-4 sm:px-5 py-3 bg-[var(--background)] flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <FontAwesomeIcon icon={faBookOpen} className="text-sm text-[var(--primary)]" />
                <span className="text-xs font-bold text-[var(--text)]">Classroom Feed Stream</span>
                <span className="text-[10px] font-mono bg-green-500/10 text-green-500 border border-green-500/20 px-2 py-0.5 rounded font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" /> Live
                </span>
              </div>
              <div className="flex items-center gap-2">
                {/* Continuous / Cards view toggle */}
                <div className="flex items-center border border-[var(--border)] rounded-md bg-[var(--surface)] p-0.5 text-xs">
                  <button
                    onClick={() => setViewMode("continuous")}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 transition-colors cursor-pointer ${viewMode === "continuous" ? "bg-[var(--primary)] text-black font-bold" : "text-[var(--text-muted)] hover:text-[var(--text)]"}`}
                    title="Continuous Reader View"
                  >
                    <FontAwesomeIcon icon={faAlignLeft} className="text-[9px]" />
                    <span>Continuous</span>
                  </button>
                  <button
                    onClick={() => setViewMode("cards")}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 transition-colors cursor-pointer ${viewMode === "cards" ? "bg-[var(--primary)] text-black font-bold" : "text-[var(--text-muted)] hover:text-[var(--text)]"}`}
                    title="Pedagogical Cards View"
                  >
                    <FontAwesomeIcon icon={faGrip} className="text-[9px]" />
                    <span>Cards</span>
                  </button>
                </div>
                <button
                  onClick={handleExportNotes}
                  className="h-7 px-2.5 bg-[var(--background)] hover:bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] rounded-md text-[11px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Export notes as Markdown (.md)"
                >
                  <FontAwesomeIcon icon={faDownload} className="text-[10px] text-[var(--primary)]" />
                  <span>Export Notes</span>
                </button>
              </div>
            </div>

            {/* Transcript scroll area */}
            <div
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="flex-1 p-3 sm:p-6 overflow-y-auto space-y-4 max-h-[60vh] sm:max-h-[65vh]"
            >
              {activeSession.transcript?.length === 0 && !interimTranscript ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-[var(--text-muted)] py-20 space-y-3">
                  <FontAwesomeIcon icon={faWifi} className="text-3xl animate-pulse text-[var(--primary)]" />
                  <p className="font-bold text-sm text-[var(--text)]">Listening for Live Classroom Stream...</p>
                  <p className="text-xs max-w-xs leading-relaxed">
                    As your lecturer speaks, captions will stream on your screen in real time with interactive sign glosses.
                  </p>
                  <p className="text-[10px] font-mono text-[var(--text-muted)] border border-[var(--border)] px-3 py-1 rounded-full bg-[var(--surface)]">
                    Room: {activeSession.code} · {activeSession.date}
                  </p>
                </div>
              ) : viewMode === "continuous" ? (
                /* ── CONTINUOUS CLASSROOM READER ── */
                <div className="p-5 sm:p-8 rounded-2xl border border-[var(--border)] bg-[var(--background)] space-y-5 text-left shadow-xs">
                  {activeSession.transcript.map((line, idx) => {
                    const isBookmarked = bookmarkedLines.has(line.id);
                    const category = getTeachingCategory(line.text);
                    const time = new Date(line.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

                    return (
                      <div
                        key={line.id}
                        className={`group relative pl-4 pr-3 py-3 rounded-xl transition-all border-l-4 ${
                          isBookmarked
                            ? "bg-[var(--primary)]/10 border-[var(--primary)]"
                            : "hover:bg-[var(--surface)]/80 border-transparent hover:border-[var(--primary)]/40"
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-muted)] mb-1.5 select-none flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border flex items-center gap-1 ${category.badgeClass}`}>
                              <FontAwesomeIcon icon={category.icon} className="text-[9px]" />
                              {category.label}
                            </span>
                            <span className="font-bold text-[var(--text-muted)]">
                              [{time}] Block #{idx + 1}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleExplainSimpler(line.text)}
                              className="text-[10px] font-mono px-2 py-0.5 rounded border border-[var(--primary)]/30 text-[var(--primary)] hover:bg-[var(--primary)]/10 transition-colors cursor-pointer flex items-center gap-1"
                              title="Ask AI for a 1-sentence simple breakdown"
                            >
                              <FontAwesomeIcon icon={faRobot} className="text-[9px]" />
                              <span>AI Explain</span>
                            </button>

                            <button
                              onClick={() => speakText(line.text)}
                              className="text-[10px] font-mono px-2 py-0.5 rounded border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface)] transition-colors cursor-pointer flex items-center gap-1"
                              title="Read paragraph aloud"
                            >
                              <FontAwesomeIcon icon={faVolumeHigh} className="text-[9px]" />
                            </button>

                            <button
                              onClick={() => toggleBookmarkLine(line.id)}
                              className={`text-[10px] px-2 py-0.5 rounded cursor-pointer transition-colors ${
                                isBookmarked ? "text-[var(--primary)] font-bold bg-[var(--primary)]/10 border border-[var(--primary)]/20" : "text-[var(--text-muted)] hover:text-[var(--text)] border border-transparent hover:border-[var(--border)]"
                              }`}
                              title="Bookmark paragraph for review"
                            >
                              <FontAwesomeIcon icon={faBookmark} className="mr-1 text-[9px]" />
                              {isBookmarked ? "Saved" : "Save"}
                            </button>
                          </div>
                        </div>

                        <div className={`leading-relaxed text-[var(--text)] font-sans break-words overflow-wrap-anywhere whitespace-pre-wrap ${fontSizeClass}`}>
                          {renderClassroomFormattedText(line.text)}
                        </div>
                      </div>
                    );
                  })}

                  {interimTranscript && (
                    <div className="group relative pl-4 pr-3 py-3 rounded-xl border-l-4 border-[var(--primary)] bg-[var(--primary)]/5 transition-all animate-fade-in space-y-1">
                      <div className="flex items-center gap-1.5 text-[10px] font-mono text-[var(--primary)] select-none font-bold">
                        <span className="w-2 h-2 rounded-full bg-[var(--primary)] animate-ping inline-block" />
                        Live Speaking...
                      </div>
                      <div className={`leading-relaxed text-[var(--text)] font-sans break-words overflow-wrap-anywhere whitespace-pre-wrap italic opacity-90 ${fontSizeClass}`}>
                        {renderClassroomFormattedText(interimTranscript)}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* ── PARAGRAPH CLASSROOM CARDS VIEW ── */
                <div className="space-y-3.5">
                  {activeSession.transcript.map((line, idx) => {
                    const isBookmarked = bookmarkedLines.has(line.id);
                    const category = getTeachingCategory(line.text);
                    const time = new Date(line.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

                    return (
                      <div
                        key={line.id}
                        className={`p-4 sm:p-5 rounded-2xl border transition-all animate-fade-in text-left space-y-3 group shadow-2xs ${
                          isBookmarked ? "border-[var(--primary)] bg-[var(--primary)]/5 ring-1 ring-[var(--primary)]/20" : "border-[var(--border)] bg-[var(--background)] hover:border-[var(--text-muted)]/40"
                        }`}
                      >
                        <div className="flex justify-between items-center border-b border-[var(--border)]/60 pb-2 flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border flex items-center gap-1 ${category.badgeClass}`}>
                              <FontAwesomeIcon icon={category.icon} className="text-[9px]" />
                              {category.label}
                            </span>
                            <span className="text-[10px] font-mono text-[var(--text-muted)]">
                              Block #{idx + 1} · {time}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleExplainSimpler(line.text)}
                              className="text-[10px] font-mono px-2 py-0.5 rounded border border-[var(--primary)]/30 text-[var(--primary)] hover:bg-[var(--primary)]/10 transition-colors cursor-pointer flex items-center gap-1"
                              title="Ask AI for a 1-sentence simple breakdown"
                            >
                              <FontAwesomeIcon icon={faRobot} className="text-[9px]" />
                              <span>AI Explain</span>
                            </button>

                            <button
                              onClick={() => speakText(line.text)}
                              className="text-[10px] font-mono px-2 py-0.5 rounded border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface)] transition-colors cursor-pointer flex items-center gap-1"
                              title="Read paragraph aloud"
                            >
                              <FontAwesomeIcon icon={faVolumeHigh} className="text-[9px]" />
                            </button>

                            <button
                              onClick={() => toggleBookmarkLine(line.id)}
                              className={`text-[11px] px-2 py-0.5 rounded-md transition-colors cursor-pointer opacity-80 hover:opacity-100 ${
                                isBookmarked ? "text-[var(--primary)] font-bold bg-[var(--primary)]/10 border border-[var(--primary)]/20" : "text-[var(--text-muted)] hover:text-[var(--text)] border border-[var(--border)]"
                              }`}
                              title="Bookmark paragraph"
                            >
                              <FontAwesomeIcon icon={faBookmark} className="text-[10px] mr-1" />
                              {isBookmarked ? "Saved" : "Save"}
                            </button>
                          </div>
                        </div>

                        <div className={`leading-relaxed text-[var(--text)] font-sans break-words overflow-wrap-anywhere whitespace-pre-wrap ${fontSizeClass}`}>
                          {renderClassroomFormattedText(line.text)}
                        </div>
                      </div>
                    );
                  })}

                  {interimTranscript && (
                    <div className="p-4 sm:p-5 rounded-2xl border-2 border-dashed border-[var(--primary)] bg-[var(--primary)]/5 animate-fade-in shadow-xs">
                      <div className="flex items-center gap-1.5 text-[10px] font-mono text-[var(--primary)] pb-2 border-b border-[var(--primary)]/20 mb-3 font-bold">
                        <span className="w-2 h-2 rounded-full bg-[var(--primary)] animate-ping inline-block" />
                        Live Speaking Draft...
                      </div>
                      <div className={`leading-relaxed text-[var(--text)] font-sans break-words overflow-wrap-anywhere whitespace-pre-wrap italic opacity-90 ${fontSizeClass}`}>
                        {renderClassroomFormattedText(interimTranscript)}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div ref={scrollEndRef} />
            </div>

          {/* ── Reactions + Jump-to-live footer ── */}
          <div className="p-3 bg-[var(--background)] border-t border-[var(--border)] flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono uppercase text-[var(--text-muted)] mr-1 hidden sm:inline">Signal Lecturer</span>
              <button
                onClick={() => handleSendReaction("Question", "✋")}
                disabled={reactionCooldown}
                className={`px-2.5 py-1 text-xs border border-[var(--border)] rounded-lg font-medium transition-colors flex items-center gap-1 text-[var(--text)] ${reactionCooldown ? "opacity-40 cursor-not-allowed" : "bg-[var(--surface)] hover:border-[var(--primary)] cursor-pointer"}`}
                title="Raise hand to signal a question to the lecturer"
              >
                <FontAwesomeIcon icon={faHand} className="text-amber-400 text-xs" />
                <span>Question</span>
              </button>
              <button
                onClick={() => handleSendReaction("Got it!", "💡")}
                disabled={reactionCooldown}
                className={`px-2.5 py-1 text-xs border border-[var(--border)] rounded-lg font-medium transition-colors flex items-center gap-1 text-[var(--text)] ${reactionCooldown ? "opacity-40 cursor-not-allowed" : "bg-[var(--surface)] hover:border-[var(--primary)] cursor-pointer"}`}
                title="Signal that you understood this section"
              >
                <FontAwesomeIcon icon={faLightbulb} className="text-amber-300 text-xs" />
                <span>Got it!</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {reactionSent && (
                <span className="text-xs font-semibold text-[var(--primary)] flex items-center gap-1 animate-fade-in">
                  <FontAwesomeIcon icon={faCheckCircle} className="text-[11px]" />
                  {reactionSent} sent
                </span>
              )}
              {reactionCooldown && !reactionSent && (
                <span className="text-[10px] font-mono text-[var(--text-muted)]">Next reaction in 8s</span>
              )}
              {!isAutoScroll && activeSession.transcript?.length > 0 && (
                <button
                  onClick={handleResumeAutoScroll}
                  className="bg-[var(--primary)] text-black hover:bg-[var(--primary-hover)] px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                >
                  <FontAwesomeIcon icon={faArrowDown} className="text-xs" />
                  <span>Jump to Live</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

        {/* ── Side Panel: AI Concept Cards, Smart Notes, Vocabulary ── */}
        {hasSidePanel && (
          <section
            className={`lg:col-span-5 border border-[var(--border)] rounded-2xl bg-[var(--surface)] overflow-hidden shadow-sm flex flex-col min-h-[400px] sm:min-h-[580px] ${mobileTab === "side" ? "block" : "hidden lg:flex"}`}
          >
            {/* Side panel tab bar */}
            <div className="border-b border-[var(--border)] bg-[var(--background)] flex items-center">
              {hasCards && (
                <button
                  onClick={() => setSideTab("cards")}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-3 text-[11px] font-semibold border-b-2 transition-colors cursor-pointer ${sideTab === "cards" ? "border-[var(--primary)] text-[var(--primary)]" : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"}`}
                >
                  <FontAwesomeIcon icon={faLightbulb} className="text-[11px]" />
                  <span>AI Concepts</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${sideTab === "cards" ? "bg-[var(--primary)] text-black" : "bg-[var(--border)] text-[var(--text-muted)]"}`}>
                    {activeSession.conceptCards.length}
                  </span>
                </button>
              )}
              {hasNotes && (
                <button
                  onClick={() => setSideTab("notes")}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-3 text-[11px] font-semibold border-b-2 transition-colors cursor-pointer ${sideTab === "notes" ? "border-[var(--primary)] text-[var(--primary)]" : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"}`}
                >
                  <FontAwesomeIcon icon={faListCheck} className="text-[11px]" />
                  <span>Smart Notes</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${sideTab === "notes" ? "bg-[var(--primary)] text-black" : "bg-[var(--border)] text-[var(--text-muted)]"}`}>
                    {(activeSession.smartNotes || []).length}
                  </span>
                </button>
              )}
              {hasVocab && (
                <button
                  onClick={() => setSideTab("vocab")}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-3 text-[11px] font-semibold border-b-2 transition-colors cursor-pointer ${sideTab === "vocab" ? "border-[var(--primary)] text-[var(--primary)]" : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"}`}
                >
                  <FontAwesomeIcon icon={faFileLines} className="text-[11px]" />
                  <span>Keyterms</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${sideTab === "vocab" ? "bg-[var(--primary)] text-black" : "bg-[var(--border)] text-[var(--text-muted)]"}`}>
                    {activeSession.customVocab.length}
                  </span>
                </button>
              )}
            </div>

            {/* ── AI Concept Cards tab ── */}
            {sideTab === "cards" && hasCards && (
              <div className="flex flex-col flex-1 overflow-hidden">
                {/* Search */}
                <div className="px-4 py-2.5 border-b border-[var(--border)] bg-[var(--background)]">
                  <div className="relative">
                    <FontAwesomeIcon icon={faMagnifyingGlass} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-[11px]" />
                    <input
                      type="text"
                      value={cardSearch}
                      onChange={(e) => setCardSearch(e.target.value)}
                      placeholder="Search concepts..."
                      className="w-full pl-7 pr-3 py-1.5 text-xs bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] transition-colors"
                    />
                  </div>
                </div>
                <div className="flex-1 p-4 overflow-y-auto space-y-3 max-h-[62vh]">
                  {filteredCards.length === 0 ? (
                    <div className="text-center py-8 text-[var(--text-muted)] text-xs">
                      <FontAwesomeIcon icon={faMagnifyingGlass} className="text-xl mb-2 opacity-40" />
                      <p>No concepts match "{cardSearch}"</p>
                    </div>
                  ) : (
                    filteredCards.map((card) => (
                      <div key={card.id} className="p-4 border border-[var(--border)] rounded-xl bg-[var(--background)] space-y-2 text-left group animate-fade-in hover:border-[var(--primary)]/40 transition-all">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <FontAwesomeIcon icon={faCircleDot} className="text-[var(--primary)] text-[9px] mt-0.5 shrink-0" />
                            <h4 className="font-bold text-xs text-[var(--primary)] font-mono">{card.concept}</h4>
                          </div>
                          <button
                            onClick={() => speakText(`${card.concept}. ${card.definition}`)}
                            className="p-1 text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors cursor-pointer text-xs shrink-0"
                            title="Listen to definition"
                          >
                            <FontAwesomeIcon icon={faVolumeHigh} />
                          </button>
                        </div>
                        <p className="text-xs text-[var(--text)] leading-relaxed pl-4">{card.definition}</p>
                        {card.details && (
                          <p className="text-[10px] text-[var(--text-muted)] leading-relaxed italic border-t border-[var(--border)] pt-1.5 mt-1.5 pl-4">{card.details}</p>
                        )}
                        <div className="pl-4">
                          <span className="text-[9px] font-mono text-[var(--text-muted)]">
                            {new Date(card.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* ── Smart Notes tab ── */}
            {sideTab === "notes" && hasNotes && (
              <div className="flex-1 p-4 overflow-y-auto space-y-2.5 max-h-[68vh]">
                <p className="text-[10px] font-mono text-[var(--text-muted)] mb-3 flex items-center gap-1.5">
                  <FontAwesomeIcon icon={faListCheck} className="text-[var(--primary)]" />
                  AI-generated key points from this lecture
                </p>
                {(activeSession.smartNotes || []).map((note, i) => (
                  <div key={i} className="flex items-start gap-2.5 p-3 border border-[var(--border)] rounded-xl bg-[var(--background)] hover:border-[var(--primary)]/30 transition-all animate-fade-in">
                    <span className="w-5 h-5 rounded-full bg-[var(--primary)]/15 text-[var(--primary)] text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                    <p className="text-xs text-[var(--text)] leading-relaxed">{note}</p>
                  </div>
                ))}
              </div>
            )}

            {/* ── Course Keyterms tab ── */}
            {sideTab === "vocab" && hasVocab && (
              <div className="flex-1 p-4 overflow-y-auto space-y-3 max-h-[68vh]">
                {activeSession.customVocab.map((term, i) => (
                  <div key={i} className="p-4 border border-[var(--border)] rounded-xl bg-[var(--background)] space-y-1.5 text-left group hover:border-[var(--primary)]/30 transition-all">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-xs text-[var(--primary)] font-mono">{term.keyword}</h4>
                      <button
                        onClick={() => speakText(`${term.keyword}. ${term.definition}`)}
                        className="p-1 text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors cursor-pointer text-xs"
                        title="Listen to definition"
                      >
                        <FontAwesomeIcon icon={faVolumeHigh} />
                      </button>
                    </div>
                    <p className="text-xs text-[var(--text)] leading-relaxed">{term.definition}</p>
                    {term.details && (
                      <p className="text-[10px] text-[var(--text-muted)] leading-relaxed italic border-t border-[var(--border)] pt-1.5 mt-1.5">{term.details}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Empty state when no side panel data yet */}
            {((sideTab === "cards" && !hasCards) || (sideTab === "notes" && !hasNotes) || (sideTab === "vocab" && !hasVocab)) && (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-[var(--text-muted)] space-y-2">
                <FontAwesomeIcon icon={faExclamationTriangle} className="text-2xl opacity-30" />
                <p className="text-xs">Nothing here yet — this panel will fill as the lecture progresses.</p>
              </div>
            )}
          </section>
        )}
      </main>
      {/* ── Sign Language Gloss Inspector Modal ────────────────────────────── */}
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

      {/* ── AI Simplifier Modal ──────────────────────────────────────────────── */}
      {aiExplainText && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="border border-[var(--border)] rounded-2xl bg-[var(--surface)] p-6 max-w-md w-full space-y-4 shadow-xl text-left relative">
            <button
              onClick={() => {
                setAiExplainText(null);
                setAiExplainResult(null);
              }}
              className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-[var(--text)] text-sm cursor-pointer"
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[var(--primary)]/15 text-[var(--primary)] border border-[var(--primary)]/30 uppercase tracking-wider flex items-center gap-1">
                <FontAwesomeIcon icon={faWandMagicSparkles} className="text-[10px]" /> AI Classroom Tutor
              </span>
            </div>

            <div className="space-y-1">
              <h3 className="text-sm font-bold text-[var(--text)]">Original Lecture Sentence:</h3>
              <p className="text-xs text-[var(--text-muted)] italic bg-[var(--background)] p-2.5 rounded-lg border border-[var(--border)] leading-relaxed">
                "{aiExplainText}"
              </p>
            </div>

            <div className="border-t border-[var(--border)] pt-3 space-y-2">
              <h4 className="text-xs font-bold text-[var(--primary)] uppercase tracking-wider font-mono text-[10px]">
                Simplified Breakdown (ELI5):
              </h4>

              {aiExplainLoading ? (
                <div className="flex items-center justify-center py-6 gap-2 text-xs text-[var(--text-muted)]">
                  <span className="w-4 h-4 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
                  Generating simple explanation...
                </div>
              ) : (
                <div className="p-3.5 bg-[var(--primary)]/10 border border-[var(--primary)]/30 rounded-xl space-y-2">
                  <p className="text-xs sm:text-sm text-[var(--text)] font-semibold leading-relaxed">
                    {aiExplainResult}
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={() => {
                setAiExplainText(null);
                setAiExplainResult(null);
              }}
              className="w-full py-2.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-black font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              Got it, thanks!
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
