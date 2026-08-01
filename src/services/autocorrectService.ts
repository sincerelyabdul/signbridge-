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
};

/**
 * Auto-corrects a raw speech transcript string using phonetic matching
 * and lecturer-defined course vocabulary aliases.
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
        // Exact lower key mapping
        dictionary[key.toLowerCase()] = key;

        // Parse aliases if provided (e.g. "RAM, Random Access Memory, r a m")
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
    if (!wrong || wrong === target.toLowerCase()) {
      // Case fix only (e.g. "cpu" -> "CPU")
      const regex = new RegExp(`\\b${escapeRegex(wrong)}\\b`, "gi");
      corrected = corrected.replace(regex, target);
    } else {
      // Misspelling / phonetic fix (e.g. "moodle" -> "module", "c p u" -> "CPU")
      const regex = new RegExp(`\\b${escapeRegex(wrong)}\\b`, "gi");
      corrected = corrected.replace(regex, target);
    }
  });

  return corrected;
}

/** Utility to escape regex special characters */
function escapeRegex(str: string): string {
  return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
}
