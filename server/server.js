require('dotenv').config({ quiet: true }); // load .env before anything reads it

// Website address without a trailing slash (used for CORS and email links)
if (process.env.CLIENT_URL) process.env.CLIENT_URL = process.env.CLIENT_URL.trim().replace(/\/+$/, '');

// Stop early with a clear message if a required setting is missing (e.g. on Render)
const required = ['MONGO_URI', 'JWT_SECRET', 'CLIENT_URL'];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`Missing environment variables: ${missing.join(', ')}`);
  process.exit(1);
}
if (process.env.NODE_ENV === 'production' && process.env.JWT_SECRET.length < 32) {
  console.error('JWT_SECRET is too short for production (use 64+ random characters)');
  process.exit(1);
}

const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5000;

// Start the server only after the database is connected
connectDB().then(() => {
  app.listen(PORT, () =>
    console.log(`Server running on port ${PORT} (${process.env.NODE_ENV || 'development'}), CORS: ${process.env.CLIENT_URL}`)
  );
});
