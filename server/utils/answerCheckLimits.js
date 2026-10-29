/**
 * IPP-1728: daily limits of the AI answer check. IPP-1729: two separate counts, so practice on the language
 * pages never uses up the checks for Interview Mode:
 *   practice  (source "questions", language pages)  default: free 2, paid 30
 *   interview (source "interview", Interview Mode)   default: free 4, paid 50
 * Limits live in Settings (key "answerCheckLimits") so the admin can change them. 0 = off for that group.
 * "paid" = full access to at least one language (IPP-1704), admins too.
 * The day follows Pakistan time, so the counts reset at midnight PKT.
 */
const Setting = require('../models/Setting');
const AnswerCheck = require('../models/AnswerCheck');
const { hasAnyAccess } = require('./access');

const KEY = 'answerCheckLimits';
const DEFAULT_LIMITS = { practice: { free: 2, paid: 30 }, interview: { free: 4, paid: 50 } }; // free 4: a whole round (up to 4 Q&A)
const MAX_LIMIT = 500;
const SOURCES = { questions: 'practice', interview: 'interview' }; // AnswerCheck.source -> limit group

// "2026-10-29" in Asia/Karachi
const dayKey = (date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(date);

async function getLimits() {
  const value = (await Setting.findOne({ key: KEY }).lean())?.value || {};
  // Saved before IPP-1729 as { free, paid }: that was the interview limit
  const old = typeof value.free === 'number' ? { free: value.free, paid: value.paid } : null;
  return {
    practice: { ...DEFAULT_LIMITS.practice, ...(value.practice || {}) },
    interview: { ...DEFAULT_LIMITS.interview, ...(old || value.interview || {}) },
  };
}

async function setLimits(limits) {
  const value = { practice: limits.practice, interview: limits.interview };
  await Setting.updateOne({ key: KEY }, { $set: { value } }, { upsert: true });
  return value;
}

const isPaidUser = (user) => hasAnyAccess(user);

// This user's limit, used and remaining today for one source ("questions" = practice, "interview")
async function usageFor(user, source = 'questions', limits) {
  const group = SOURCES[source] || 'practice';
  const all = limits || (await getLimits());
  const plan = isPaidUser(user) ? 'paid' : 'free';
  const limit = all[group][plan];
  const used = await AnswerCheck.countDocuments({ user: user._id, day: dayKey(), source });
  return { kind: group, limit, used, remaining: Math.max(0, limit - used), plan };
}

module.exports = { dayKey, getLimits, setLimits, usageFor, DEFAULT_LIMITS, MAX_LIMIT };
