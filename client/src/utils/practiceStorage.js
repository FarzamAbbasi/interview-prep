/**
 * IPP-1717: small things the Solve page remembers in this browser (localStorage).
 * localStorage can throw (private mode, blocked storage), so every call is wrapped.
 * Server-side progress (solved / attempts on every device) comes in IPP-1718.
 */
const read = (key, fallback) => {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
};
const write = (key, value) => {
  try {
    if (value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore: only a convenience
  }
};

const key = (kind, language, slug) => `ipp_${kind}_${language}_${slug}`;

// The code the user typed, per problem
export const loadCode = (language, slug) => read(key('code', language, slug), null);
export const saveCode = (language, slug, code) => write(key('code', language, slug), code);
export const clearCode = (language, slug) => write(key('code', language, slug), undefined);

// Failed submits (used to offer hints and the solution) and "solved" in this browser
export const loadStats = (language, slug) => read(key('stats', language, slug), { fails: 0, solved: false });
export const saveStats = (language, slug, stats) => write(key('stats', language, slug), stats);

// Editor font size (all problems)
export const loadFontSize = () => read('ipp_editor_font', 14);
export const saveFontSize = (size) => write('ipp_editor_font', size);
