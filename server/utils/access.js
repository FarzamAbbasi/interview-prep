/**
 * Who can open what (same rule everywhere).
 * IPP-1704: full access can be for ALL languages or only SOME:
 *   user.isPaid = true + accessScope 'all' (or not set, older users)  -> every language, also ones added later
 *   user.isPaid = true + accessScope 'some' + paidLanguages [ids]     -> only those languages
 * Admins can open everything. Languages without access follow the free rule (first topic only, IPP-1607).
 */
const idOf = (value) => String(value?._id || value);

// Every language (paid "all" or admin)
const hasFullAccess = (user) =>
  Boolean(user && (user.role === 'admin' || (user.isPaid && user.accessScope !== 'some')));

// At least one language unlocked (bookmarks need this)
const hasAnyAccess = (user) =>
  Boolean(user && (hasFullAccess(user) || (user.isPaid && (user.paidLanguages || []).length > 0)));

// This language unlocked?
const hasLanguageAccess = (user, languageId) =>
  Boolean(
    user &&
      (hasFullAccess(user) ||
        (user.isPaid && (user.paidLanguages || []).some((id) => idOf(id) === idOf(languageId))))
  );

module.exports = { hasFullAccess, hasAnyAccess, hasLanguageAccess, idOf };
