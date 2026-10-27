/**
 * Remove ALL questions of one language, plus everything linked to them (IPP-1713).
 * Use it before uploading a rewritten content file, so old and new questions are not mixed.
 *
 *   npm run clear:language -- javascript                 (dry run: only counts, deletes nothing)
 *   npm run clear:language -- javascript --yes           (really deletes)
 *   npm run clear:language -- --env=.env.live javascript --yes
 *   add --language to also delete the language itself (otherwise it stays, with its topics)
 *
 * Deletes: questions, their "done" progress, their bookmarks, and quiz attempts of that language.
 * Take a full backup first (Admin -> Backup) when running on live.
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
const Progress = require('../models/Progress');
const QuizAttempt = require('../models/QuizAttempt');
const User = require('../models/User');

async function run() {
  const [slug] = args.filter((a) => !a.startsWith('--'));
  const really = args.includes('--yes');
  const alsoLanguage = args.includes('--language');
  if (!slug) {
    console.log('Usage: npm run clear:language -- [--env=.env.live] <slug> [--yes] [--language]');
    process.exitCode = 1;
    return;
  }
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`Database: "${conn.connection.name}" (settings: ${envFile})`);
    const language = await Language.findOne({ slug: slug.toLowerCase() });
    if (!language) {
      console.log(`No language with the slug "${slug}"`);
      process.exitCode = 1;
      return;
    }
    const ids = (await Question.find({ language: language._id }, '_id').lean()).map((q) => q._id);
    const counts = {
      questions: ids.length,
      progress: await Progress.countDocuments({ language: language._id }),
      quizAttempts: await QuizAttempt.countDocuments({ language: language._id }),
      usersWithBookmarks: await User.countDocuments({ bookmarks: { $in: ids } }),
    };
    console.log(`${language.name}:`, counts);

    if (!really) {
      console.log('Dry run, nothing deleted. Add --yes to delete.');
      return;
    }
    await User.updateMany({ bookmarks: { $in: ids } }, { $pull: { bookmarks: { $in: ids } } });
    await Progress.deleteMany({ language: language._id });
    await QuizAttempt.deleteMany({ language: language._id });
    await Question.deleteMany({ language: language._id });
    if (alsoLanguage) await language.deleteOne();
    console.log(`Deleted.${alsoLanguage ? ' The language was deleted too.' : ' The language and its topics were kept.'}`);
  } catch (error) {
    console.error('Failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

run();
