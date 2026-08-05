import React, { useState, useEffect } from "react";
import { useSignBridge } from "../context/SignBridgeContext";
import { useNavigate, useParams } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFileLines,
  faComment,
  faMagnifyingGlass,
  faCopy,
  faCheck,
  faLightbulb,
  faWandMagicSparkles,
  faSpinner,
} from "@fortawesome/free-solid-svg-icons";
import { Navbar } from "./Navbar";
import { Loader } from "./Loader";
import { generateAISummary } from "../services/geminiService";
import { supabase } from "../lib/supabaseClient";

export const SavedLessons: React.FC = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const {
    activeSession,
    setActiveSession,
    loadSessionDetails,
    clearActiveSession,
    user,
    isPlaceholder,
  } = useSignBridge();

  const [activeTab, setActiveTab] = useState<"summary" | "concepts">("summary");
  const [loading, setLoading] = useState(true);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [copied, setCopied] = useState(false);

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
        <Loader label="Loading lecture review..." />
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

  const handleGenerateSummary = async () => {
    if (!activeSession || isGeneratingSummary) return;
    setIsGeneratingSummary(true);
    try {
      const newSummary = await generateAISummary(
        activeSession.title,
        activeSession.transcript || [],
        activeSession.conceptCards || []
      );

      const updated = { ...activeSession, summary: newSummary };
      setActiveSession(updated);

      if (!isPlaceholder) {
        await supabase
          .from("sessions")
          .update({ summary: newSummary })
          .eq("id", activeSession.id);
      }
    } catch (e) {
      console.error("Failed to generate AI summary:", e);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleDownloadTranscript = () => {
    const rawText = activeSession.transcript
      .map((t) => `[${new Date(t.timestamp).toLocaleTimeString()}] ${t.text}`)
      .join("\n");
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

  const handleCopyTranscript = () => {
    const rawText = activeSession.transcript
      .map((t) => `[${new Date(t.timestamp).toLocaleTimeString()}] ${t.text}`)
      .join("\n");
    navigator.clipboard.writeText(rawText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Filter transcript lines based on search query
  const filteredTranscript = activeSession.transcript.filter((line) =>
    line.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen pt-12 bg-[var(--background)] text-[var(--text)] transition-colors duration-150">
      {/* Header */}
      <Navbar
        variant="review"
        sessionTitle={activeSession.title}
        contextLabel="Lecture Review"
        onBack={handleBack}
        onExportTranscript={handleDownloadTranscript}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 grid grid-cols-1 lg:grid-cols-10 gap-5 sm:gap-8 items-stretch">
        
        {/* Left column (6/10): Full Transcript Log */}
        <div className="lg:col-span-6 border border-[var(--border)] rounded-2xl bg-[var(--surface)] flex flex-col overflow-hidden shadow-sm">
          
          {/* Header & Controls Bar */}
          <div className="border-b border-[var(--border)] px-4 py-3 bg-[var(--background)] space-y-2 shrink-0">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold tracking-wider uppercase text-[var(--text-muted)] flex items-center gap-1.5">
                <FontAwesomeIcon icon={faComment} className="text-[13px] text-[var(--primary)]" />
                Lecture Transcript ({activeSession.transcript.length})
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyTranscript}
                  className="text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--text)] transition-colors flex items-center gap-1 cursor-pointer"
                  title="Copy transcript to clipboard"
                >
                  <FontAwesomeIcon icon={copied ? faCheck : faCopy} className="text-[11px]" />
                  <span>{copied ? "Copied" : "Copy"}</span>
                </button>
                <span className="text-[10px] font-mono text-[var(--text-muted)] border border-[var(--border)] px-1.5 py-0.5 rounded bg-[var(--surface)]">
                  Code: {activeSession.code}
                </span>
              </div>
            </div>

            {/* Search Filter Input */}
            {activeSession.transcript.length > 0 && (
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search transcript..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text)] focus:outline-none focus:border-[var(--primary)] transition-colors"
                />
                <FontAwesomeIcon icon={faMagnifyingGlass} className="absolute left-2.5 top-2.5 text-[10px] text-[var(--text-muted)]" />
              </div>
            )}
          </div>

          {/* Transcript Feed */}
          <div className="flex-1 p-4 sm:p-6 space-y-4 overflow-y-auto max-h-[50vh] lg:max-h-[65vh]">
            {activeSession.transcript.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] py-12 text-center">
                No transcript available for this lecture.
              </p>
            ) : filteredTranscript.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] py-12 text-center">
                No transcript lines matching "{searchQuery}".
              </p>
            ) : (
              filteredTranscript.map((line) => (
                <div
                  key={line.id}
                  className="text-left pb-3 border-b border-[var(--border)] last:border-b-0 animate-fade-in"
                >
                  <span className="text-[9px] font-mono text-[var(--text-muted)] block">
                    {new Date(line.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <p className="text-[var(--text)] mt-1 text-sm font-normal leading-relaxed">
                    {line.text}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right column (4/10): Dual-Tab Summary & Key Concepts */}
        <div className="lg:col-span-4 border border-[var(--border)] rounded-2xl bg-[var(--surface)] flex flex-col overflow-hidden shadow-sm">
          
          {/* Tabs Header */}
          <div className="flex border-b border-[var(--border)] bg-[var(--background)] shrink-0 justify-between items-center px-2">
            <div className="flex flex-1">
              <button
                onClick={() => setActiveTab("summary")}
                className={`py-3 px-3 text-xs font-semibold tracking-wider uppercase flex items-center justify-center gap-1.5 cursor-pointer border-b-2 transition-all ${
                  activeTab === "summary"
                    ? "border-[var(--primary)] text-[var(--primary)] font-bold"
                    : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                <FontAwesomeIcon icon={faFileLines} className="text-[13px]" /> Lesson Summary
              </button>
              <button
                onClick={() => setActiveTab("concepts")}
                className={`py-3 px-3 text-xs font-semibold tracking-wider uppercase flex items-center justify-center gap-1.5 cursor-pointer border-b-2 transition-all ${
                  activeTab === "concepts"
                    ? "border-[var(--primary)] text-[var(--primary)] font-bold"
                    : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                <FontAwesomeIcon icon={faLightbulb} className="text-[13px]" /> Key Concepts ({activeSession.conceptCards.length})
              </button>
            </div>
          </div>

          {/* Action Bar for Summary */}
          {activeTab === "summary" && (
            <div className="px-4 py-2 bg-[var(--background)] border-b border-[var(--border)] flex justify-between items-center">
              <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider">
                Google Gemini AI Summary
              </span>
              <button
                onClick={handleGenerateSummary}
                disabled={isGeneratingSummary || activeSession.transcript.length === 0}
                className="text-[11px] font-bold text-[var(--primary)] hover:underline flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:no-underline"
                title={activeSession.transcript.length === 0 ? "Cannot generate summary for session with 0 transcript lines" : ""}
              >
                {isGeneratingSummary ? (
                  <>
                    <FontAwesomeIcon icon={faSpinner} spin className="text-[10px]" /> Generating...
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faWandMagicSparkles} className="text-[10px]" />{" "}
                    {activeSession.transcript.length === 0
                      ? "No Transcript to Summarize"
                      : activeSession.summary
                      ? "Regenerate Summary"
                      : "Generate AI Summary"}
                  </>
                )}
              </button>
            </div>
          )}

          {/* Tabs Content Area */}
          <div className="flex-1 p-4 sm:p-6 overflow-y-auto max-h-[50vh] lg:max-h-[65vh]">
            {activeTab === "summary" ? (
              <div className="text-left space-y-4 max-w-none">
                {activeSession.summary ? (
                  <div className="prose dark:prose-invert text-xs sm:text-sm text-[var(--text)] leading-relaxed space-y-3 font-sans">
                    {activeSession.summary.split("\n\n").map((paragraph, idx) => {
                      const trimmed = paragraph.trim();
                      if (trimmed.startsWith("# ")) {
                        return (
                          <h1 key={idx} className="text-lg font-bold text-[var(--text)] border-b border-[var(--border)] pb-1.5 mt-2">
                            {trimmed.replace("# ", "")}
                          </h1>
                        );
                      }
                      if (trimmed.startsWith("## ")) {
                        return (
                          <h2 key={idx} className="text-sm font-bold text-[var(--primary)] mt-3 mb-1 uppercase tracking-wider">
                            {trimmed.replace("## ", "")}
                          </h2>
                        );
                      }
                      if (trimmed.startsWith("### ")) {
                        return (
                          <h3 key={idx} className="text-xs font-bold text-[var(--text)] mt-2">
                            {trimmed.replace("### ", "")}
                          </h3>
                        );
                      }
                      return (
                        <p key={idx} className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed whitespace-pre-line">
                          {trimmed}
                        </p>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-12 flex flex-col items-center justify-center text-[var(--text-muted)] space-y-3">
                    <FontAwesomeIcon icon={faWandMagicSparkles} className="text-2xl text-[var(--primary)] animate-pulse" />
                    <p className="text-xs font-bold text-[var(--text)]">No AI Summary Generated Yet</p>
                    <p className="text-[11px] text-center max-w-xs leading-relaxed">
                      Click the button below to generate a structured AI review summary with Google Gemini.
                    </p>
                    <button
                      onClick={handleGenerateSummary}
                      disabled={isGeneratingSummary}
                      className="mt-2 h-9 px-4 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-black font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <FontAwesomeIcon icon={faWandMagicSparkles} className="text-xs" /> Generate AI Summary
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {activeSession.conceptCards.length === 0 ? (
                  <div className="py-12 text-center text-[var(--text-muted)] flex flex-col items-center justify-center space-y-2">
                    <FontAwesomeIcon icon={faLightbulb} className="text-xl mb-1 text-[var(--border)]" />
                    <p className="text-xs font-semibold text-[var(--text)]">No Key Concepts Recorded</p>
                    <p className="text-[10px] text-center max-w-xs leading-relaxed">
                      No custom course keywords were triggered during this lecture session.
                    </p>
                  </div>
                ) : (
                  activeSession.conceptCards.map((card) => (
                    <div
                      key={card.id}
                      className="border border-[var(--border)] rounded-xl p-4 text-left bg-[var(--background)] space-y-2 hover:border-[var(--text-muted)] transition-colors"
                    >
                      <div className="flex justify-between items-center gap-2">
                        <h4 className="font-bold text-sm text-[var(--primary)] truncate">{card.concept}</h4>
                        <span className="text-[9px] font-mono text-[var(--text-muted)] shrink-0">
                          {new Date(card.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                        {card.definition}
                      </p>
                      {card.details && (
                        <div className="pt-2 border-t border-[var(--border)] text-[11px] text-[var(--text-muted)] leading-relaxed">
                          <strong className="text-[var(--text)]">Context: </strong> {card.details}
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
