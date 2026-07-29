// Deprecated - Gemini intelligence layer removed in favor of pure AssemblyAI Real-Time STT.
export const useGeminiIntelligence = () => {
  return {
    ingestRawLine: () => {},
    aiStatus: "idle" as const,
    lastProcessedTime: null,
    resetSessionMemory: () => {},
    isProcessing: false,
  };
};
