/**
 * Seed script: JSON files -> MongoDB
 *
 *   npm run seed                          -> add/update data from data/languages.json + data/questions.json
 *   npm run seed:fresh                    -> delete languages, questions and quiz attempts first, then seed
 *   npm run seed -- --file=data/backups/backup-2026-10-21-1530.json   -> restore from a backup file
 *                                                                        (a full backup also adds missing users + quiz results, IPP-1007)
 *   npm run seed -- --file=data/uploads/react.json                    -> an upload file for one language (IPP-1006)
 *   npm run seed -- --env=.env.live                                   -> use another settings file (live database, IPP-1202)
 *
 * --fresh on a live database (NODE_ENV=production or a database name ending in "-prod")
 * is refused unless --confirm-delete is added too.
 *
 * Safe to run many times: existing questions are updated, not duplicated.
 * Also creates the first admin from ADMIN_* values in .env (only if that email does not exist).
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
const Language = require('../models/Language');
const Question = require('../models/Question');
const QuizAttempt = require('../models/QuizAttempt');
const User = require('../models/User');
const { importContent, normalizeUpload } = require('../utils/contentBackup');

const isFresh = args.includes('--fresh');
const fileArg = args.find((a) => a.startsWith('--file='));

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf-8'));

function loadData() {
  if (fileArg) {
    const backupPath = path.resolve(path.join(__dirname, '..'), fileArg.split('=')[1]);
    const backup = normalizeUpload(readJson(backupPath));
    console.log(`Restoring from backup: ${backupPath}`);
    return { languages: backup.languages || [], questions: backup.questions || [], users: backup.users, quizAttempts: backup.quizAttempts };
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
    const conn = await mongoose.connect(process.env.MONGO_URI, { autoIndex: false }); // indexes are handled below
    const dbName = conn.connection.name;
    console.log(`MongoDB connected: ${conn.connection.host} / database "${dbName}" (settings: ${envFile})`);

    const isLive = process.env.NODE_ENV === 'production' || /-prod$/i.test(dbName);
    if (isFresh && isLive && !args.includes('--confirm-delete')) {
      throw new Error(
        `--fresh would DELETE all content of the live database "${dbName}". ` +
          'Download a backup first; add --confirm-delete if you really mean it.'
      );
    }

    if (isFresh) {
      await Promise.all([Language.deleteMany(), Question.deleteMany(), QuizAttempt.deleteMany()]);
      console.log('Fresh mode: languages, questions and quiz attempts deleted');
    }

    const { languages, questions, users, quizAttempts } = loadData();

    await fixIndexes(); // must run before inserting questions

    // Same rules as the admin import page (adds or updates, never deletes)
    const result = await importContent({ languages, questions, users, quizAttempts });
    console.log(`Languages: ${result.languages.added} added, ${result.languages.updated} updated`);
    console.log(`Questions: ${result.questions.added} added, ${result.questions.updated} updated, ${result.questions.skipped} skipped`);
    if (result.users) {
      const u = result.users;
      console.log(`Users: ${u.added} added, ${u.existing} already there (not changed), ${u.skipped} skipped`);
    }
    if (result.quizAttempts) {
      const a = result.quizAttempts;
      console.log(`Quiz results: ${a.added} added, ${a.existing} already there, ${a.skipped} skipped`);
    }
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
