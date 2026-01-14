/**
 * Decode HTML entities and clean up HTML tags for display
 * Works without DOM (pure string manipulation)
 */
export function decodeHtmlEntities(text: string): string {
  if (!text) return '';
  
  // Convert to string if not already
  let decoded = String(text);
  
  // First, replace HTML tags with appropriate text BEFORE decoding entities
  decoded = decoded
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<\/div>/gi, ' ')
    .replace(/<div[^>]*>/gi, '')
    .replace(/<\/span>/gi, '')
    .replace(/<span[^>]*>/gi, '')
    .replace(/<\/strong>/gi, '')
    .replace(/<strong>/gi, '')
    .replace(/<\/em>/gi, '')
    .replace(/<em>/gi, '')
    .replace(/<\/b>/gi, '')
    .replace(/<b>/gi, '')
    .replace(/<\/i>/gi, '')
    .replace(/<i>/gi, '')
    .replace(/<[^>]+>/g, ''); // Remove any remaining HTML tags
  
  // Decode named HTML entities (comprehensive list)
  const namedEntities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&apos;': "'",
    '&nbsp;': ' ',
    // French accents lowercase
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
    '&oacute;': 'ó',
    '&iacute;': 'í',
    '&uacute;': 'ú',
    '&ntilde;': 'ñ',
    '&oelig;': 'œ',
    '&aelig;': 'æ',
    // French accents uppercase
    '&Eacute;': 'É',
    '&Egrave;': 'È',
    '&Agrave;': 'À',
    '&Ccedil;': 'Ç',
    '&Ecirc;': 'Ê',
    '&Acirc;': 'Â',
    '&Icirc;': 'Î',
    '&Ocirc;': 'Ô',
    '&Ucirc;': 'Û',
    '&Euml;': 'Ë',
    '&Iuml;': 'Ï',
    '&Uuml;': 'Ü',
    '&Ouml;': 'Ö',
    '&Auml;': 'Ä',
    // Symbols
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
    '&copy;': '©',
    '&reg;': '®',
    '&trade;': '™',
    '&times;': '×',
    '&divide;': '÷',
    '&plusmn;': '±',
    '&frac12;': '½',
    '&frac14;': '¼',
    '&frac34;': '¾',
    '&sup2;': '²',
    '&sup3;': '³',
  };
  
  // Replace named entities (case sensitive)
  for (const [entity, char] of Object.entries(namedEntities)) {
    // Use global replace
    const regex = new RegExp(entity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    decoded = decoded.replace(regex, char);
  }
  
  // Decode numeric entities (&#39; &#160; etc.)
  decoded = decoded.replace(/&#(\d+);/g, (_, code) => {
    return String.fromCharCode(parseInt(code, 10));
  });
  
  // Decode hex entities (&#x27; etc.)
  decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (_, code) => {
    return String.fromCharCode(parseInt(code, 16));
  });
  
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