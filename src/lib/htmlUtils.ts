/**
 * Decode HTML entities and clean up HTML tags for display
 * Works without DOM (pure string manipulation)
 */
export function decodeHtmlEntities(text: string): string {
  if (!text) return '';
  
  let decoded = text;
  
  // Decode named HTML entities
  const namedEntities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&apos;': "'",
    '&nbsp;': ' ',
    '&eacute;': 'é',
    '&egrave;': 'è',
    '&agrave;': 'à',
    '&ugrave;': 'ù',
    '&ocirc;': 'ô',
    '&ecirc;': 'ê',
    '&acirc;': 'â',
    '&icirc;': 'î',
    '&ucirc;': 'û',
    '&ccedil;': 'ç',
    '&euml;': 'ë',
    '&iuml;': 'ï',
    '&uuml;': 'ü',
    '&ouml;': 'ö',
    '&auml;': 'ä',
    '&Eacute;': 'É',
    '&Egrave;': 'È',
    '&Agrave;': 'À',
    '&Ccedil;': 'Ç',
    '&deg;': '°',
    '&euro;': '€',
    '&laquo;': '«',
    '&raquo;': '»',
    '&ndash;': '–',
    '&mdash;': '—',
    '&hellip;': '…',
    '&rsquo;': "'",
    '&lsquo;': "'",
    '&rdquo;': '"',
    '&ldquo;': '"',
  };
  
  // Replace named entities
  for (const [entity, char] of Object.entries(namedEntities)) {
    decoded = decoded.split(entity).join(char);
  }
  
  // Decode numeric entities (&#39; &#160; etc.)
  decoded = decoded.replace(/&#(\d+);/g, (_, code) => {
    return String.fromCharCode(parseInt(code, 10));
  });
  
  // Decode hex entities (&#x27; etc.)
  decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (_, code) => {
    return String.fromCharCode(parseInt(code, 16));
  });
  
  // Replace HTML tags with appropriate text
  decoded = decoded
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<[^>]+>/g, ''); // Remove any remaining HTML tags
  
  // Clean up extra whitespace
  decoded = decoded
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  
  return decoded;
}

/**
 * Decode HTML entities for a single line (no line breaks)
 */
export function decodeHtmlLine(text: string): string {
  if (!text) return '';
  
  const decoded = decodeHtmlEntities(text);
  return decoded.replace(/\n+/g, ' ').trim();
}