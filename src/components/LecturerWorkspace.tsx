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
} from "@fortawesome/free-solid-svg-icons";
import { useSpeechToText } from "../hooks/useSpeechToText";
import { Navbar } from "./Navbar";
import { Loader } from "./Loader";

export const LecturerWorkspace: React.FC = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  // State
  const [showTerminateModal, setShowTerminateModal] = useState(false);
  const [customText, setCustomText] = useState("");
  const [audioLevel, setAudioLevel] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sessionKeyword, setSessionKeyword] = useState("");
  const [sessionAliases, setSessionAliases] = useState("");
  const [sessionDefinition, setSessionDefinition] = useState("");

  // Refs
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Application Context
  const {
    activeSession,
    setActiveSession,
    loadSessionDetails,
    isRecording,
    toggleRecording,
    endSession,
    addMockTranscriptLine,
    addSessionVocab,
    isPlaceholder,
  } = useSignBridge();

  const sessionKeywords = activeSession?.customVocab?.map((v) => v.keyword) || [];

  // AssemblyAI Real-Time Streaming Hook
  const {
    interimTranscript,
    startListening,
    stopListening,
    connectionStatus,
    hasAssemblyAIKey,
  } = useSpeechToText({
    onFinalResult: (rawText) => {
      // Instantly broadcast AssemblyAI speech captions directly to students (sub-300ms latency)
      addMockTranscriptLine(rawText);
    },
    keywords: sessionKeywords,
  });

  // Sync speech engine with recording toggle state
  useEffect(() => {
    if (isRecording) {
      startListening();
    } else {
      stopListening();
    }
  }, [isRecording, startListening, stopListening]);

  // Load session from URL param if activeSession is missing or mismatched
  useEffect(() => {
    if (sessionId && (!activeSession || activeSession.id !== sessionId)) {
      setLoading(true);
      loadSessionDetails(sessionId).then((session) => {
        if (session) {
          setActiveSession(session);
        } else {
          navigate("/dashboard");
        }
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [sessionId, activeSession?.id]);

  // Web Audio volume analyzer for responsive waveform UI
  useEffect(() => {
    let canceled = false;

    const stopAudioAnalysis = () => {
      canceled = true;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => track.stop());
        audioStreamRef.current = null;
      }
      if (audioContextRef.current) {
        const ctx = audioContextRef.current;
        audioContextRef.current = null;
        try {
          if (ctx.state !== "closed") {
            ctx.close().catch(() => {});
          }
        } catch (_) {}
      }
      setAudioLevel(0);
    };

    if (isRecording) {
      const startAudioAnalysis = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          if (canceled) {
            stream.getTracks().forEach((track) => track.stop());
            return;
          }
          audioStreamRef.current = stream;

          const AudioContextClass =
            window.AudioContext || (window as any).webkitAudioContext;
          const audioContext = new AudioContextClass();
          if (canceled) {
            try {
              audioContext.close().catch(() => {});
            } catch (_) {}
            stream.getTracks().forEach((track) => track.stop());
            return;
          }
          audioContextRef.current = audioContext;

          const source = audioContext.createMediaStreamSource(stream);
          const analyser = audioContext.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);

          const bufferLength = analyser.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);

          const updateVolume = () => {
            if (canceled || !audioContextRef.current) return;
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
              sum += dataArray[i];
            }
            const average = sum / bufferLength;
            const scaled = Math.min(100, Math.round((average / 255) * 400));
            setAudioLevel(scaled);
            animationFrameRef.current = requestAnimationFrame(updateVolume);
          };

          updateVolume();
        } catch (e) {
          console.warn("Microphone access for volume analyzer denied:", e);
        }
      };

      startAudioAnalysis();
    } else {
      stopAudioAnalysis();
    }

    return () => {
      stopAudioAnalysis();
    };
  }, [isRecording]);

  // Auto-scroll transcript log
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSession?.transcript]);

  // Add custom keyterm to AssemblyAI bias list
  const handleAddSessionTerm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionKeyword.trim() || !sessionDefinition.trim()) return;

    await addSessionVocab({
      keyword: sessionKeyword.trim(),
      aliases: sessionAliases.trim() || undefined,
      definition: sessionDefinition.trim(),
      details: "Added during live lecture.",
    });

    setSessionKeyword("");
    setSessionAliases("");
    setSessionDefinition("");
  };

  const handleSendCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customText.trim()) return;
    addMockTranscriptLine(customText.trim());
    setCustomText("");
  };

  const handleEndSession = async () => {
    const summaryId = await endSession();
    if (summaryId) {
      navigate(`/review/${summaryId}`);
    } else {
      navigate("/dashboard");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)] text-[var(--text)]">
        <Loader label="Loading classroom broadcast..." />
      </div>
    );
  }

  if (!activeSession) return null;

  return (
    <div className="min-h-screen pt-12 bg-[var(--background)] text-[var(--text)] transition-colors duration-150">
      {/* Navbar Header */}
      <Navbar
        variant="workspace"
        contextLabel={activeSession.title}
        onBack={() => setShowTerminateModal(true)}
      />

      {/* Demo Alert */}
      {isPlaceholder && (
        <div className="bg-yellow-500/10 border-b border-yellow-500/20 text-yellow-500 text-[10px] py-1.5 px-4 text-center font-mono">
          Demo Mode Active
        </div>
      )}

      {/* Top Workspace Bar */}
      <header className="border-b border-[var(--border)] bg-[var(--surface)] px-4 sm:px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleRecording}
            disabled={!hasAssemblyAIKey}
            className={`h-10 px-5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm disabled:opacity-50 ${
              isRecording
                ? "bg-red-500 hover:bg-red-600 text-white animate-pulse"
                : "bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-black"
            }`}
          >
            {isRecording ? (
              <>
                <FontAwesomeIcon icon={faMicrophoneSlash} className="text-xs" /> Pause Microphone
              </>
            ) : (
              <>
                <FontAwesomeIcon icon={faMicrophone} className="text-xs" /> Start Speaking
              </>
            )}
          </button>

          {/* Audio Wave Volume Meter */}
          <div className="h-10 flex items-center gap-1 px-3 border border-[var(--border)] rounded-xl bg-[var(--background)]">
            {isRecording ? (
              Array.from({ length: 10 }).map((_, i) => {
                const height = Math.max(
                  8,
                  Math.sin(i * 0.6) * audioLevel * 0.4 + audioLevel * 0.4
                );
                return (
                  <div
                    key={i}
                    className="w-1 rounded-full bg-[var(--primary)] transition-all duration-150"
                    style={{ height: `${height}%` }}
                  />
                );
              })
            ) : (
              Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="w-1 h-1 rounded-full bg-[var(--border)]" />
              ))
            )}
          </div>
        </div>

        {/* Engine Connection Status */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-[var(--text-muted)] flex items-center gap-1.5 border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 rounded-lg">
            <FontAwesomeIcon icon={faRadio} className={`text-[12px] ${connectionStatus === "connected" ? "text-[var(--primary)] animate-pulse" : "text-yellow-500"}`} />
            {connectionStatus === "connected"
              ? "Connected & Live"
              : connectionStatus === "connecting"
              ? "Connecting..."
              : "Offline"}
          </span>
          <button
            onClick={() => setShowTerminateModal(true)}
            className="h-9 px-3 text-[10px] font-bold border border-red-500/30 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-colors cursor-pointer flex items-center gap-1"
          >
            <FontAwesomeIcon icon={faRightFromBracket} className="text-[12px]" /> End Lecture
          </button>
        </div>
      </header>

      {/* Main Workspace Body */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (8/12): Live Transcript Feed */}
        <div className="lg:col-span-8 space-y-4">
          <div className="border border-[var(--border)] rounded-2xl bg-[var(--surface)] p-5 sm:p-6 text-left flex flex-col min-h-[560px] shadow-sm">
            <div className="border-b border-[var(--border)] pb-3 mb-4 flex items-center justify-between">
              <h2 className="text-xs font-bold tracking-wider uppercase text-[var(--text-muted)] flex items-center gap-2">
                <FontAwesomeIcon icon={faBookOpen} className="text-xs text-[var(--primary)]" />
                Live Broadcast Transcript Stream ({activeSession.transcript?.length || 0} Paragraphs)
              </h2>
              <span className="text-[10px] font-mono text-[var(--text-muted)]">
                Broadcasts live to all connected students
              </span>
            </div>

            {/* Transcript Stream List */}
            <div className="flex-1 overflow-y-auto max-h-[55vh] space-y-4 pr-1">
              {activeSession.transcript?.length === 0 && !interimTranscript ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-20 text-[var(--text-muted)] space-y-2">
                  <FontAwesomeIcon icon={faWifi} className="text-2xl animate-pulse text-[var(--primary)]" />
                  <p className="font-bold text-xs text-[var(--text)]">Microphone Stream Ready</p>
                  <p className="text-[10px] max-w-xs leading-relaxed">
                    Click "Start Broadcast" above to begin captioning your lecture live for connected students.
                  </p>
                </div>
              ) : (
                <>
                  {activeSession.transcript?.map((line) => (
                    <div
                      key={line.id}
                      className="p-4 border border-[var(--border)] rounded-2xl bg-[var(--background)] space-y-2 transition-all animate-fade-in text-left"
                    >
                      <div className="flex items-center justify-between border-b border-[var(--border)]/50 pb-1.5">
                        <span className="text-[10px] font-mono text-[var(--text-muted)] flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] inline-block"></span>
                          {new Date(line.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="text-sm sm:text-base text-[var(--text)] leading-relaxed font-sans">{line.text}</p>
                    </div>
                  ))}

                  {/* Real-Time Live Speech Interim Drafting Line */}
                  {interimTranscript && (
                    <div className="p-4 border border-dashed border-[var(--primary)]/50 bg-[var(--primary)]/5 rounded-2xl space-y-1.5 animate-pulse text-left">
                      <span className="text-[9px] font-mono text-[var(--primary)] font-bold block uppercase tracking-wider">
                        Live Speech Stream Draft...
                      </span>
                      <p className="text-sm text-[var(--text)] italic leading-relaxed">
                        {interimTranscript}
                      </p>
                    </div>
                  )}
                </>
              )}
              <div ref={transcriptEndRef} />
            </div>

            {/* Custom Input */}
            <form onSubmit={handleSendCustom} className="mt-4 flex gap-2 pt-3 border-t border-[var(--border)]">
              <input
                type="text"
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                disabled={!isRecording}
                placeholder={isRecording ? "Type custom text to broadcast directly to students..." : "Microphone offline"}
                className="flex-1 text-xs px-3.5 py-2.5 border border-[var(--border)] rounded-xl bg-[var(--background)] text-[var(--text)] focus:outline-none focus:border-[var(--primary)] disabled:opacity-50 transition-colors"
              />
              <button
                type="submit"
                disabled={!isRecording || !customText.trim()}
                className="h-10 px-4 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-black font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                <FontAwesomeIcon icon={faPaperPlane} className="text-[13px]" /> Send
              </button>
            </form>
          </div>
        </div>

        {/* Right Column (4/12): AssemblyAI Keyterms Bias List */}
        <div className="lg:col-span-4 space-y-4">
          <div className="border border-[var(--border)] rounded-2xl bg-[var(--surface)] p-5 sm:p-6 text-left space-y-4 shadow-sm min-h-[560px]">
            <div className="border-b border-[var(--border)] pb-3">
              <h3 className="text-xs font-bold tracking-wider uppercase text-[var(--text)] flex items-center gap-2">
                <FontAwesomeIcon icon={faRadio} className="text-xs text-violet-400" />
                Course Vocabulary ({activeSession.customVocab?.length || 0})
              </h3>
              <p className="text-[10px] text-[var(--text-muted)] mt-1 leading-relaxed">
                Add key terms and definitions here so students can easily look up technical terms during class.
              </p>
            </div>

            {/* Add Keyterm Form */}
            <form onSubmit={handleAddSessionTerm} className="space-y-2.5">
              <input
                type="text"
                required
                placeholder="Keyterm (e.g. Mitochondria)"
                value={sessionKeyword}
                onChange={(e) => setSessionKeyword(e.target.value)}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--text)] text-xs focus:outline-none focus:border-[var(--primary)]"
              />
              <input
                type="text"
                placeholder="Aliases / Phonetics (optional)"
                value={sessionAliases}
                onChange={(e) => setSessionAliases(e.target.value)}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--text)] text-xs focus:outline-none focus:border-[var(--primary)]"
              />
              <textarea
                rows={2}
                required
                placeholder="Definition (e.g. Powerhouse of the cell)"
                value={sessionDefinition}
                onChange={(e) => setSessionDefinition(e.target.value)}
                className="w-full p-2.5 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--text)] text-xs focus:outline-none focus:border-[var(--primary)] resize-none font-sans"
              />
              <button
                type="submit"
                className="w-full h-9 bg-[var(--background)] border border-[var(--border)] hover:border-[var(--primary)] text-[var(--text)] font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <FontAwesomeIcon icon={faPlus} className="text-[13px]" /> Add Keyterm
              </button>
            </form>

            {/* Keyterm List */}
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1 border-t border-[var(--border)] pt-3">
              {activeSession.customVocab?.length === 0 ? (
                <p className="text-[10px] text-[var(--text-muted)] italic text-center py-4">
                  No vocabulary keyterms added yet.
                </p>
              ) : (
                activeSession.customVocab?.map((term, i) => (
                  <div
                    key={i}
                    className="p-3 border border-[var(--border)] rounded-lg bg-[var(--background)] space-y-1"
                  >
                    <span className="text-xs font-mono font-bold text-[var(--primary)] block">
                      {term.keyword}
                    </span>
                    <p className="text-[11px] text-[var(--text)] leading-normal">
                      {term.definition}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>

      {/* End Lecture Modal */}
      {showTerminateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="border border-[var(--border)] rounded-2xl bg-[var(--surface)] p-6 max-w-sm w-full space-y-4 shadow-xl text-left">
            <h3 className="text-base font-bold text-[var(--text)]">End Live Classroom Session?</h3>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              This will close the microphone stream and conclude the live caption feed for all connected students.
            </p>
            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => setShowTerminateModal(false)}
                className="flex-1 py-2.5 border border-[var(--border)] rounded-xl text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text)] transition-colors cursor-pointer"
              >
                Cancel
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
