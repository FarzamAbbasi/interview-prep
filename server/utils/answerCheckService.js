/**
 * IPP-1730: one AI answer check with the daily limit, shared by
 *   POST /api/answer-check                       (practice on the language pages, source "questions")
 *   POST /api/interview/:roundId/items/:i/check   (Interview Mode, source "interview")
 *
 *   const r = await runAnswerCheck({ user, question, answer, source });
 *   -> { verdict, points, usage: { kind, limit, used, remaining, plan } }
 * question = { _id, question, answer, language } (language id or populated). A failed AI call is not counted.
 */
const AnswerCheck = require('../models/AnswerCheck');
const AppError = require('./AppError');
const { checkAnswer, aiStatus } = require('./aiProvider');
const { dayKey, usageFor } = require('./answerCheckLimits');

async function runAnswerCheck({ user, question, answer, source }) {
  const usage = await usageFor(user, source);
  if (!aiStatus().configured || usage.limit === 0) {
    throw new AppError('Answer check is not available right now', 503, undefined, 'AI_NOT_CONFIGURED');
  }
  if (usage.remaining <= 0) {
    throw new AppError(
      usage.plan === 'free'
        ? `You've used today's ${usage.limit} free ${usage.kind} checks. They reset at midnight; full access gives more`
        : `You've used today's ${usage.limit} ${usage.kind} checks. They reset at midnight`,
      429,
      undefined,
      'ANSWER_CHECK_LIMIT'
    );
  }

  const result = await checkAnswer({ question: question.question, modelAnswer: question.answer, userAnswer: answer });
  await AnswerCheck.create({
    user: user._id,
    question: question._id,
    language: question.language?._id || question.language,
    verdict: result.verdict,
    source,
    day: dayKey(),
  });

  const used = usage.used + 1;
  return {
    verdict: result.verdict,
    points: result.points,
    usage: { kind: usage.kind, limit: usage.limit, used, remaining: Math.max(0, usage.limit - used), plan: usage.plan },
  };
}

module.exports = { runAnswerCheck };
