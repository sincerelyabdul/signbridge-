import React, { useState, useEffect, useRef } from "react";
import { useSignBridge } from "../context/SignBridgeContext";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ZoomIn, ZoomOut, RotateCcw, AlertCircle, Sparkles, X } from "lucide-react";

export const StudentWorkspace: React.FC = () => {
  const { code } = useParams();
  const navigate = useNavigate();

  const {
    activeSession,
    joinSession,
    fontSize,
    setFontSize,
    clearActiveSession,
    isPlaceholder
  } = useSignBridge();

  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeToast, setActiveToast] = useState<any | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollEndRef = useRef<HTMLDivElement>(null);
  const prevCardsCountRef = useRef(0);

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
            setActiveToast((prev: any) => prev?.id === newCard.id ? null : prev);
          }, 10000);

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
      case "sm": return "text-sm md:text-base";
      case "md": return "text-base md:text-lg";
      case "lg": return "text-lg md:text-xl";
      case "xl": return "text-xl md:text-3xl font-medium";
      default: return "text-base";
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)] text-[var(--text)] transition-colors duration-150">
      {/* Header */}
      <header className="border-b border-[var(--border)] px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center bg-[var(--surface)] sticky top-0 z-30">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={handleBack}
            className="h-9 w-9 flex items-center justify-center border border-[var(--border)] rounded-lg hover:bg-[var(--background)] transition-colors text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer shrink-0"
            aria-label="Back to home"
          >
            <ArrowLeft size={14} />
          </button>
          <span className="font-semibold text-sm tracking-tight text-[var(--text)] truncate">{activeSession.title}</span>
        </div>

        {/* Accessibility & Connection Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Connection Status */}
          <div className="flex items-center gap-1.5 border border-[var(--border)] rounded-lg px-2 sm:px-3 py-1.5 bg-[var(--background)] text-[10px] font-mono">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isPlaceholder ? "bg-yellow-500 animate-pulse" : "bg-[var(--primary)] animate-pulse"}`}></span>
            <span className="hidden sm:inline">{isPlaceholder ? "Offline Simulator" : "Live Stream"}</span>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center border border-[var(--border)] rounded-lg bg-[var(--background)] overflow-hidden">
            <button
              onClick={() => fontSize === "xl" ? setFontSize("lg") : fontSize === "lg" ? setFontSize("md") : setFontSize("sm")}
              disabled={fontSize === "sm"}
              className="h-9 w-9 flex items-center justify-center hover:bg-[var(--surface)] border-r border-[var(--border)] disabled:opacity-50 text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
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
              onClick={() => fontSize === "sm" ? setFontSize("md") : fontSize === "md" ? setFontSize("lg") : setFontSize("xl")}
              disabled={fontSize === "xl"}
              className="h-9 w-9 flex items-center justify-center hover:bg-[var(--surface)] disabled:opacity-50 text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
              title="Increase Font Size"
            >
              <ZoomIn size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 flex flex-col">

        {/* Full-width Captions Stream */}
        <div className="flex flex-col relative border border-[var(--border)] rounded-xl bg-[var(--surface)] overflow-hidden flex-1 min-h-[calc(100vh-140px)]">

          {/* Section Indicator */}
          <div className="border-b border-[var(--border)] px-4 py-2.5 bg-[var(--background)] flex justify-between items-center shrink-0">
            <span className="text-[10px] font-bold tracking-wider uppercase text-[var(--text-muted)]">Live Captions Stream</span>
            <span className="text-[10px] text-[var(--text-muted)] font-mono hidden sm:block">Font size: {fontSize.toUpperCase()}</span>
          </div>

          {/* Transcript Scroll Container */}
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 relative scroll-smooth"
          >
            {activeSession.transcript.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-[var(--text-muted)] py-20">
                <AlertCircle size={32} className="mb-3 stroke-1 text-[var(--text-muted)]" />
                <p className="text-sm font-medium">Waiting for lecturer to start speaking...</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">Live speech captions will appear here in real-time.</p>
              </div>
            ) : (
              <div className={`space-y-6 transition-all ${getFontSizeClass()}`}>
                {/* Historical Transcript Paragraphs */}
                {activeSession.transcript.length > 1 && (
                  <div className="text-left leading-relaxed space-y-4 text-[var(--text)]/90 font-normal">
                    {/* Render prior lines (excluding the very last one) in smooth flowing paragraph blocks */}
                    {activeSession.transcript.slice(0, -1).map((line) => (
                      <span key={line.id} className="inline font-normal transition-colors hover:text-[var(--primary)]">
                        {line.text}{" "}
                      </span>
                    ))}
                  </div>
                )}

                {/* Active Sentence Highlight Box (The current spoken sentence) */}
                {activeSession.transcript.length > 0 && (
                  <div className="p-4 rounded-xl border-l-4 border-[var(--primary)] bg-[var(--primary)]/10 text-left space-y-2 animate-fade-in shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-[var(--primary)] flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[var(--primary)] animate-ping" />
                        Now Speaking
                      </span>
                      <span className="text-[9px] font-mono text-[var(--text-muted)]">
                        {new Date(activeSession.transcript[activeSession.transcript.length - 1].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>

                    <p className="text-[var(--text)] font-semibold leading-relaxed">
                      <span>{activeSession.transcript[activeSession.transcript.length - 1].text}</span>
                    </p>
                  </div>
                )}
              </div>
            )}
            <div ref={scrollEndRef} />
          </div>

          {/* Scroll Recall Notification */}
          {!isAutoScroll && activeSession.transcript.length > 0 && (
            <button
              onClick={handleResumeAutoScroll}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-[var(--text)] text-[var(--background)] hover:bg-[var(--text-muted)] px-4 py-2 border border-[var(--border)] rounded-full shadow-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer z-10"
            >
              Resume Auto-Scroll
            </button>
          )}
        </div>
      </div>

      {/* Floating Concept Cue Trigger Button */}
      {activeSession.conceptCards.length > 0 && (
        <button
          onClick={() => setIsDrawerOpen(true)}
          className="fixed bottom-6 right-4 sm:right-8 bg-[var(--surface)] hover:bg-[var(--background)] border border-[var(--border)] text-[var(--text)] px-3 sm:px-4 py-2 sm:py-2.5 rounded-full shadow-lg flex items-center gap-2 text-xs font-semibold transition-all hover:scale-105 cursor-pointer z-40"
        >
          <Sparkles size={13} className="text-[var(--primary)]" />
          <span>Vocabulary Cues ({activeSession.conceptCards.length})</span>
          <span className="w-2 h-2 bg-[var(--primary)] rounded-full animate-ping"></span>
        </button>
      )}

      {/* Sliding Overlays Backdrop */}
      {isDrawerOpen && (
        <div
          onClick={() => setIsDrawerOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
        ></div>
      )}

      {/* Slide-over Concept Cards Drawer */}
      <div
        className={`fixed right-0 top-0 h-screen w-full sm:w-80 md:w-96 border-l border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6 shadow-2xl flex flex-col z-50 transition-transform duration-300 ${
          isDrawerOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex justify-between items-center border-b border-[var(--border)] pb-4 mb-4">
          <h3 className="font-bold text-sm text-[var(--text)] flex items-center gap-2">
            <Sparkles size={16} className="text-[var(--primary)]" />
            <span>Session Concept Cues</span>
          </h3>
          <button
            onClick={() => setIsDrawerOpen(false)}
            className="h-9 w-9 flex items-center justify-center border border-[var(--border)] rounded-lg hover:bg-[var(--background)] transition-colors text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {activeSession.conceptCards.map((card) => {
            const isExpanded = activeCardId === card.id;
            return (
              <div
                key={card.id}
                className={`border rounded-lg p-4 text-left transition-all duration-150 bg-[var(--background)] ${
                  isExpanded
                    ? "border-[var(--primary)]"
                    : "border-[var(--border)] hover:border-[var(--text-muted)]"
                }`}
              >
                <button
                  onClick={() => setActiveCardId(isExpanded ? null : card.id)}
                  className="w-full text-left cursor-pointer"
                >
                  <div className="flex justify-between items-center flex-wrap gap-1">
                    <h4 className="font-bold text-xs text-[var(--text)] font-mono">{card.concept}</h4>
                    <span className="text-[8px] font-mono text-[var(--text-muted)]">
                      {new Date(card.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] mt-2 leading-relaxed">
                    {card.definition}
                  </p>
                </button>
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-[var(--border)] text-[10px] text-[var(--text-muted)] leading-relaxed animate-slide-down">
                    <strong className="text-[var(--text)] block mb-1">Additional Context:</strong>
                    {card.details}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Real-time Visual Concept Toast (Slide-in Popup) */}
      {activeToast && (
        <div className="fixed bottom-20 right-4 sm:right-8 w-[calc(100vw-2rem)] sm:w-80 border border-[var(--primary)] rounded-xl bg-[var(--surface)] p-4 shadow-2xl z-40 animate-slide-in-right">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[9px] bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20 px-2 py-0.5 rounded font-mono uppercase font-bold tracking-wider">
              New Concept Triggered
            </span>
            <button
              onClick={() => setActiveToast(null)}
              className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors p-1"
            >
              <X size={12} />
            </button>
          </div>
          <h4 className="font-bold text-sm text-[var(--text)] font-mono">{activeToast.concept}</h4>
          <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-2 leading-relaxed">{activeToast.definition}</p>
          <div className="mt-3 flex justify-end gap-2">
            <button
              onClick={() => setActiveToast(null)}
              className="h-8 px-3 text-[10px] border border-[var(--border)] rounded-lg hover:bg-[var(--background)] transition-colors cursor-pointer"
            >
              Dismiss
            </button>
            <button
              onClick={() => {
                setActiveToast(null);
                setIsDrawerOpen(true);
                setActiveCardId(activeToast.id);
              }}
              className="h-8 px-3 text-[10px] bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-black font-semibold rounded-lg transition-colors cursor-pointer"
            >
              View Details
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
