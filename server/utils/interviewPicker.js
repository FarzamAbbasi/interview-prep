/**
 * IPP-1724: picks the questions of an Interview Mode round.
 * Pure functions (no database), so the rules are easy to read and change.
 *
 *   Level    Q&A slots (first 3 when the language has coding, else 4)   Coding
 *   junior   easy, easy, medium, easy                                   easy
 *   mid      easy, medium, hard, medium                                 medium
 *   senior   medium, hard, hard, medium                                 hard
 *
 * A missing difficulty falls back to the nearest one. Inside a difficulty the picker prefers
 * a topic not used yet in this round and a question not seen in the user's last rounds.
 */
const LEVELS = {
  junior: { qa: ['easy', 'easy', 'medium', 'easy'], coding: 'easy' },
  mid: { qa: ['easy', 'medium', 'hard', 'medium'], coding: 'medium' },
  senior: { qa: ['medium', 'hard', 'hard', 'medium'], coding: 'hard' },
};

const QA_SECONDS = 180;
const CODING_SECONDS = 600;

const NEAREST = {
  easy: ['easy', 'medium', 'hard'],
  medium: ['medium', 'easy', 'hard'],
  hard: ['hard', 'medium', 'easy'],
};
const LEVEL_ORDER = { easy: 0, medium: 1, hard: 2 };

function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Lowest penalty wins; the pool is shuffled first, so equal penalties are random
function pickBest(pool, penaltyOf) {
  let best = null;
  let bestPenalty = Infinity;
  for (const item of pool) {
    const p = penaltyOf(item);
    if (p < bestPenalty) {
      best = item;
      bestPenalty = p;
    }
  }
  return best;
}

/**
 * pool: [{ _id, topic, difficulty }]  (active Q&A questions the user may open)
 * recentIds: Set of question ids from the user's last rounds
 * Returns the picked pool items, easiest first (a warm-up, like a real interview).
 */
function pickQuestions(pool, level, count, recentIds = new Set()) {
  const slots = LEVELS[level].qa.slice(0, count);
  const left = shuffle(pool);
  const usedTopics = new Set();
  const picked = [];

  for (const wanted of slots) {
    const best = pickBest(left, (q) => {
      const diffRank = NEAREST[wanted].indexOf(q.difficulty);
      return (diffRank < 0 ? 3 : diffRank) * 4 + (usedTopics.has(q.topic) ? 2 : 0) + (recentIds.has(String(q._id)) ? 1 : 0);
    });
    if (!best) break; // fewer questions than slots
    picked.push(best);
    usedTopics.add(best.topic);
    left.splice(left.indexOf(best), 1);
  }

  return picked.sort((a, b) => LEVEL_ORDER[a.difficulty] - LEVEL_ORDER[b.difficulty]);
}

/**
 * pool: [{ _id, difficulty }]  (active problems the user may open)
 * seenIds: Set of problem ids already solved or used in the last rounds
 */
function pickProblem(pool, level, seenIds = new Set()) {
  const wanted = LEVELS[level].coding;
  return pickBest(shuffle(pool), (p) => {
    const diffRank = NEAREST[wanted].indexOf(p.difficulty);
    return (diffRank < 0 ? 3 : diffRank) * 2 + (seenIds.has(String(p._id)) ? 1 : 0);
  });
}

// Q&A count of a round: 3 + coding, or 4 without coding
const qaCountFor = (hasCoding) => (hasCoding ? 3 : 4);

module.exports = { LEVELS, QA_SECONDS, CODING_SECONDS, pickQuestions, pickProblem, qaCountFor };
