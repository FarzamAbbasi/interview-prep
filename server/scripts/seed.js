/**
 * Seed script: JSON files -> MongoDB
 *
 *   npm run seed                          -> add/update data from data/languages.json + data/questions.json
 *   npm run seed:fresh                    -> delete languages, questions and quiz attempts first, then seed
 *   npm run seed -- --file=data/backups/backup-2026-10-21-1530.json   -> restore from a backup file
 *   npm run seed -- --file=data/uploads/javascript.json               -> an upload file for one language (IPP-1006)
 *
 * Safe to run many times: existing questions are updated, not duplicated.
 * Also creates the first admin from ADMIN_* values in .env (only if that email does not exist).
 */
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const Language = require('../models/Language');
const Question = require('../models/Question');
const QuizAttempt = require('../models/QuizAttempt');
const User = require('../models/User');
const { importContent, normalizeUpload } = require('../utils/contentBackup');

const args = process.argv.slice(2);
const isFresh = args.includes('--fresh');
const fileArg = args.find((a) => a.startsWith('--file='));

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf-8'));

function loadData() {
  if (fileArg) {
    const backupPath = path.resolve(path.join(__dirname, '..'), fileArg.split('=')[1]);
    const backup = normalizeUpload(readJson(backupPath));
    console.log(`Restoring from backup: ${backupPath}`);
    return { languages: backup.languages || [], questions: backup.questions || [] };
  }
  const dataDir = path.join(__dirname, '..', 'data');
  return {
    languages: readJson(path.join(dataDir, 'languages.json')),
    questions: readJson(path.join(dataDir, 'questions.json')),
  };
}

// Remove an old text index that still uses "language" as its language field
// (it breaks inserts because our language field is an ObjectId), then build indexes.
async function fixIndexes() {
  let indexes = [];
  try {
    indexes = await Question.collection.indexes();
  } catch {
    // collection does not exist yet: nothing to fix
  }
  for (const idx of indexes) {
    if (idx.textIndexVersion && idx.language_override !== 'searchLanguage') {
      await Question.collection.dropIndex(idx.name);
      console.log(`Index: removed old text index "${idx.name}"`);
    }
  }
  await Question.syncIndexes();
}

async function seedAdmin() {
  const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.log('Admin: skipped (ADMIN_EMAIL / ADMIN_PASSWORD not set in .env)');
    return;
  }
  const exists = await User.findOne({ email: ADMIN_EMAIL.toLowerCase() });
  if (exists) {
    console.log(`Admin: already exists (${exists.email})`);
    return;
  }
  await User.create({
    name: ADMIN_NAME || 'Admin',
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD, // hashed by the User model
    role: 'admin',
    isVerified: true,
    isPaid: true,
  });
  console.log(`Admin: created (${ADMIN_EMAIL})`);
}

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI, { autoIndex: false }); // indexes are handled below
    console.log('MongoDB connected');

    if (isFresh) {
      await Promise.all([Language.deleteMany(), Question.deleteMany(), QuizAttempt.deleteMany()]);
      console.log('Fresh mode: languages, questions and quiz attempts deleted');
    }

    const { languages, questions } = loadData();

    await fixIndexes(); // must run before inserting questions

    // Same rules as the admin import page (adds or updates, never deletes)
    const result = await importContent({ languages, questions });
    console.log(`Languages: ${result.languages.added} added, ${result.languages.updated} updated`);
    console.log(`Questions: ${result.questions.added} added, ${result.questions.updated} updated, ${result.questions.skipped} skipped`);
    if (result.errors.length) {
      console.log('\nSkipped items:');
      result.errors.forEach((e) => console.log('  - ' + e));
    }

    await seedAdmin();

    console.log('\nSeeding complete');
  } catch (error) {
    console.error('Seeding failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

run();
