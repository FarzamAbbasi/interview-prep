/**
 * Add "Asked at" companies to questions that are already in the database (IPP-1732).
 *
 *   npm run tag:companies                                   (dry run: shows what would change, saves nothing)
 *   npm run tag:companies -- --yes                          (really saves)
 *   npm run tag:companies -- --env=.env.live --yes
 *   npm run tag:companies -- other-file.json --yes          (default file: data/companies/company-tags.json)
 *
 * File: { tags: [{ language: "javascript", question: "<exact question text>", companies: ["Amazon"] }] }
 * Companies are only ADDED (never removed). A question with companies is never free.
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

async function run() {
  const [fileArg] = args.filter((a) => !a.startsWith('--'));
  const really = args.includes('--yes');
  const filePath = fileArg
    ? path.resolve(process.cwd(), fileArg)
    : path.join(__dirname, '..', 'data', 'companies', 'company-tags.json');
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    process.exitCode = 1;
    return;
  }
  const rows = JSON.parse(fs.readFileSync(filePath, 'utf-8')).tags;
  if (!Array.isArray(rows)) {
    console.log('The file needs a "tags" list');
    process.exitCode = 1;
    return;
  }

  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`Database: "${conn.connection.name}" (settings: ${envFile})${really ? '' : '  [dry run, add --yes to save]'}`);

    const languages = new Map((await Language.find({}, 'slug').lean()).map((l) => [l.slug, l._id]));
    const counts = { changed: 0, same: 0, missing: 0 };
    const ops = [];

    for (const row of rows) {
      const companies = (Array.isArray(row.companies) ? row.companies : []).map((c) => String(c).trim()).filter(Boolean);
      const languageId = languages.get(row.language);
      const question = languageId && (await Question.findOne({ language: languageId, question: row.question }, 'companies').lean());
      if (!question || !companies.length) {
        counts.missing += 1;
        console.log(`  not found: [${row.language}] ${String(row.question).slice(0, 70)}`);
        continue;
      }
      const toAdd = companies.filter((c) => !(question.companies || []).includes(c));
      if (!toAdd.length) {
        counts.same += 1;
        continue;
      }
      counts.changed += 1;
      console.log(`  + ${toAdd.join(', ')}: [${row.language}] ${row.question.slice(0, 70)}`);
      ops.push({ updateOne: { filter: { _id: question._id }, update: { $addToSet: { companies: { $each: toAdd } } } } });
    }

    if (really && ops.length) await Question.bulkWrite(ops);
    console.log(
      `${really ? 'Saved' : 'Would change'}: ${counts.changed} | already tagged: ${counts.same} | not found: ${counts.missing}`
    );
    if (counts.missing) process.exitCode = 1;
  } catch (error) {
    console.error('Failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

run();
