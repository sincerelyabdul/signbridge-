/**
 * Browser-compatible DOCX text extractor.
 * Extracts all paragraph text from Word document XML structure safely without Node fs dependencies.
 */
export async function parseDocxArrayBuffer(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    // Dynamic import mammoth browser bundle to avoid Node fs bundling issues in Vite
    // @ts-ignore - mammoth browser bundle export
    const mammothModule = await import("mammoth/mammoth.browser.js");
    const mammoth = mammothModule.default || mammothModule;
    const result = await mammoth.extractRawText({ arrayBuffer });
    if (result.value && result.value.trim()) {
      return result.value.trim();
    }
  } catch (err) {
    console.warn("[FileParser] Mammoth browser import failed, using XML stream parser fallback:", err);
  }

  // Pure browser fallback: Decode binary text stream and extract <w:t> tags
  try {
    const decoder = new TextDecoder("utf-8", { fatal: false });
    const rawText = decoder.decode(arrayBuffer);
    return sanitizeDocxTextIfNeeded(rawText);
  } catch (_) {
    return "";
  }
}

/**
 * Extracts plain text from an uploaded file (.docx, .doc, .txt, .md, .json, .csv).
 */
export async function extractTextFromFile(file: File): Promise<string> {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith(".docx") || fileName.endsWith(".doc")) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const text = await parseDocxArrayBuffer(arrayBuffer);
      if (text) return text;
    } catch (e) {
      console.warn("[FileParser] ArrayBuffer extraction error:", e);
    }
  }

  // Standard text reading (.txt, .md, .json, .csv)
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const raw = (e.target?.result as string) || "";
      resolve(sanitizeDocxTextIfNeeded(raw));
    };
    reader.onerror = () => resolve("");
    reader.readAsText(file);
  });
}

/**
 * Sanitizes pasted raw text. If the user accidentally pastes raw binary/XML content
 * from a .docx file (e.g. containing [Content_Types].xml or <w:t> tags), it extracts
 * only the actual spoken words/paragraphs.
 */
export function sanitizeDocxTextIfNeeded(rawText: string): string {
  if (!rawText) return "";

  // Check if string contains raw Word XML markers
  if (
    rawText.includes("[Content_Types].xml") ||
    rawText.includes("word/document.xml") ||
    rawText.includes("<w:t") ||
    rawText.startsWith("PK")
  ) {
    const matches: string[] = [];
    // Match content inside <w:t>...</w:t> tags
    const regex = /<w:t[^>]*>(.*?)<\/w:t>/gi;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(rawText)) !== null) {
      if (match[1] && match[1].trim()) {
        matches.push(match[1].trim());
      }
    }

    if (matches.length > 0) {
      return matches.join(" ");
    }
  }

  return rawText;
}
