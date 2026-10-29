/**
 * Put coding problems from data/problems/<language>.json into the database (IPP-1715).
 *
 *   npm run import:problems -- javascript                      (dry run: checks + counts, saves nothing)
 *   npm run import:problems -- javascript --yes                (really saves)
 *   npm run import:problems -- --env=.env.live javascript --yes
 *   add --prune to also delete problems of that language that are no longer in the file (and users' progress on them)
 *
 * Before saving, every solution is run against its own tests; any error stops the import.
 * Same slug = update, new slug = add (like Bulk upload). Users' progress is kept (only --prune removes it).
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
const Problem = require('../models/Problem');
const ProblemProgress = require('../models/ProblemProgress');
const { checkProblemsFile } = require('../utils/problemCheck');

async function run() {
  const [slug] = args.filter((a) => !a.startsWith('--'));
  const really = args.includes('--yes');
  const prune = args.includes('--prune');
  if (!slug) {
    console.log('Usage: npm run import:problems -- [--env=.env.live] <language-slug> [--yes] [--prune]');
    process.exitCode = 1;
    return;
  }

  const filePath = path.join(__dirname, '..', 'data', 'problems', `${slug.toLowerCase()}.json`);
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    process.exitCode = 1;
    return;
  }

  // 1. Check the file (no database needed)
  const { problems, errors } = checkProblemsFile(JSON.parse(fs.readFileSync(filePath, 'utf-8')));
  console.log(`File: ${problems.length} problems checked (solutions run against their tests)`);
  if (errors.length) {
    console.log(`Stopped, ${errors.length} error(s):\n- ${errors.join('\n- ')}`);
    process.exitCode = 1;
    return;
  }

  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`Database: "${conn.connection.name}" (settings: ${envFile})`);
    const language = await Language.findOne({ slug: slug.toLowerCase() });
    if (!language) {
      console.log(`No language with the slug "${slug}". Add the language first (Admin -> Languages).`);
      process.exitCode = 1;
      return;
    }

    // 2. Count what would change
    const existing = await Problem.find({ language: language._id }, 'slug').lean();
    const existingSlugs = new Set(existing.map((p) => p.slug));
    const fileSlugs = new Set(problems.map((p) => p.slug));
    const counts = {
      added: problems.filter((p) => !existingSlugs.has(p.slug)).length,
      updated: problems.filter((p) => existingSlugs.has(p.slug)).length,
      notInFile: existing.filter((p) => !fileSlugs.has(p.slug)).length,
    };
    console.log(`${language.name}:`, counts, prune ? '(--prune: notInFile will be deleted)' : '');

    if (!really) {
      console.log('Dry run, nothing saved. Add --yes to save.');
      return;
    }

    // 3. Save: same slug = update, new = add
    await Problem.bulkWrite(
      problems.map((p) => ({
        updateOne: {
          filter: { language: language._id, slug: p.slug },
          // IPP-1721: new problems start visible; a problem the admin hid stays hidden
          update: { $set: { ...p, language: language._id }, $setOnInsert: { isActive: true } },
          upsert: true,
        },
      }))
    );
    if (prune && counts.notInFile) {
      const gone = await Problem.find({ language: language._id, slug: { $nin: [...fileSlugs] } }, '_id').lean();
      await ProblemProgress.deleteMany({ problem: { $in: gone.map((p) => p._id) } }); // IPP-1718
      await Problem.deleteMany({ _id: { $in: gone.map((p) => p._id) } });
    }
    console.log('Saved.');
  } catch (error) {
    console.error('Failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

run();
