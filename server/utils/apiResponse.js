// Every successful API response has the same shape:
// { success: true, message?: string, data: ... }
function sendSuccess(res, data = null, message = undefined, statusCode = 200) {
  const body = { success: true };
  if (message) body.message = message;
  body.data = data;
  return res.status(statusCode).json(body);
}

module.exports = { sendSuccess };
