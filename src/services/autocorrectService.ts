/**
 * Phonetic Auto-Correct & Speech Polishing Service
 *
 * Automatically corrects common speech-to-text mishearings, acoustic ambiguities,
 * and technical jargon mispronunciations in educational broadcasts.
 */

export interface VocabularyTerm {
  keyword: string;
  aliases?: string;
  definition?: string;
}

/** Dictionary of common academic & technical STT mishearings -> correct spelling */
const COMMON_ACADEMIC_CORRECTIONS: Record<string, string> = {
  moodle: "module",
  moduel: "module",
  moudle: "module",
  modue: "module",
  modul: "module",
  "c p u": "CPU",
  "see pee you": "CPU",
  "a l u": "ALU",
  "c u": "CU",
  "r a m": "RAM",
  "r o m": "ROM",
  "s q l": "SQL",
  sequel: "SQL",
  "h t t p": "HTTP",
  "h t m l": "HTML",
  "c s s": "CSS",
  "j s o n": "JSON",
  "a p i": "API",
  "g u i": "GUI",
  "i o": "I/O",
  "in out": "I/O",
  "os": "Operating System",
  "o s": "Operating System",
  "byte": "byte",
  "bit": "bit",
  "b y t e": "byte",
  "b i t": "bit",
  "algorhythm": "algorithm",
  "algo rithm": "algorithm",
  "pseudo code": "pseudocode",
  "so code": "pseudocode",
  "data base": "database",
  "dayta base": "database",
  "sub routine": "subroutine",
  "meta bolism": "metabolism",
  "metal bolism": "metabolism",
  "photo synthesis": "photosynthesis",
  "poly merase": "polymerase",
  "chromosom": "chromosome",
  "mitochondria": "mitochondria",
  "micro biology": "microbiology",
};

/** Levenshtein distance calculation for fuzzy phonetic term matching */
export function calcLevenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Auto-corrects a raw speech transcript string using phonetic matching,
 * Levenshtein fuzzy distance, and lecturer-defined course vocabulary aliases.
 */
export function autoCorrectLectureTranscript(
  text: string,
  customVocab: VocabularyTerm[] = []
): string {
  if (!text || !text.trim()) return text;

  let corrected = text;

  // 1. Build dictionary combining common corrections & lecturer custom terms
  const dictionary: Record<string, string> = { ...COMMON_ACADEMIC_CORRECTIONS };

  // 2. Add lecturer-defined custom vocabulary & aliases
  if (Array.isArray(customVocab)) {
    customVocab.forEach((term) => {
      if (term.keyword) {
        const key = term.keyword.trim();
        dictionary[key.toLowerCase()] = key;

        if (term.aliases) {
          const aliasesList = term.aliases.split(/[,;\n]+/);
          aliasesList.forEach((alias) => {
            const cleanAlias = alias.trim().toLowerCase();
            if (cleanAlias && cleanAlias !== key.toLowerCase()) {
              dictionary[cleanAlias] = key;
            }
          });
        }
      }
    });
  }

  // 3. Perform word-boundary replacement for each dictionary entry
  Object.keys(dictionary).forEach((wrong) => {
    const target = dictionary[wrong];
    const regex = new RegExp(`\\b${escapeRegex(wrong)}\\b`, "gi");
    corrected = corrected.replace(regex, target);
  });

  // 4. Fuzzy Levenshtein correction for unique custom terms (>4 chars) against individual words
  if (Array.isArray(customVocab) && customVocab.length > 0) {
    const customTargets = customVocab.map(v => v.keyword.trim()).filter(k => k.length >= 5);
    if (customTargets.length > 0) {
      const words = corrected.split(/\s+/);
      const fuzzyCorrectedWords = words.map((w) => {
        const cleanW = w.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
        if (cleanW.length < 5) return w;

        for (const target of customTargets) {
          const targetLower = target.toLowerCase();
          if (cleanW === targetLower) return w;
          const dist = calcLevenshteinDistance(cleanW, targetLower);
          // Allow 1 edit for 5-7 char words, 2 edits for 8+ char words
          const maxAllowedDist = target.length >= 8 ? 2 : 1;
          if (dist > 0 && dist <= maxAllowedDist) {
            return w.replace(new RegExp(cleanW, "i"), target);
          }
        }
        return w;
      });
      corrected = fuzzyCorrectedWords.join(" ");
    }
  }

  return corrected;
}

/** Utility to escape regex special characters */
function escapeRegex(str: string): string {
  return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
}
