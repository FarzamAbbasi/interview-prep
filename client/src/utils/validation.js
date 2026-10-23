// Same rules as the server (routes/authRoutes.js), checked before sending
export const isValidEmail = (email) => /^\S+@\S+\.\S+$/.test(email.trim());

export function validateRegister({ name, email, password, confirmPassword }) {
  const errors = {};
  if (!name.trim()) errors.name = 'Name is required';
  else if (name.trim().length > 50) errors.name = 'Name cannot be more than 50 characters';
  if (!isValidEmail(email)) errors.email = 'Please enter a valid email';
  if (password.length < 6 || password.length > 72) errors.password = 'Password must be 6 to 72 characters';
  if (confirmPassword !== password) errors.confirmPassword = 'Passwords do not match';
  return errors;
}

export function validateLogin({ email, password }) {
  const errors = {};
  if (!isValidEmail(email)) errors.email = 'Please enter a valid email';
  if (!password) errors.password = 'Password is required';
  return errors;
}

// Server 400 errors come as [{ field, message }] -> { field: message }
export function fieldErrorsFromServer(err) {
  const list = err?.response?.data?.errors;
  if (!Array.isArray(list)) return {};
  return Object.fromEntries(list.map((e) => [e.field, e.message]));
}

export function validateNewPassword({ password, confirmPassword }) {
  const errors = {};
  if (password.length < 6 || password.length > 72) errors.password = 'Password must be 6 to 72 characters';
  if (confirmPassword !== password) errors.confirmPassword = 'Passwords do not match';
  return errors;
}
