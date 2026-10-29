/**
 * IPP-1725: the running interview round's place in this browser (sessionStorage),
 * so a refresh continues the same question with the same timer and the typed code.
 *   { roundId, step: { index, startedAt, revealed }, code }
 * Answers themselves are saved on the server after every question.
 * sessionStorage can be blocked, so every call is wrapped in try/catch.
 */
const KEY = 'ipp_interview_round';

function read() {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(value) {
  try {
    if (value) sessionStorage.setItem(KEY, JSON.stringify(value));
    else sessionStorage.removeItem(KEY);
  } catch {
    // ignore: the round still works, a refresh only restarts the current question's timer
  }
}

// Saved data of THIS round (a round of another account / older round is ignored)
export function loadRoundState(roundId) {
  const saved = read();
  return saved?.roundId === roundId ? saved : null;
}

export function saveRoundStep(roundId, step) {
  const saved = loadRoundState(roundId) || { roundId };
  write({ ...saved, step });
}

export function saveRoundCode(roundId, code) {
  const saved = loadRoundState(roundId) || { roundId };
  write({ ...saved, code });
}

export function clearRoundState() {
  write(null);
}
