// "C++" -> "c-plus-plus", "Web & Security" -> "web-security"
module.exports = function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/\+/g, '-plus')
    .replace(/#/g, '-sharp')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};
