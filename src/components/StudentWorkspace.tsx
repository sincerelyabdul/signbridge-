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
  const [bookmarkedLines, setBookmarkedLines] = useState<Set<string>>(new Set());

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollEndRef = useRef<HTMLDivElement>(null);

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

  const handleCopyInviteLink = () => {
    const inviteUrl = window.location.href;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const toggleBookmarkLine = (lineId: string) => {
    setBookmarkedLines((prev) => {
      const next = new Set(prev);
      if (next.has(lineId)) next.delete(lineId);
      else next.add(lineId);
      return next;
    });
  };

  /** Highlight course keyterms inside transcript text */
  const renderHighlightedTranscript = (text: string) => {
    if (!activeSession?.customVocab || activeSession.customVocab.length === 0) {
      return text;
    }

    const keywords = activeSession.customVocab
      .map((v) => v.keyword)
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);

    if (keywords.length === 0) return text;

    const pattern = new RegExp(`\\b(${keywords.map((k) => k.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")).join("|")})\\b`, "gi");
    const parts = text.split(pattern);

    return parts.map((part, i) => {
      const matched = keywords.find((k) => k.toLowerCase() === part.toLowerCase());
      if (matched) {
        return (
          <mark
            key={i}
            className="bg-[var(--primary)]/15 border-b-2 border-[var(--primary)] text-[var(--text)] font-semibold px-1 rounded-sm cursor-help"
            title={`Course Keyterm: ${matched}`}
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
      <header className="border-b border-[var(--border)] bg-[var(--surface)] px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4 flex-wrap">
        {/* Live Broadcast Badge & Room Code */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--primary)] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[var(--primary)]"></span>
            </span>
            <span className="text-xs font-bold text-[var(--text)] uppercase tracking-wider flex items-center gap-1.5">
              <FontAwesomeIcon icon={faRadio} className="text-[13px] text-[var(--primary)]" />
              Live Classroom Feed
            </span>
          </div>

          {/* Room Code Badge with Copy Link */}
          <button
            onClick={handleCopyInviteLink}
            className="text-[10px] font-mono border border-[var(--border)] hover:border-[var(--primary)] bg-[var(--background)] text-[var(--text-muted)] hover:text-[var(--text)] px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
            title="Click to copy invite link"
          >
            <FontAwesomeIcon icon={faShareNodes} className="text-[10px] text-[var(--primary)]" />
            <span>Room Code: <strong className="text-[var(--text)]">{activeSession.code}</strong></span>
            <FontAwesomeIcon icon={copiedCode ? faCheck : faCopy} className="text-[10px]" />
          </button>
        </div>

        {/* Mobile View Toggle */}
        <div className="flex lg:hidden border border-[var(--border)] rounded-lg bg-[var(--background)] p-0.5">
          <button
            onClick={() => setMobileTab("live")}
            className={`px-3 py-1 text-[10px] font-semibold rounded-md transition-colors ${
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
              className={`px-3 py-1 text-[10px] font-semibold rounded-md transition-colors ${
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
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono uppercase text-[var(--text-muted)] mr-1 hidden sm:inline">
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
      </header>

      {/* Main Workspace Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Live AssemblyAI Caption Feed */}
        <section
          className={`flex flex-col border border-[var(--border)] rounded-2xl bg-[var(--surface)] overflow-hidden min-h-[580px] shadow-sm transition-all ${
            activeSession.customVocab?.length > 0 ? "lg:col-span-8" : "lg:col-span-12"
          } ${mobileTab === "live" ? "block" : "hidden lg:flex"}`}
        >
          {/* Feed Sub-Header */}
          <div className="border-b border-[var(--border)] px-5 py-3.5 bg-[var(--background)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FontAwesomeIcon icon={faBookOpen} className="text-sm text-[var(--primary)]" />
              <span className="text-xs font-bold text-[var(--text)]">
                Live Speech Transcript Stream
              </span>
            </div>
            <span className="text-[10px] font-mono text-[var(--text-muted)]">
              {activeSession.transcript?.length || 0} Paragraphs
            </span>
          </div>

          {/* Transcript Scroll Container */}
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 p-6 sm:p-8 overflow-y-auto space-y-5 max-h-[65vh]"
          >
            {activeSession.transcript?.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-[var(--text-muted)] py-20 space-y-3">
                <FontAwesomeIcon icon={faWifi} className="text-3xl animate-pulse text-[var(--primary)]" />
                <p className="font-bold text-sm text-[var(--text)]">Listening for Live Speech Stream...</p>
                <p className="text-xs max-w-xs leading-relaxed">
                  As your lecturer speaks, intelligent continuous captions will stream on your screen in real time.
                </p>
              </div>
            ) : (
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

                    <p
                      className={`leading-relaxed text-[var(--text)] font-sans ${
                        fontSize === "sm"
                          ? "text-sm"
                          : fontSize === "md"
                          ? "text-base sm:text-lg"
                          : fontSize === "lg"
                          ? "text-lg sm:text-xl"
                          : "text-xl sm:text-2xl font-medium"
                      }`}
                    >
                      {renderHighlightedTranscript(line.text)}
                    </p>
                  </div>
                );
              })
            )}
            <div ref={scrollEndRef} />
          </div>

          {/* Resume Auto-Scroll Button */}
          {!isAutoScroll && activeSession.transcript?.length > 0 && (
            <div className="p-2.5 flex justify-center bg-[var(--background)]/90 border-t border-[var(--border)] backdrop-blur-xs">
              <button
                onClick={handleResumeAutoScroll}
                className="bg-[var(--primary)] text-black hover:bg-[var(--primary-hover)] px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
              >
                Resume Auto-Scroll ↓
              </button>
            </div>
          )}
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
                  className="p-4 border border-[var(--border)] rounded-xl bg-[var(--background)] space-y-1.5 text-left"
                >
                  <h4 className="font-bold text-xs text-[var(--primary)] font-mono">
                    {term.keyword}
                  </h4>
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
