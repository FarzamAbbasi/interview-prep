/**
 * DEVELOPMENT helper: prints a login token for an existing user,
 * so protected routes can be tested before the login API exists.
 *
 *   npm run dev:token                    -> token for ADMIN_EMAIL from .env
 *   npm run dev:token -- user@email.com  -> token for that user
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const mongoose = require('mongoose');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');

async function run() {
  const email = (process.argv[2] || process.env.ADMIN_EMAIL || '').toLowerCase();
  if (!email) {
    console.log('Usage: npm run dev:token -- user@email.com');
    process.exitCode = 1;
    return;
  }
  try {
    await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
    const user = await User.findOne({ email });
    if (!user) {
      console.log(`No user found with email ${email}`);
      process.exitCode = 1;
      return;
    }
    console.log(`User: ${user.name} (${user.role}, paid: ${user.isPaid})`);
    console.log('\nToken (valid 7 days):\n');
    console.log(generateToken(user._id));
    console.log('\nUse it as header ->  Authorization: Bearer <token>');
  } catch (error) {
    console.error('Failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

run();
