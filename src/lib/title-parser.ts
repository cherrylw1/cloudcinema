export interface ParsedTitle {
  cleanTitle: string;
  year?: string;
}

export function parseAndCleanTitle(title: string): ParsedTitle {
  // Replace dots, underscores, and dashes with spaces
  let name = title.replace(/[._\-]/g, " ").trim();

  // Extract 4-digit release year if present
  const yearMatch = name.match(/\b(19\d{2}|20\d{2})\b/);
  let year: string | undefined = undefined;

  if (yearMatch) {
    year = yearMatch[1];
    // Remove the year and everything after it from the search query to improve matching
    const index = name.indexOf(year);
    if (index !== -1) {
      name = name.substring(0, index).trim();
    }
  }

  // Clean tags and quality patterns
  const tags = [
    /\b\d{3,4}p\b/i,                     // 1080p, 720p, 2160p
    /\b[xH]\.?26[45]\b/i,                // x264, x265, H.264, H264, H265
    /\bHEVC\b/i,                         // HEVC
    /\bWEB-?DL\b/i,                      // WEB-DL
    /\bBlu-?Ray\b/i,                     // BluRay, Blu-ray
    /\bHDTV\b/i,                         // HDTV
    /\bWEBRip\b/i,                       // WEBRip
    /\bHDR\b/i,                          // HDR
    /\bAAC(\d(?:\.\d)?)?\b/i,            // AAC
    /\bDD(?:\+)?\d\.\d\b/i,              // DD5.1, DD+5.1
    /\bDTS\b/i,                          // DTS
    /\b\d\.\d\b/i,                       // 5.1
    /\b10bit\b/i,                        // 10bit
    /\bS\d{2}E\d{2,3}\b/i,               // SxxExx
  ];

  for (const tag of tags) {
    name = name.replace(tag, "");
  }

  // Remove bracketed info (e.g. [QxR] or [YTS])
  name = name.replace(/[\[\({].*?[\]\)}]/g, "").trim();

  // Strip trailing release group signatures (e.g. -PSA, -YTS)
  name = name.replace(/\s*-\s*[a-zA-Z0-9]+$/, "").trim();

  // Clean up duplicate spaces
  name = name.replace(/\s+/g, " ").trim();

  return {
    cleanTitle: name || title,
    year,
  };
}
