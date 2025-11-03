/**
 * Safely strip HTML tags from a string using DOM APIs
 * @param {string} html - The HTML string to strip
 * @returns {string} - Plain text without HTML tags
 */
export const stripHtml = (html) => {
  if (typeof window === 'undefined') {
    // Server-side fallback (though this app is client-side only)
    return html ? html.replace(/<[^>]*>/g, '') : '';
  }
  
  const tmp = document.createElement('DIV');
  tmp.innerHTML = html || '';
  return tmp.textContent || tmp.innerText || '';
};
