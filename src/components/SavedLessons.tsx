import React, { useState, useEffect } from "react";
import { useSignBridge } from "../context/SignBridgeContext";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BookOpen, BrainCircuit, Sparkles, MessageSquare, Download } from "lucide-react";

export const SavedLessons: React.FC = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const {
    activeSession,
    setActiveSession,
    loadSessionDetails,
    clearActiveSession,
    user
  } = useSignBridge();

  const [activeTab, setActiveTab] = useState<"summary" | "concepts">("summary");
  const [loading, setLoading] = useState(true);

  // Load review session from URL if missing or mismatched
  useEffect(() => {
    if (sessionId && (!activeSession || activeSession.id !== sessionId)) {
      setLoading(true);
      loadSessionDetails(sessionId).then((session) => {
        if (session) {
          setActiveSession(session);
        } else {
          navigate("/");
        }
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [sessionId, activeSession?.id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)] text-[var(--text)]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-[var(--text-muted)] font-mono">Loading lecture archives...</span>
        </div>
      </div>
    );
  }

  if (!activeSession) return null;

  const handleBack = () => {
    clearActiveSession();
    if (user) {
      navigate("/dashboard");
    } else {
      navigate("/");
    }
  };

  const handleDownloadTranscript = () => {
    const rawText = activeSession.transcript.map(t => `[${new Date(t.timestamp).toLocaleTimeString()}] ${t.text}`).join("\n");
    const blob = new Blob([rawText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `SignBridge_Transcript_${activeSession.code}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)] text-[var(--text)] transition-colors duration-150">
      {/* Header */}
      <header className="border-b border-[var(--border)] px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center bg-[var(--surface)] sticky top-0 z-30">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={handleBack}
            className="h-9 w-9 flex items-center justify-center border border-[var(--border)] rounded-lg hover:bg-[var(--background)] transition-colors text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer shrink-0"
            aria-label="Back to previous page"
          >
            <ArrowLeft size={14} />
          </button>
          <span className="font-bold text-xl sm:text-2xl tracking-tight select-none shrink-0">
            sign<span className="text-[var(--primary)]">bridge</span><span className="text-[var(--primary)] font-black text-2xl sm:text-3xl">.</span>
          </span>
          <span className="h-4 w-px bg-[var(--border)] hidden sm:block shrink-0"></span>
          <span className="text-xs text-[var(--text-muted)] hidden sm:block truncate">Lecture Review</span>
        </div>

        {/* Action Button */}
        <button
          onClick={handleDownloadTranscript}
          className="h-9 px-2.5 sm:px-3 border border-[var(--border)] rounded-lg hover:bg-[var(--background)] text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shrink-0"
          title="Export Text Transcript"
        >
          <Download size={13} />
          <span className="hidden sm:inline">Export Transcript</span>
        </button>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 grid grid-cols-1 lg:grid-cols-10 gap-5 sm:gap-8 items-stretch">

        {/* Left column (6/10): Full Transcript Log */}
        <div className="lg:col-span-6 border border-[var(--border)] rounded-xl bg-[var(--surface)] flex flex-col overflow-hidden">
          <div className="border-b border-[var(--border)] px-4 py-3 bg-[var(--background)] flex justify-between items-center shrink-0">
            <span className="text-xs font-bold tracking-wider uppercase text-[var(--text-muted)] flex items-center gap-1.5">
              <MessageSquare size={13} /> Transcript Record
            </span>
            <span className="text-[10px] font-mono text-[var(--text-muted)]">Code: {activeSession.code}</span>
          </div>

          <div className="flex-1 p-4 sm:p-6 space-y-4 overflow-y-auto max-h-[50vh] lg:max-h-[65vh]">
            {activeSession.transcript.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] py-12 text-center">No transcript available for this lecture.</p>
            ) : (
              activeSession.transcript.map((line) => (
                <div key={line.id} className="text-left pb-3 border-b border-[var(--border)] last:border-b-0 animate-fade-in">
                  <span className="text-[9px] font-mono text-[var(--text-muted)] block">
                    {new Date(line.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <p className="text-[var(--text)] mt-1 text-sm font-normal leading-relaxed">{line.text}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right column (4/10): Dual-Tab AI Summary & Concept Cues */}
        <div className="lg:col-span-4 border border-[var(--border)] rounded-xl bg-[var(--surface)] flex flex-col overflow-hidden">

          {/* Tabs header */}
          <div className="flex border-b border-[var(--border)] bg-[var(--background)] shrink-0">
            <button
              onClick={() => setActiveTab("summary")}
              className={`flex-1 py-3 text-xs font-semibold tracking-wider uppercase flex items-center justify-center gap-1.5 cursor-pointer border-b-2 transition-all ${
                activeTab === "summary"
                  ? "border-[var(--primary)] text-[var(--primary)]"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              <BrainCircuit size={13} /> AI Summary
            </button>
            <button
              onClick={() => setActiveTab("concepts")}
              className={`flex-1 py-3 text-xs font-semibold tracking-wider uppercase flex items-center justify-center gap-1.5 cursor-pointer border-b-2 transition-all ${
                activeTab === "concepts"
                  ? "border-[var(--primary)] text-[var(--primary)]"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              <Sparkles size={13} /> Visual Cues
            </button>
          </div>

          {/* Tabs Body */}
          <div className="flex-1 p-4 sm:p-6 overflow-y-auto max-h-[50vh] lg:max-h-[65vh]">
            {activeTab === "summary" ? (
              <div className="text-left space-y-4 max-w-none">
                {activeSession.summary ? (
                  <div className="whitespace-pre-line leading-relaxed text-sm text-[var(--text-muted)]">
                    {activeSession.summary}
                  </div>
                ) : (
                  <div className="py-12 flex flex-col items-center justify-center text-[var(--text-muted)]">
                    <BookOpen size={24} className="stroke-1 mb-2" />
                    <p className="text-xs font-semibold">AI Summary Unavailable</p>
                    <p className="text-[10px] mt-0.5 text-center">Summaries are generated once the session ends.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {activeSession.conceptCards.length === 0 ? (
                  <div className="py-12 text-center text-[var(--text-muted)] flex flex-col items-center justify-center">
                    <Sparkles size={24} className="stroke-1 mb-2" />
                    <p className="text-xs font-semibold">No Cue Cards Recorded</p>
                    <p className="text-[10px] mt-0.5">No custom keywords were spoken during this class.</p>
                  </div>
                ) : (
                  activeSession.conceptCards.map((card) => (
                    <div
                      key={card.id}
                      className="border border-[var(--border)] rounded-lg p-4 text-left bg-[var(--background)] space-y-2 hover:border-[var(--text-muted)] transition-colors"
                    >
                      <div className="flex justify-between items-center gap-2">
                        <h4 className="font-bold text-sm text-[var(--text)] truncate">{card.concept}</h4>
                        <span className="text-[9px] font-mono text-[var(--text-muted)] shrink-0">
                          {new Date(card.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                        {card.definition}
                      </p>
                      {card.details && (
                        <div className="pt-2 border-t border-[var(--border)] text-[11px] text-[var(--text-muted)] leading-relaxed">
                          <strong>Context: </strong> {card.details}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
