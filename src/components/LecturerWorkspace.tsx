import React, { useState, useEffect, useRef } from "react";
import { useSignBridge } from "../context/SignBridgeContext";
import { useNavigate, useParams } from "react-router-dom";
import { Mic, MicOff, LogOut, Send, ChevronDown, ChevronUp, WifiOff, Wifi, Loader2, AlertOctagon } from "lucide-react";
import { useSpeechToText } from "../hooks/useSpeechToText";



export const LecturerWorkspace: React.FC = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [showTerminateModal, setShowTerminateModal] = useState(false);

  const {
    activeSession,
    setActiveSession,
    loadSessionDetails,
    isRecording,
    toggleRecording,
    endSession,
    addMockTranscriptLine,
    clearActiveSession,
    addSessionVocab,
    isPlaceholder
  } = useSignBridge();

  const [customText, setCustomText] = useState("");
  const [audioLevel, setAudioLevel] = useState(0);
  const [loading, setLoading] = useState(true);
  const [controlsExpanded, setControlsExpanded] = useState(false);

  const sessionKeywords = activeSession?.customVocab?.map(v => v.keyword) || [];

  // Speech Recognition hook
  const {
    interimTranscript,
    startListening,
    stopListening,
    connectionStatus,
    hasDeepgramKey
  } = useSpeechToText({
    onFinalResult: (text) => {
      addMockTranscriptLine(text);
    },
    keywords: sessionKeywords
  });

  // Synchronize Speech recognition with recording state
  useEffect(() => {
    if (isRecording) {
      startListening();
    } else {
      stopListening();
    }
  }, [isRecording]);

  // Session Vocabulary Input States
  const [sessionKeyword, setSessionKeyword] = useState("");
  const [sessionAliases, setSessionAliases] = useState("");
  const [sessionDefinition, setSessionDefinition] = useState("");

  const handleAddSessionTerm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionKeyword.trim() || !sessionDefinition.trim()) return;

    await addSessionVocab({
      keyword: sessionKeyword.trim(),
      aliases: sessionAliases.trim() || undefined,
      definition: sessionDefinition.trim(),
      details: "Added dynamically during live session."
    });

    setSessionKeyword("");
    setSessionAliases("");
    setSessionDefinition("");
  };

  const transcriptEndRef = useRef<HTMLDivElement>(null);

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

  // Real Web Audio analyser for reactive UI waveform
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    let canceled = false;

    const stopAudioAnalysis = () => {
      canceled = true;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;
      }
      if (audioContextRef.current) {
        const ctx = audioContextRef.current;
        audioContextRef.current = null;
        try {
          if (ctx.state !== "closed") {
            ctx.close().catch(() => {});
          }
        } catch (_) { /* ignore */ }
      }
      setAudioLevel(0);
    };

    if (isRecording) {
      const startAudioAnalysis = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          if (canceled) {
            stream.getTracks().forEach(track => track.stop());
            return;
          }
          audioStreamRef.current = stream;

          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          const audioContext = new AudioContextClass();
          if (canceled) {
            try { audioContext.close().catch(() => {}); } catch (_) {}
            stream.getTracks().forEach(track => track.stop());
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
          console.warn("Could not access microphone for volume analyzer:", e);
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

  // Auto-scroll transcript log to bottom
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSession?.transcript]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)] text-[var(--text)]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-[var(--text-muted)] font-mono">Loading lecture gateway...</span>
        </div>
      </div>
    );
  }

  if (!activeSession) return null;

  const handleSendCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customText.trim()) return;
    addMockTranscriptLine(customText.trim());
    setCustomText("");
  };

  const handleEndSession = async () => {
    const id = await endSession();
    if (id) {
      navigate(`/review/${id}`);
    }
  };

  const handleExitPortal = () => {
    clearActiveSession();
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)] text-[var(--text)] transition-colors duration-150">
      {/* Header */}
      <header className="border-b border-[var(--border)] px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center bg-[var(--surface)] sticky top-0 z-30">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <span className="font-bold text-xl sm:text-2xl tracking-tight select-none shrink-0 flex items-baseline gap-1">
            <span>sign<span className="text-[var(--primary)]">bridge</span><span className="text-[var(--primary)] font-black text-2xl sm:text-3xl">.</span></span>
            <span className="text-xs font-normal text-[var(--text-muted)] ml-1 self-center hidden sm:inline">lecturer portal</span>
          </span>
          <span className="h-4 w-px bg-[var(--border)] hidden sm:block shrink-0"></span>
          <span className="text-xs text-[var(--text-muted)] truncate max-w-[120px] sm:max-w-xs hidden sm:block">{activeSession.title}</span>
        </div>
        <button
          onClick={handleExitPortal}
          className="h-9 px-3 border border-[var(--border)] rounded-lg hover:bg-red-500 hover:text-white hover:border-red-500 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <LogOut size={13} /> <span className="hidden sm:inline">Exit Portal</span>
        </button>
      </header>

      {/* Mobile: Session Code + Mic strip */}
      <div className="xl:hidden border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <span className="text-[9px] tracking-wider uppercase text-[var(--text-muted)] font-bold block">Session Code</span>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-mono font-bold text-[var(--text)] tracking-widest">
                {activeSession.code}
              </span>
              {isPlaceholder && (
                <span className="text-[8px] bg-yellow-500/15 border border-yellow-500/25 text-yellow-500 font-mono px-2 py-0.5 rounded uppercase font-semibold">
                  Offline
                </span>
              )}
            </div>
          </div>

          {/* Compact audio waveform */}
          <div className="h-10 flex items-center gap-0.5 px-3 border border-[var(--border)] rounded-lg bg-[var(--background)] shrink-0">
            {isRecording ? (
              Array.from({ length: 9 }).map((_, i) => {
                const height = Math.max(8, Math.sin(i * 0.6) * audioLevel * 0.4 + audioLevel * 0.4);
                return (
                  <div
                    key={i}
                    className="w-1 rounded-full bg-[var(--primary)] transition-all duration-150"
                    style={{ height: `${height}%` }}
                  ></div>
                );
              })
            ) : (
              Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="w-1 h-1 rounded-full bg-[var(--border)]"></div>
              ))
            )}
          </div>

          <button
            onClick={toggleRecording}
            className={`h-10 px-4 rounded-lg font-medium text-xs flex items-center gap-1.5 border transition-colors cursor-pointer shrink-0 ${
              isRecording
                ? "bg-red-500/10 text-red-500 border-red-500/20"
                : "bg-[var(--primary)] text-black border-transparent"
            }`}
          >
            {isRecording ? <MicOff size={14} /> : <Mic size={14} />}
            <span className="hidden xs:inline">{isRecording ? "Pause" : "Resume"}</span>
          </button>

          <button
            onClick={() => setControlsExpanded(v => !v)}
            className="h-10 w-10 flex items-center justify-center border border-[var(--border)] rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--background)] transition-colors cursor-pointer shrink-0"
            aria-label="Toggle controls"
          >
            {controlsExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {/* Expandable controls on mobile */}
        {controlsExpanded && (
          <div className="mt-3 pt-3 border-t border-[var(--border)] space-y-3 animate-slide-down">
            {/* Vocab quick-add */}
            <form onSubmit={handleAddSessionTerm} className="space-y-2">
              <span className="text-[9px] uppercase font-bold tracking-wider text-[var(--text-muted)] block">Quick Vocab Trigger</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  placeholder="Trigger"
                  value={sessionKeyword}
                  onChange={(e) => setSessionKeyword(e.target.value)}
                  className="flex-1 px-2.5 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--text)] text-xs focus:outline-none focus:border-[var(--primary)]"
                />
                <input
                  type="text"
                  placeholder="Aliases"
                  value={sessionAliases}
                  onChange={(e) => setSessionAliases(e.target.value)}
                  className="w-20 px-2.5 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--text)] text-xs focus:outline-none focus:border-[var(--primary)] font-mono"
                />
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  placeholder="Student Definition"
                  value={sessionDefinition}
                  onChange={(e) => setSessionDefinition(e.target.value)}
                  className="flex-1 px-2.5 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--text)] text-xs focus:outline-none focus:border-[var(--primary)]"
                />
                <button
                  type="submit"
                  className="h-9 px-3 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-black font-semibold rounded-lg text-xs transition-colors cursor-pointer shrink-0"
                >
                  Add
                </button>
              </div>
            </form>
            {/* Terminate Class session */}
            <button
              onClick={() => setShowTerminateModal(true)}
              className="w-full bg-red-500/10 hover:bg-red-500 border border-red-500/20 hover:border-red-500 text-red-500 hover:text-white text-xs font-bold py-2.5 rounded-lg transition-colors cursor-pointer text-center flex items-center justify-center gap-1.5"
            >
              <AlertOctagon size={14} /> Terminate Class Session
            </button>
          </div>
        )}
      </div>

      {/* Main Grid — Desktop */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-5 sm:py-8 grid grid-cols-1 xl:grid-cols-4 gap-5 sm:gap-6 items-start">

        {/* Left Column (1/4): Session Details & Microphone Controls — desktop only */}
        <div className="hidden xl:flex xl:col-span-1 flex-col gap-6 h-full">
          <div className="space-y-6">
            {/* Session Info */}
            <div className="border border-[var(--border)] rounded-xl bg-[var(--surface)] p-5 text-left space-y-3">
              <div className="flex justify-between items-start w-full">
                <div>
                  <span className="text-[10px] tracking-wider uppercase text-[var(--text-muted)] block font-bold">Session Code</span>
                  <span className="text-3xl font-mono font-bold text-[var(--text)] tracking-wider block mt-1">
                    {activeSession.code}
                  </span>
                </div>
                {isPlaceholder && (
                  <span className="text-[8px] bg-yellow-500/15 border border-yellow-500/25 text-yellow-500 font-mono px-2 py-0.5 rounded uppercase font-semibold">
                    Offline Simulator
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                Provide this 6-digit code to students. They will instantly receive your live audio transcripts and visual concept cards.
              </p>
            </div>

            {/* Mic Controls & Indicator */}
            <div className="border border-[var(--border)] rounded-xl bg-[var(--surface)] p-5 text-left space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-xs tracking-wider uppercase text-[var(--text-muted)]">
                  Audio Gateway
                </h3>
                {/* Deepgram connection badge */}
                {isRecording && (
                  <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border flex items-center gap-1 ${
                    connectionStatus === "connected"
                      ? "bg-[var(--primary)]/10 border-[var(--primary)]/25 text-[var(--primary)]"
                      : connectionStatus === "error"
                      ? "bg-red-500/10 border-red-500/25 text-red-500"
                      : "bg-yellow-500/10 border-yellow-500/25 text-yellow-500"
                  }`}>
                    {connectionStatus === "connected" && <><Wifi size={8} /> Live</>}
                    {connectionStatus === "connecting" && <><Loader2 size={8} className="animate-spin" /> Connecting</>}
                    {connectionStatus === "reconnecting" && <><Loader2 size={8} className="animate-spin" /> Reconnecting</>}
                    {connectionStatus === "error" && <><WifiOff size={8} /> Error</>}
                  </span>
                )}
              </div>

              {/* No key warning */}
              {!hasDeepgramKey && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg text-[10px] leading-relaxed flex gap-2 items-start">
                  <WifiOff size={13} className="mt-0.5 shrink-0" />
                  <span>No Deepgram key found. Add <code className="font-mono">VITE_DEEPGRAM_API_KEY</code> to your <code>.env</code> file.</span>
                </div>
              )}

              {/* Audio Wave Indicator */}
              <div className="h-16 flex items-center justify-center gap-1 border border-[var(--border)] rounded-lg bg-[var(--background)] px-4">
                {isRecording && connectionStatus === "connected" ? (
                  Array.from({ length: 15 }).map((_, i) => {
                    const height = Math.max(
                      8,
                      Math.sin(i * 0.5) * audioLevel * 0.5 + audioLevel * 0.5
                    );
                    return (
                      <div
                        key={i}
                        className="w-1.5 rounded-full bg-[var(--primary)] transition-all duration-150"
                        style={{ height: `${height}%` }}
                      ></div>
                    );
                  })
                ) : isRecording && connectionStatus !== "connected" ? (
                  <span className="text-xs text-yellow-500 font-mono animate-pulse">Connecting to Deepgram...</span>
                ) : (
                  <span className="text-xs text-[var(--text-muted)]">Microphone is offline</span>
                )}
              </div>

              {/* Mic Toggle */}
              <button
                onClick={toggleRecording}
                disabled={!hasDeepgramKey}
                className={`w-full py-2.5 rounded-lg font-medium text-xs flex items-center justify-center gap-2 border transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  isRecording
                    ? "bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20"
                    : "bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-black border-transparent"
                }`}
              >
                {isRecording ? (
                  <><MicOff size={14} /> Pause Transcribing</>
                ) : (
                  <><Mic size={14} /> Resume Transcribing</>
                )}
              </button>
            </div>
          </div>

          {/* End Session Button */}
          <div className="mt-auto pt-2">
            <button
              onClick={() => setShowTerminateModal(true)}
              className="w-full bg-red-500/10 hover:bg-red-500 border border-red-500/20 hover:border-red-500 text-red-500 hover:text-white text-xs font-bold py-3 rounded-xl transition-colors cursor-pointer text-center flex items-center justify-center gap-2"
            >
              <AlertOctagon size={15} /> Terminate Class Session
            </button>
          </div>
        </div>

        {/* Center Column (2/4): Live Log Capture */}
        <div className="xl:col-span-2 flex flex-col gap-5 h-full">
          <div className="border border-[var(--border)] rounded-xl bg-[var(--surface)] p-4 sm:p-5 text-left flex-1 flex flex-col min-h-[350px] sm:min-h-[450px] xl:min-h-[550px]">
            <h3 className="font-bold text-xs tracking-wider uppercase text-[var(--text-muted)] mb-4">
              Real-time Capture Log
            </h3>

            {/* Scrollable Log */}
            <div className="flex-1 overflow-y-auto border border-[var(--border)] rounded-lg bg-[var(--background)] p-4 space-y-4 max-h-[40vh] sm:max-h-[50vh] xl:max-h-[450px]">
              {activeSession.transcript.length === 0 && !interimTranscript ? (
                <div className="h-full flex flex-col items-center justify-center text-[var(--text-muted)] py-12">
                  <Mic size={28} className="mb-2 stroke-1 text-[var(--text-muted)]" />
                  <p className="text-xs font-semibold">No speech captured yet.</p>
                  <p className="text-[10px] mt-1 text-center max-w-xs leading-relaxed">Type below or speak into your microphone to send lines.</p>
                </div>
              ) : (
                <>
                  {activeSession.transcript.map((line) => (
                    <div key={line.id} className="text-sm leading-relaxed border-b border-[var(--border)] pb-2 last:border-b-0 animate-fade-in">
                      <span className="text-[9px] font-mono text-[var(--text-muted)] block">
                        {new Date(line.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      <p className="text-[var(--text)] mt-0.5">{line.text}</p>
                    </div>
                  ))}

                  {/* Live speech interim drafting line */}
                  {interimTranscript && (
                    <div className="text-sm leading-relaxed pb-2 opacity-65 animate-pulse">
                      <span className="text-[9px] font-mono text-[var(--text-muted)] block">Drafting...</span>
                      <p className="text-[var(--text)] mt-0.5 italic">{interimTranscript}</p>
                    </div>
                  )}
                </>
              )}
              <div ref={transcriptEndRef} />
            </div>

            {/* Custom Input */}
            <form onSubmit={handleSendCustom} className="mt-4 flex gap-2">
              <input
                type="text"
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                disabled={!isRecording}
                placeholder={isRecording ? "Type custom speech input here..." : "Microphone paused"}
                className="flex-1 text-xs px-3 py-2.5 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--text)] focus:outline-none focus:border-[var(--primary)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              />
              <button
                type="submit"
                disabled={!isRecording || !customText.trim()}
                className="h-10 w-10 flex items-center justify-center bg-[var(--text)] hover:bg-[var(--text-muted)] disabled:opacity-40 text-[var(--background)] rounded-lg transition-colors disabled:cursor-not-allowed cursor-pointer shrink-0"
              >
                <Send size={14} />
              </button>
            </form>
          </div>
        </div>

        {/* Right Column (1/4): Vocabulary Management — desktop only */}
        <div className="hidden xl:block xl:col-span-1 h-full">
          <div className="border border-[var(--border)] rounded-xl bg-[var(--surface)] p-5 text-left space-y-4">
            <h3 className="font-bold text-xs tracking-wider uppercase text-[var(--text-muted)] flex justify-between items-center">
              <span>Session Vocabulary</span>
              <span className="text-[10px] font-mono text-[var(--text-muted)] bg-[var(--background)] px-1.5 py-0.5 rounded border border-[var(--border)] font-semibold">
                {activeSession.customVocab?.length || 0} active
              </span>
            </h3>

            {/* Form to add term */}
            <form onSubmit={handleAddSessionTerm} className="space-y-2 border-b border-[var(--border)] pb-4 pt-1">
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  placeholder="Trigger"
                  value={sessionKeyword}
                  onChange={(e) => setSessionKeyword(e.target.value)}
                  className="flex-1 px-2.5 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--text)] text-xs focus:outline-none focus:border-[var(--primary)]"
                />
                <input
                  type="text"
                  placeholder="Aliases"
                  value={sessionAliases}
                  onChange={(e) => setSessionAliases(e.target.value)}
                  className="w-20 px-2.5 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--text)] text-xs focus:outline-none focus:border-[var(--primary)] font-mono"
                />
              </div>
              <input
                type="text"
                required
                placeholder="Student Definition"
                value={sessionDefinition}
                onChange={(e) => setSessionDefinition(e.target.value)}
                className="w-full px-2.5 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--text)] text-xs focus:outline-none focus:border-[var(--primary)]"
              />
              <button
                type="submit"
                className="w-full bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-black font-semibold py-2 rounded-lg text-[10px] transition-colors cursor-pointer"
              >
                + Add Active Trigger
              </button>
            </form>

            {/* Scrollable list of active terms */}
            <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
              {(!activeSession.customVocab || activeSession.customVocab.length === 0) ? (
                <p className="text-[10px] text-[var(--text-muted)] italic py-2">
                  No vocabulary triggers active. Add baseline keywords in Settings or add a temporary one above.
                </p>
              ) : (
                activeSession.customVocab.map((term, idx) => (
                  <div key={idx} className="p-2.5 border border-[var(--border)] rounded-lg bg-[var(--background)] text-xs hover:border-[var(--text-muted)] transition-colors">
                    <div className="flex justify-between items-baseline flex-wrap gap-1">
                      <strong className="text-[var(--text)] font-mono">{term.keyword}</strong>
                      {term.aliases && (
                        <span className="text-[8px] text-[var(--text-muted)] font-mono">({term.aliases})</span>
                      )}
                    </div>
                    <p className="text-[9px] text-[var(--text-muted)] mt-1 leading-relaxed">{term.definition}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Terminate Class Confirmation Modal */}
      {showTerminateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl max-w-md w-full p-6 text-left space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-red-500">
              <div className="p-2.5 rounded-full bg-red-500/10 border border-red-500/20">
                <AlertOctagon size={20} />
              </div>
              <h3 className="font-bold text-lg text-[var(--text)]">Terminate Class Session?</h3>
            </div>

            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              This will permanently end the live speech-to-text feed for all connected students, save the final transcript, and generate an AI summary.
            </p>
            <p className="text-[11px] text-[var(--text-muted)] font-medium italic">
              Note: Pausing audio or closing your browser tab does NOT terminate a class. Only confirming termination here will end this lecture.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowTerminateModal(false)}
                className="px-4 py-2.5 border border-[var(--border)] rounded-lg text-xs font-semibold hover:bg-[var(--background)] transition-colors cursor-pointer"
              >
                Cancel (Keep Class Live)
              </button>
              <button
                onClick={() => {
                  setShowTerminateModal(false);
                  handleEndSession();
                }}
                className="px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <AlertOctagon size={14} /> Terminate Class
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
