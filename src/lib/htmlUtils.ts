/**
 * Decode HTML entities and clean up HTML tags for display
 */
export function decodeHtmlEntities(text: string): string {
  if (!text) return '';
  
  // Create a temporary element to decode HTML entities
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  let decoded = textarea.value;
  
  // Replace common HTML tags with appropriate text
  decoded = decoded
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/&nbsp;/gi, ' ')
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