import React, { useState, useEffect, useRef } from "react";
import { useSignBridge } from "../context/SignBridgeContext";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  AlertCircle,
  Sparkles,
  Zap,
  BookOpen,
  FileText,
  CheckCircle2,
  Loader2,
  X
} from "lucide-react";
import { useGeminiIntelligence } from "../hooks/useGeminiIntelligence";

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
    addGeminiAnalysisResult
  } = useSignBridge();

  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeToast, setActiveToast] = useState<any | null>(null);
  const [mobileTab, setMobileTab] = useState<"fast" | "smart">("fast");
  const [smartSubTab, setSmartSubTab] = useState<"concepts" | "polished" | "notes">("concepts");

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollEndRef = useRef<HTMLDivElement>(null);
  const prevCardsCountRef = useRef(0);
  const lastIngestedLineIdRef = useRef<string | null>(null);

  // Gemini Intelligence Engine Integration
  const { ingestRawLine, aiStatus } = useGeminiIntelligence({
    sessionTitle: activeSession?.title,
    onAnalysisComplete: (result) => {
      addGeminiAnalysisResult({
        correctedLine: result.correctedLine,
        newConceptCards: result.newConceptCards,
        keyPoints: result.keyPoints
      });
    }
  });

  // Automatically trigger Gemini Intelligence when new raw Deepgram transcript lines arrive
  useEffect(() => {
    if (activeSession && activeSession.transcript.length > 0) {
      const latestLine = activeSession.transcript[activeSession.transcript.length - 1];
      if (latestLine && latestLine.id !== lastIngestedLineIdRef.current) {
        lastIngestedLineIdRef.current = latestLine.id;
        ingestRawLine(latestLine.text);
      }
    }
  }, [activeSession?.transcript, ingestRawLine]);

  // Monitor concept cards changes to show a real-time toast
  useEffect(() => {
    if (activeSession) {
      const currentCount = activeSession.conceptCards.length;
      const prevCount = prevCardsCountRef.current;

      if (currentCount > prevCount) {
        if (prevCount > 0) {
          const newCard = activeSession.conceptCards[currentCount - 1];
          setActiveToast(newCard);

          const timer = setTimeout(() => {
            setActiveToast((prev: any) => (prev?.id === newCard.id ? null : prev));
          }, 8000);

          return () => clearTimeout(timer);
        }
      }
      prevCardsCountRef.current = currentCount;
    }
  }, [activeSession?.conceptCards?.length]);

  // Auto-join from URL parameter if activeSession is missing or mismatched
  useEffect(() => {
    if (code && (!activeSession || activeSession.code !== code)) {
      setLoading(true);
      joinSession(code).then((res) => {
        if (res.success) {
          if (!res.isActive && res.sessionId) {
            navigate(`/review/${res.sessionId}`, { replace: true });
          }
        } else {
          navigate("/");
        }
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [code, activeSession?.code]);

  // Monitor user scrolling to detect manual scroll-up
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 30;
    setIsAutoScroll(isAtBottom);
  };

  // Scroll to bottom when transcript updates if auto-scroll is enabled
  useEffect(() => {
    if (isAutoScroll) {
      scrollEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeSession?.transcript, isAutoScroll]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)] text-[var(--text)]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-[var(--text-muted)] font-mono">Connecting to classroom feed...</span>
        </div>
      </div>
    );
  }

  if (!activeSession) return null;

  const handleResumeAutoScroll = () => {
    setIsAutoScroll(true);
    scrollEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleBack = () => {
    clearActiveSession();
    navigate("/");
  };

  // Font size mapper
  const getFontSizeClass = () => {
    switch (fontSize) {
      case "sm":
        return "text-sm md:text-base";
      case "md":
        return "text-base md:text-lg";
      case "lg":
        return "text-lg md:text-xl";
      case "xl":
        return "text-xl md:text-2xl font-medium";
      default:
        return "text-base";
    }
  };

  const conceptCardsCount = activeSession.conceptCards?.length || 0;
  const polishedTranscript = activeSession.polishedTranscript || [];
  const smartNotes = activeSession.smartNotes || [];

  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)] text-[var(--text)] transition-colors duration-150">
      {/* Top Header */}
      <header className="border-b border-[var(--border)] px-4 sm:px-6 py-3 flex justify-between items-center bg-[var(--surface)] sticky top-0 z-30">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={handleBack}
            className="h-9 w-9 flex items-center justify-center border border-[var(--border)] rounded-lg hover:bg-[var(--background)] transition-colors text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer shrink-0"
            aria-label="Back to home"
          >
            <ArrowLeft size={14} />
          </button>
          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-sm tracking-tight text-[var(--text)] truncate">
              {activeSession.title}
            </span>
            <span className="text-[10px] text-[var(--text-muted)] font-mono truncate">
              Room Code: {activeSession.code}
            </span>
          </div>
        </div>

        {/* View Switcher & Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Mobile Fast vs Smart View Toggle */}
          <div className="flex lg:hidden border border-[var(--border)] rounded-lg bg-[var(--background)] p-0.5 text-xs font-medium">
            <button
              onClick={() => setMobileTab("fast")}
              className={`px-3 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
                mobileTab === "fast"
                  ? "bg-[var(--surface)] text-[var(--primary)] font-semibold shadow-sm"
                  : "text-[var(--text-muted)]"
              }`}
            >
              <Zap size={12} />
              <span>Fast</span>
            </button>
            <button
              onClick={() => setMobileTab("smart")}
              className={`px-3 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
                mobileTab === "smart"
                  ? "bg-[var(--surface)] text-[var(--primary)] font-semibold shadow-sm"
                  : "text-[var(--text-muted)]"
              }`}
            >
              <Sparkles size={12} />
              <span>Smart AI</span>
            </button>
          </div>

          {/* Connection & Mode Badge */}
          <div className="hidden sm:flex items-center gap-2 border border-[var(--border)] rounded-lg px-3 py-1.5 bg-[var(--background)] text-[11px] font-mono">
            <span className={`w-2 h-2 rounded-full shrink-0 ${isPlaceholder ? "bg-yellow-500 animate-pulse" : "bg-[var(--primary)] animate-pulse"}`}></span>
            <span>{isPlaceholder ? "Offline Mode" : "Live Dual-Layer"}</span>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center border border-[var(--border)] rounded-lg bg-[var(--background)] overflow-hidden">
            <button
              onClick={() =>
                fontSize === "xl"
                  ? setFontSize("lg")
                  : fontSize === "lg"
                  ? setFontSize("md")
                  : setFontSize("sm")
              }
              disabled={fontSize === "sm"}
              className="h-9 w-9 flex items-center justify-center hover:bg-[var(--surface)] border-r border-[var(--border)] disabled:opacity-40 text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
              title="Decrease Font Size"
            >
              <ZoomOut size={14} />
            </button>
            <button
              onClick={() => setFontSize("md")}
              className="h-9 w-9 flex items-center justify-center hover:bg-[var(--surface)] border-r border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
              title="Reset Font Size"
            >
              <RotateCcw size={12} />
            </button>
            <button
              onClick={() =>
                fontSize === "sm"
                  ? setFontSize("md")
                  : fontSize === "md"
                  ? setFontSize("lg")
                  : setFontSize("xl")
              }
              disabled={fontSize === "xl"}
              className="h-9 w-9 flex items-center justify-center hover:bg-[var(--surface)] disabled:opacity-40 text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
              title="Increase Font Size"
            >
              <ZoomIn size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Dual-Panel Workspace */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[calc(100vh-80px)]">
        {/* LEFT PANEL: FAST LIVE CAPTION STREAM (Instant Deepgram Stream) */}
        <section
          className={`lg:col-span-6 flex flex-col border border-[var(--border)] rounded-xl bg-[var(--surface)] overflow-hidden min-h-[550px] transition-all ${
            mobileTab === "fast" ? "block" : "hidden lg:flex"
          }`}
        >
          {/* Fast Stream Header */}
          <div className="border-b border-[var(--border)] px-4 py-3 bg-[var(--background)] flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20">
                <Zap size={13} />
              </span>
              <div className="flex flex-col">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--text)]">
                  Fast Live Captions
                </span>
                <span className="text-[10px] text-[var(--text-muted)] font-mono">
                  Deepgram STT • Instant Zero-Latency Stream
                </span>
              </div>
            </div>
            <span className="text-[10px] bg-[var(--surface)] border border-[var(--border)] text-[var(--text-muted)] px-2 py-1 rounded font-mono">
              Font: {fontSize.toUpperCase()}
            </span>
          </div>

          {/* Live Transcript Stream Scroll Container */}
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 relative scroll-smooth"
          >
            {activeSession.transcript.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-[var(--text-muted)] py-24 text-center">
                <AlertCircle size={32} className="mb-3 stroke-1 text-[var(--text-muted)]" />
                <p className="text-sm font-medium">Waiting for lecturer to start speaking...</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Live speech captions will stream here in real-time.
                </p>
              </div>
            ) : (
              <div className={`space-y-6 transition-all ${getFontSizeClass()}`}>
                {/* Historical Transcript Lines */}
                {activeSession.transcript.length > 1 && (
                  <div className="text-left leading-relaxed space-y-3 text-[var(--text)]/90">
                    {activeSession.transcript.slice(0, -1).map((line) => (
                      <span
                        key={line.id}
                        className="inline font-normal transition-colors hover:text-[var(--primary)]"
                      >
                        {line.text}{" "}
                      </span>
                    ))}
                  </div>
                )}

                {/* Now Speaking Active Sentence Highlight Box */}
                {activeSession.transcript.length > 0 && (
                  <div className="p-4 rounded-xl border-l-4 border-[var(--primary)] bg-[var(--primary)]/10 text-left space-y-2 animate-fade-in shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-[var(--primary)] flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[var(--primary)] animate-ping" />
                        Now Speaking
                      </span>
                      <span className="text-[9px] font-mono text-[var(--text-muted)]">
                        {new Date(
                          activeSession.transcript[activeSession.transcript.length - 1].timestamp
                        ).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit"
                        })}
                      </span>
                    </div>

                    <p className="text-[var(--text)] font-semibold leading-relaxed">
                      <span>
                        {activeSession.transcript[activeSession.transcript.length - 1].text}
                      </span>
                    </p>
                  </div>
                )}
              </div>
            )}
            <div ref={scrollEndRef} />
          </div>

          {/* Resume Auto-Scroll Recall Pill */}
          {!isAutoScroll && activeSession.transcript.length > 0 && (
            <div className="p-2 flex justify-center bg-[var(--background)]/80 border-t border-[var(--border)] backdrop-blur-xs">
              <button
                onClick={handleResumeAutoScroll}
                className="bg-[var(--text)] text-[var(--background)] hover:bg-[var(--text-muted)] px-4 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                Resume Auto-Scroll
              </button>
            </div>
          )}
        </section>

        {/* RIGHT PANEL: SMART STUDENT AI PANEL (Gemini Intelligence Hub) */}
        <section
          className={`lg:col-span-6 flex flex-col border border-[var(--border)] rounded-xl bg-[var(--surface)] overflow-hidden min-h-[550px] transition-all ${
            mobileTab === "smart" ? "block" : "hidden lg:flex"
          }`}
        >
          {/* Smart AI Panel Header */}
          <div className="border-b border-[var(--border)] px-4 py-3 bg-[var(--background)] flex flex-col sm:flex-row justify-between sm:items-center gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20">
                <Sparkles size={14} />
              </span>
              <div className="flex flex-col">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--text)]">
                  Smart AI Panel
                </span>
                <span className="text-[10px] text-[var(--text-muted)] font-mono">
                  Gemini Flash AI • Background Processing
                </span>
              </div>
            </div>

            {/* AI Status Indicator */}
            <div className="flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-1 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] self-start sm:self-auto">
              {aiStatus === "processing" ? (
                <>
                  <Loader2 size={11} className="animate-spin text-[var(--primary)]" />
                  <span className="text-[var(--primary)]">Gemini Analyzing...</span>
                </>
              ) : aiStatus === "buffering" ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                  <span>Buffering ~3s</span>
                </>
              ) : aiStatus === "updated" ? (
                <>
                  <CheckCircle2 size={11} className="text-green-500" />
                  <span className="text-green-500">Updated</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-[var(--primary)]" />
                  <span>Gemini Ready</span>
                </>
              )}
            </div>
          </div>

          {/* Sub-Tab Navigation Bar */}
          <div className="flex border-b border-[var(--border)] bg-[var(--surface)] text-xs font-semibold px-4 pt-2 gap-4">
            <button
              onClick={() => setSmartSubTab("concepts")}
              className={`pb-2.5 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                smartSubTab === "concepts"
                  ? "border-[var(--primary)] text-[var(--primary)]"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              <BookOpen size={13} />
              <span>Vocabulary Cues ({conceptCardsCount})</span>
            </button>

            <button
              onClick={() => setSmartSubTab("polished")}
              className={`pb-2.5 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                smartSubTab === "polished"
                  ? "border-[var(--primary)] text-[var(--primary)]"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              <CheckCircle2 size={13} />
              <span>Polished Log ({polishedTranscript.length})</span>
            </button>

            <button
              onClick={() => setSmartSubTab("notes")}
              className={`pb-2.5 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                smartSubTab === "notes"
                  ? "border-[var(--primary)] text-[var(--primary)]"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              <FileText size={13} />
              <span>Smart Notes ({smartNotes.length})</span>
            </button>
          </div>

          {/* Tab 1: Concept Vocabulary Cards */}
          {smartSubTab === "concepts" && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {conceptCardsCount === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-[var(--text-muted)] py-20 text-center">
                  <Sparkles size={28} className="mb-2 text-[var(--text-muted)] stroke-1" />
                  <p className="text-xs font-semibold">No medical or technical concepts extracted yet.</p>
                  <p className="text-[11px] text-[var(--text-muted)] mt-1 max-w-xs">
                    As the lecture progresses, Gemini will automatically extract terminology and explain concepts here.
                  </p>
                </div>
              ) : (
                activeSession.conceptCards.map((card) => {
                  const isExpanded = activeCardId === card.id;
                  return (
                    <div
                      key={card.id}
                      className={`border rounded-xl p-4 text-left transition-all duration-150 bg-[var(--background)] ${
                        isExpanded
                          ? "border-[var(--primary)] shadow-sm"
                          : "border-[var(--border)] hover:border-[var(--text-muted)]"
                      }`}
                    >
                      <button
                        onClick={() => setActiveCardId(isExpanded ? null : card.id)}
                        className="w-full text-left cursor-pointer"
                      >
                        <div className="flex justify-between items-center flex-wrap gap-1">
                          <h4 className="font-bold text-xs text-[var(--text)] font-mono flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)]" />
                            {card.concept}
                          </h4>
                          <span className="text-[9px] font-mono text-[var(--text-muted)]">
                            {new Date(card.timestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--text)]/90 mt-2 leading-relaxed font-normal">
                          {card.definition}
                        </p>
                      </button>
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-[var(--border)] text-[11px] text-[var(--text-muted)] leading-relaxed">
                          <strong className="text-[var(--text)] block mb-1 font-mono text-[10px] uppercase tracking-wider">
                            Detailed AI Context:
                          </strong>
                          {card.details}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Tab 2: Polished Corrected Transcript Log */}
          {smartSubTab === "polished" && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {polishedTranscript.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-[var(--text-muted)] py-20 text-center">
                  <CheckCircle2 size={28} className="mb-2 text-[var(--text-muted)] stroke-1" />
                  <p className="text-xs font-semibold">Gemini polishing in background...</p>
                  <p className="text-[11px] text-[var(--text-muted)] mt-1 max-w-xs">
                    Gemini corrects speech typos, capitalization, and medical terminology before saving the final transcript.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {polishedTranscript.map((line) => (
                    <div
                      key={line.id}
                      className="p-3 border border-[var(--border)] rounded-lg bg-[var(--background)] text-xs text-[var(--text)] leading-relaxed flex items-start gap-2"
                    >
                      <span className="text-[9px] font-mono text-[var(--primary)] shrink-0 mt-0.5 font-bold">
                        AI FIX
                      </span>
                      <p className="flex-1">{line.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Smart AI Notes */}
          {smartSubTab === "notes" && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {smartNotes.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-[var(--text-muted)] py-20 text-center">
                  <FileText size={28} className="mb-2 text-[var(--text-muted)] stroke-1" />
                  <p className="text-xs font-semibold">Generating key lecture notes...</p>
                  <p className="text-[11px] text-[var(--text-muted)] mt-1 max-w-xs">
                    Structured summary takeaways will populate automatically as topics are discussed.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {smartNotes.map((note, index) => (
                    <div
                      key={index}
                      className="p-3 border border-[var(--border)] rounded-lg bg-[var(--background)] text-xs text-[var(--text)] leading-relaxed flex items-start gap-2.5"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] shrink-0 mt-1.5" />
                      <p>{note}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      {/* Real-time Visual Concept Toast (Slide-in Popup) */}
      {activeToast && (
        <div className="fixed bottom-6 right-4 sm:right-8 w-[calc(100vw-2rem)] sm:w-80 border border-[var(--primary)] rounded-xl bg-[var(--surface)] p-4 shadow-2xl z-40 animate-slide-in-right">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[9px] bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20 px-2 py-0.5 rounded font-mono uppercase font-bold tracking-wider">
              Gemini AI Concept Extracted
            </span>
            <button
              onClick={() => setActiveToast(null)}
              className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors p-1 cursor-pointer"
            >
              <X size={12} />
            </button>
          </div>
          <h4 className="font-bold text-xs text-[var(--text)] font-mono">{activeToast.concept}</h4>
          <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-2 leading-relaxed">
            {activeToast.definition}
          </p>
          <div className="mt-3 flex justify-end gap-2">
            <button
              onClick={() => setActiveToast(null)}
              className="h-7 px-3 text-[10px] border border-[var(--border)] rounded-lg hover:bg-[var(--background)] transition-colors cursor-pointer text-[var(--text-muted)]"
            >
              Dismiss
            </button>
            <button
              onClick={() => {
                setActiveToast(null);
                setMobileTab("smart");
                setSmartSubTab("concepts");
                setActiveCardId(activeToast.id);
              }}
              className="h-7 px-3 text-[10px] bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-black font-semibold rounded-lg transition-colors cursor-pointer"
            >
              View in Smart AI Panel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
