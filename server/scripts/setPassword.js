/**
 * Set a new password for any account (e.g. the admin) without email (IPP-1202).
 *
 *   npm run set:password -- --env=.env.live admin@example.com "New-Strong-Pass-123"
 *
 * --env is optional (default .env). The user is also marked as verified.
 */
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);
const envArg = args.find((a) => a.startsWith('--env='));
const envFile = envArg ? envArg.split('=')[1] : '.env';
const envPath = path.resolve(path.join(__dirname, '..'), envFile);
if (!fs.existsSync(envPath)) {
  console.error(`Settings file not found: ${envPath}`);
  process.exit(1);
}
require('dotenv').config({ path: envPath, quiet: true });

const mongoose = require('mongoose');
const User = require('../models/User');

async function run() {
  const [email, password] = args.filter((a) => !a.startsWith('--'));
  if (!email || !password) {
    console.log('Usage: npm run set:password -- [--env=.env.live] user@email.com "NewPassword"');
    process.exitCode = 1;
    return;
  }
  if (password.length < 12) {
    console.log('Use at least 12 characters (letters, numbers and a symbol).');
    process.exitCode = 1;
    return;
  }
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`Database: "${conn.connection.name}" (settings: ${envFile})`);
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      console.log(`No account with the email ${email}`);
      process.exitCode = 1;
      return;
    }
    user.password = password; // hashed by the User model
    user.isVerified = true;
    await user.save();
    console.log(`Password changed for ${user.email} (role: ${user.role})`);
  } catch (error) {
    console.error('Failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

run();
