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
} from "@fortawesome/free-solid-svg-icons";
import { Navbar } from "./Navbar";
import { Loader } from "./Loader";

export const StudentWorkspace: React.FC = () => {
  const { code } = useParams();
  const navigate = useNavigate();

  const {
    activeSession,
    joinSession,
    fontSize,
    setFontSize,
    clearActiveSession,
    isPlaceholder,
  } = useSignBridge();

  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [loading, setLoading] = useState(true);
  const [mobileTab, setMobileTab] = useState<"live" | "vocab">("live");
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [bookmarkedLines, setBookmarkedLines] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"continuous" | "cards">("continuous");

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollEndRef = useRef<HTMLDivElement>(null);

  const speakText = (text: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Load session by room code from URL params
  useEffect(() => {
    let isMounted = true;
    if (code) {
      setLoading(true);
      joinSession(code).then((result) => {
        if (!isMounted) return;
        if (!result.success) {
          console.warn("Failed to join session:", result.error);
        }
        setLoading(false);
      });
    } else {
      setLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [code]);

  // Handle user scroll detection for auto-scroll override
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 60;
    if (isAutoScroll !== isAtBottom) {
      setIsAutoScroll(isAtBottom);
    }
  };

  // Auto-scroll when new transcripts arrive
  useEffect(() => {
    if (isAutoScroll && scrollEndRef.current) {
      scrollEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeSession?.transcript, isAutoScroll]);

  const handleResumeAutoScroll = () => {
    setIsAutoScroll(true);
    scrollEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleLeaveClass = () => {
    clearActiveSession();
    navigate("/student-entry");
  };

  const handleCopyCode = () => {
    if (!activeSession?.code) return;
    navigator.clipboard.writeText(activeSession.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyInviteLink = () => {
    const inviteUrl = window.location.href;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const toggleBookmarkLine = (lineId: string) => {
    setBookmarkedLines((prev) => {
      const next = new Set(prev);
      if (next.has(lineId)) next.delete(lineId);
      else next.add(lineId);
      return next;
    });
  };

  const [studentReaction, setStudentReaction] = useState<string | null>(null);

  const handleSendReaction = (label: string) => {
    setStudentReaction(label);
    setTimeout(() => setStudentReaction(null), 2500);
  };

  const handleExportNotes = () => {
    if (!activeSession) return;
    let mdContent = `# Lecture Notes: ${activeSession.title || "Class Session"}\n`;
    mdContent += `Room Code: ${activeSession.code} | Exported: ${new Date().toLocaleDateString()}\n\n`;

    mdContent += `## Speech Transcript\n\n`;
    (activeSession.transcript || []).forEach((line) => {
      const time = new Date(line.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      mdContent += `**[${time}]** ${line.text}\n\n`;
    });

    if (activeSession.customVocab?.length > 0) {
      mdContent += `## Course Keyterms & Definitions\n\n`;
      activeSession.customVocab.forEach((term) => {
        mdContent += `### ${term.keyword}\n`;
        mdContent += `${term.definition}\n`;
        if (term.details) mdContent += `*Context: ${term.details}*\n`;
        mdContent += `\n`;
      });
    }

    const blob = new Blob([mdContent], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${(activeSession.title || "class_notes").toLowerCase().replace(/\s+/g, "_")}_notes.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  /** Structured Classroom Text & Markdown Formatter */
  const renderClassroomFormattedText = (rawText: string) => {
    if (!rawText) return null;

    const lines = rawText.split(/\r?\n/);

    return lines.map((lineStr, lineIdx) => {
      const trimmed = lineStr.trim();
      if (!trimmed) return <div key={lineIdx} className="h-2" />;

      // Header 1 (# Title)
      if (trimmed.startsWith("# ")) {
        return (
          <h2 key={lineIdx} className="text-lg sm:text-xl font-bold text-[var(--primary)] border-b border-[var(--border)] pb-1 mb-2 mt-1">
            {renderInlineFormatAndKeywords(trimmed.replace(/^#\s+/, ""))}
          </h2>
        );
      }

      // Header 2 (## Section)
      if (trimmed.startsWith("## ")) {
        return (
          <h3 key={lineIdx} className="text-base sm:text-lg font-bold text-[var(--text)] mb-1.5 mt-1">
            {renderInlineFormatAndKeywords(trimmed.replace(/^##\s+/, ""))}
          </h3>
        );
      }

      // Bullet List (- item or * item)
      if (/^[-*]\s+/.test(trimmed)) {
        return (
          <li key={lineIdx} className="ml-4 list-disc text-sm sm:text-base leading-relaxed pl-1 my-0.5">
            {renderInlineFormatAndKeywords(trimmed.replace(/^[-*]\s+/, ""))}
          </li>
        );
      }

      // Numbered List (1. item)
      if (/^\d+\.\s+/.test(trimmed)) {
        return (
          <li key={lineIdx} className="ml-4 list-decimal text-sm sm:text-base leading-relaxed pl-1 my-0.5">
            {renderInlineFormatAndKeywords(trimmed.replace(/^\d+\.\s+/, ""))}
          </li>
        );
      }

      // Standard Paragraph
      return (
        <p key={lineIdx} className="leading-relaxed break-words overflow-wrap-anywhere whitespace-pre-wrap my-1">
          {renderInlineFormatAndKeywords(trimmed)}
        </p>
      );
    });
  };

  /** Helper to render inline bold, italics, and course keyterm badges */
  const renderInlineFormatAndKeywords = (text: string) => {
    if (!text) return null;

    const keywords = (activeSession?.customVocab || [])
      .map((v) => v.keyword)
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);

    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);

    return parts.map((part, pIdx) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        const inner = part.slice(2, -2);
        return <strong key={pIdx} className="font-bold text-[var(--text)]">{renderKeywordsOnly(inner, keywords)}</strong>;
      }
      if (part.startsWith("*") && part.endsWith("*")) {
        const inner = part.slice(1, -1);
        return <em key={pIdx} className="italic text-[var(--text)]">{renderKeywordsOnly(inner, keywords)}</em>;
      }
      return <React.Fragment key={pIdx}>{renderKeywordsOnly(part, keywords)}</React.Fragment>;
    });
  };

  const renderKeywordsOnly = (text: string, keywords: string[]) => {
    if (keywords.length === 0) return text;
    const pattern = new RegExp(`\\b(${keywords.map((k) => k.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")).join("|")})\\b`, "gi");
    const parts = text.split(pattern);

    return parts.map((part, i) => {
      const matched = keywords.find((k) => k.toLowerCase() === part.toLowerCase());
      if (matched) {
        return (
          <mark
            key={i}
            className="bg-[var(--primary)]/20 border-b border-[var(--primary)] text-[var(--primary)] font-bold px-1 py-0.5 rounded text-xs sm:text-sm font-mono cursor-help transition-colors"
            title={`Course Glossary: ${matched}`}
          >
            {part}
          </mark>
        );
      }
      return part;
    });
  };

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
            Return to Join Screen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-12 bg-[var(--background)] text-[var(--text)] transition-colors duration-150">
      {/* Navbar Header */}
      <Navbar
        variant="workspace"
        contextLabel={activeSession.title}
        onBack={handleLeaveClass}
      />

      {/* Demo Alert if bypassed */}
      {isPlaceholder && (
        <div className="bg-yellow-500/10 border-b border-yellow-500/20 text-yellow-500 text-[10px] py-1.5 px-4 text-center font-mono">
          Demo Mode Active
        </div>
      )}

      {/* Top Controls Toolbar */}
      <header className="border-b border-[var(--border)] bg-[var(--surface)] px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Live Broadcast Badge & Room Code */}
        <div className="flex flex-wrap items-center justify-between sm:justify-start gap-2.5">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--primary)] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[var(--primary)]"></span>
            </span>
            <span className="text-xs font-bold text-[var(--text)] uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap">
              <FontAwesomeIcon icon={faRadio} className="text-[13px] text-[var(--primary)]" />
              Live Classroom Feed
            </span>
          </div>

          {/* Room Code Badge with Copy Options */}
          <div className="flex items-center gap-1.5 border border-[var(--border)] rounded-lg bg-[var(--background)] px-2.5 py-1 text-xs max-w-full overflow-x-auto">
            <span className="text-[var(--text-muted)] text-[11px] font-mono whitespace-nowrap">Room Code:</span>
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
                onClick={handleCopyInviteLink}
                className="px-2 py-0.5 rounded text-[11px] font-medium border border-[var(--border)] hover:border-[var(--primary)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors cursor-pointer flex items-center gap-1"
                title="Copy Invite Link"
              >
                <FontAwesomeIcon icon={copiedLink ? faCheck : faShareNodes} className={`text-[10px] ${copiedLink ? "text-[var(--primary)]" : ""}`} />
                <span>{copiedLink ? "Link Copied" : "Copy Link"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Controls Row on Mobile: Mobile View Switcher & Text Size Adjuster */}
        <div className="flex items-center justify-between sm:justify-end gap-3 flex-wrap pt-2 sm:pt-0 border-t sm:border-t-0 border-[var(--border)]/60">
          {/* Mobile View Toggle */}
          <div className="flex lg:hidden border border-[var(--border)] rounded-lg bg-[var(--background)] p-0.5">
            <button
              onClick={() => setMobileTab("live")}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors cursor-pointer ${
                mobileTab === "live"
                  ? "bg-[var(--primary)] text-black font-bold"
                  : "text-[var(--text-muted)]"
              }`}
            >
              Live Stream
            </button>
            {activeSession.customVocab?.length > 0 && (
              <button
                onClick={() => setMobileTab("vocab")}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors cursor-pointer ${
                  mobileTab === "vocab"
                    ? "bg-[var(--primary)] text-black font-bold"
                    : "text-[var(--text-muted)]"
                }`}
              >
                Vocabulary ({activeSession.customVocab.length})
              </button>
            )}
          </div>

          {/* Accessibility Font Size Controls */}
          <div className="flex items-center gap-1 shrink-0 ml-auto sm:ml-0">
            <span className="text-[10px] font-mono uppercase text-[var(--text-muted)] mr-1 hidden md:inline">
              Text Size
            </span>
            <button
              onClick={() => setFontSize("sm")}
              className={`px-2 py-1 text-xs border rounded-md font-mono transition-colors cursor-pointer ${
                fontSize === "sm"
                  ? "bg-[var(--primary)] text-black font-bold border-[var(--primary)]"
                  : "border-[var(--border)] bg-[var(--background)] text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              A-
            </button>
            <button
              onClick={() => setFontSize("md")}
              className={`px-2 py-1 text-xs border rounded-md font-mono transition-colors cursor-pointer ${
                fontSize === "md"
                  ? "bg-[var(--primary)] text-black font-bold border-[var(--primary)]"
                  : "border-[var(--border)] bg-[var(--background)] text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              A
            </button>
            <button
              onClick={() => setFontSize("lg")}
              className={`px-2 py-1 text-xs border rounded-md font-mono transition-colors cursor-pointer ${
                fontSize === "lg"
                  ? "bg-[var(--primary)] text-black font-bold border-[var(--primary)]"
                  : "border-[var(--border)] bg-[var(--background)] text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              A+
            </button>
            <button
              onClick={() => setFontSize("xl")}
              className={`px-2 py-1 text-xs border rounded-md font-mono transition-colors cursor-pointer ${
                fontSize === "xl"
                  ? "bg-[var(--primary)] text-black font-bold border-[var(--primary)]"
                  : "border-[var(--border)] bg-[var(--background)] text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              A++
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-6 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
        {/* Live AssemblyAI Caption Feed */}
        <section
          className={`flex flex-col border border-[var(--border)] rounded-2xl bg-[var(--surface)] overflow-hidden min-h-[420px] sm:min-h-[580px] shadow-sm transition-all ${
            activeSession.customVocab?.length > 0 ? "lg:col-span-8" : "lg:col-span-12"
          } ${mobileTab === "live" ? "block" : "hidden lg:flex"}`}
        >
          {/* Feed Sub-Header */}
          <div className="border-b border-[var(--border)] px-4 sm:px-5 py-3 bg-[var(--background)] flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <FontAwesomeIcon icon={faBookOpen} className="text-sm text-[var(--primary)]" />
              <span className="text-xs font-bold text-[var(--text)]">
                Live Speech Transcript Stream
              </span>
              <span className="text-[10px] font-mono bg-green-500/10 text-green-500 border border-green-500/20 px-2 py-0.5 rounded font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block"></span> Live Broadcast
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* View Mode Toggle: Continuous Stream vs Cards */}
              <div className="flex items-center border border-[var(--border)] rounded-md bg-[var(--surface)] p-0.5 text-xs">
                <button
                  onClick={() => setViewMode("continuous")}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                    viewMode === "continuous"
                      ? "bg-[var(--primary)] text-black font-bold"
                      : "text-[var(--text-muted)] hover:text-[var(--text)]"
                  }`}
                  title="Continuous Stream Reader View"
                >
                  <FontAwesomeIcon icon={faAlignLeft} className="text-[9px]" />
                  <span>Continuous</span>
                </button>
                <button
                  onClick={() => setViewMode("cards")}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                    viewMode === "cards"
                      ? "bg-[var(--primary)] text-black font-bold"
                      : "text-[var(--text-muted)] hover:text-[var(--text)]"
                  }`}
                  title="Paragraph Cards View"
                >
                  <FontAwesomeIcon icon={faGrip} className="text-[9px]" />
                  <span>Cards</span>
                </button>
              </div>

              <button
                onClick={handleExportNotes}
                className="h-7 px-2.5 bg-[var(--background)] hover:bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] rounded-md text-[11px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer ml-1"
                title="Export formatted notes as Markdown (.md)"
              >
                <FontAwesomeIcon icon={faDownload} className="text-[10px] text-[var(--primary)]" />
                <span>Export Notes</span>
              </button>
            </div>
          </div>

          {/* Transcript Scroll Container */}
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 p-3 sm:p-6 overflow-y-auto space-y-4 max-h-[60vh] sm:max-h-[65vh]"
          >
            {activeSession.transcript?.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-[var(--text-muted)] py-20 space-y-3">
                <FontAwesomeIcon icon={faWifi} className="text-3xl animate-pulse text-[var(--primary)]" />
                <p className="font-bold text-sm text-[var(--text)]">Listening for Live Speech Stream...</p>
                <p className="text-xs max-w-xs leading-relaxed">
                  As your lecturer speaks, continuous captions will stream on your screen in a smooth, seamless reader format.
                </p>
              </div>
            ) : viewMode === "continuous" ? (
              /* CONTINUOUS FLOW READER CANVAS */
              <div className="p-5 sm:p-8 rounded-2xl border border-[var(--border)] bg-[var(--background)] space-y-5 text-left shadow-xs">
                {activeSession.transcript.map((line, idx) => {
                  const isBookmarked = bookmarkedLines.has(line.id);
                  const time = new Date(line.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <div
                      key={line.id}
                      className={`group relative pl-3 pr-2 py-2.5 rounded-xl transition-all ${
                        isBookmarked
                          ? "bg-[var(--primary)]/10 border-l-3 border-[var(--primary)]"
                          : "hover:bg-[var(--surface)]/70 border-l-2 border-transparent hover:border-[var(--primary)]/40"
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-muted)] mb-1 select-none">
                        <span className="flex items-center gap-1.5 font-bold text-[var(--primary)]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] inline-block"></span>
                          [{time}] Paragraph {idx + 1}
                        </span>
                        <button
                          onClick={() => toggleBookmarkLine(line.id)}
                          className={`opacity-60 group-hover:opacity-100 transition-opacity text-[10px] px-2 py-0.5 rounded cursor-pointer ${
                            isBookmarked
                              ? "text-[var(--primary)] font-bold opacity-100 bg-[var(--primary)]/10"
                              : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface)]"
                          }`}
                          title="Bookmark paragraph for review"
                        >
                          <FontAwesomeIcon icon={faBookmark} className="mr-1 text-[9px]" />
                          {isBookmarked ? "Saved" : "Save"}
                        </button>
                      </div>

                      <div
                        className={`leading-relaxed text-[var(--text)] font-sans break-words overflow-wrap-anywhere whitespace-pre-wrap ${
                          fontSize === "sm"
                            ? "text-sm sm:text-base leading-relaxed"
                            : fontSize === "md"
                            ? "text-base sm:text-lg leading-relaxed"
                            : fontSize === "lg"
                            ? "text-lg sm:text-xl leading-relaxed"
                            : "text-xl sm:text-2xl font-medium leading-relaxed"
                        }`}
                      >
                        {renderClassroomFormattedText(line.text)}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* PARAGRAPH CARDS VIEW */
              activeSession.transcript.map((line) => {
                const isBookmarked = bookmarkedLines.has(line.id);
                return (
                  <div
                    key={line.id}
                    className={`p-5 rounded-2xl border transition-all animate-fade-in text-left space-y-2.5 group shadow-xs ${
                      isBookmarked
                        ? "border-[var(--primary)] bg-[var(--primary)]/5"
                        : "border-[var(--border)] bg-[var(--background)] hover:border-[var(--text-muted)]/40"
                    }`}
                  >
                    <div className="flex justify-between items-center border-b border-[var(--border)]/50 pb-2">
                      <span className="text-[10px] font-mono text-[var(--text-muted)] flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] inline-block"></span>
                        {new Date(line.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </span>
                      <button
                        onClick={() => toggleBookmarkLine(line.id)}
                        className={`text-[11px] px-2 py-0.5 rounded-md transition-colors cursor-pointer opacity-70 hover:opacity-100 ${
                          isBookmarked
                            ? "text-[var(--primary)] font-bold bg-[var(--primary)]/10"
                            : "text-[var(--text-muted)] hover:text-[var(--text)]"
                        }`}
                        title="Bookmark paragraph for review"
                      >
                        <FontAwesomeIcon icon={faBookmark} className="text-[10px] mr-1" />
                        {isBookmarked ? "Saved" : "Bookmark"}
                      </button>
                    </div>

                    <div
                      className={`leading-relaxed text-[var(--text)] font-sans break-words overflow-wrap-anywhere whitespace-pre-wrap ${
                        fontSize === "sm"
                          ? "text-sm"
                          : fontSize === "md"
                          ? "text-base sm:text-lg"
                          : fontSize === "lg"
                          ? "text-lg sm:text-xl"
                          : "text-xl sm:text-2xl font-medium"
                      }`}
                    >
                      {renderClassroomFormattedText(line.text)}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={scrollEndRef} />
          </div>

          {/* Student Classroom Reaction Toolbar */}
          <div className="p-3 bg-[var(--background)] border-t border-[var(--border)] flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono uppercase text-[var(--text-muted)] mr-1 hidden sm:inline">Reactions</span>
              <button
                onClick={() => handleSendReaction("Asked Question")}
                className="px-2.5 py-1 text-xs border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--primary)] rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1 text-[var(--text)]"
              >
                <FontAwesomeIcon icon={faHand} className="text-amber-400 text-xs" />
                <span>Question</span>
              </button>
              <button
                onClick={() => handleSendReaction("Understood")}
                className="px-2.5 py-1 text-xs border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--primary)] rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1 text-[var(--text)]"
              >
                <FontAwesomeIcon icon={faLightbulb} className="text-amber-300 text-xs" />
                <span>Got it!</span>
              </button>
            </div>

            {studentReaction && (
              <span className="text-xs font-semibold text-[var(--primary)] animate-pulse">
                Signal Sent: {studentReaction}
              </span>
            )}

            {!isAutoScroll && activeSession.transcript?.length > 0 && (
              <button
                onClick={handleResumeAutoScroll}
                className="bg-[var(--primary)] text-black hover:bg-[var(--primary-hover)] px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-xs ml-auto"
              >
                <FontAwesomeIcon icon={faArrowDown} className="text-xs" />
                <span>Jump to Live</span>
              </button>
            )}
          </div>
        </section>

        {/* Optional Course Vocabulary Panel */}
        {activeSession.customVocab?.length > 0 && (
          <section
            className={`lg:col-span-4 border border-[var(--border)] rounded-2xl bg-[var(--surface)] overflow-hidden min-h-[580px] shadow-sm flex flex-col ${
              mobileTab === "vocab" ? "block" : "hidden lg:flex"
            }`}
          >
            <div className="border-b border-[var(--border)] px-5 py-3.5 bg-[var(--background)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FontAwesomeIcon icon={faFileLines} className="text-sm text-violet-400" />
                <span className="text-xs font-bold text-[var(--text)]">
                  Course Keyterms ({activeSession.customVocab.length})
                </span>
              </div>
            </div>

            <div className="flex-1 p-5 overflow-y-auto space-y-3 max-h-[65vh]">
              {activeSession.customVocab.map((term, i) => (
                <div
                  key={i}
                  className="p-4 border border-[var(--border)] rounded-xl bg-[var(--background)] space-y-1.5 text-left group"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-xs text-[var(--primary)] font-mono">
                      {term.keyword}
                    </h4>
                    <button
                      onClick={() => speakText(`${term.keyword}. ${term.definition}`)}
                      className="p-1 text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors cursor-pointer text-xs"
                      title="Listen to definition"
                      aria-label="Read definition aloud"
                    >
                      <FontAwesomeIcon icon={faVolumeHigh} />
                    </button>
                  </div>
                  <p className="text-xs text-[var(--text)] leading-relaxed">
                    {term.definition}
                  </p>
                  {term.details && (
                    <p className="text-[10px] text-[var(--text-muted)] leading-relaxed italic border-t border-[var(--border)] pt-1.5 mt-1.5">
                      {term.details}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};
