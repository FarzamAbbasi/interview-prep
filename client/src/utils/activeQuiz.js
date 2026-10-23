/**
 * The quiz in progress, kept in sessionStorage so a page refresh does not lose it.
 * (Only questions and timing: correct answers are never sent before submit.)
 * sessionStorage can be blocked, so every call is wrapped in try/catch.
 */
const KEY = 'ipp_active_quiz';

export function saveActiveQuiz(quiz) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(quiz));
  } catch {
    // ignore: the quiz still works until the page is refreshed
  }
}

export function loadActiveQuiz() {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearActiveQuiz() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
