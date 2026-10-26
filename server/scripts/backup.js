/**
 * Backup script: MongoDB -> JSON file
 *
 *   npm run backup                          -> full backup: content + users + quiz results (IPP-1007)
 *   npm run backup -- --content-only        -> only languages and questions (no emails / passwords)
 *   npm run backup -- --env=.env.live       -> back up the live database
 *
 * Saves data/backups/backup-<full|content>-YYYY-MM-DD-HHmm.json (these files are not added to git).
 * A full backup has user emails and hashed passwords: keep it private.
 *
 * The file uses emails / language slugs (not database ids), so it can be restored on any database with:
 *   npm run seed -- --file=data/backups/<file name>.json
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
const { buildBackup } = require('../utils/contentBackup');
const { recordFullBackup } = require('../utils/backupLog');

const contentOnly = args.includes('--content-only');
const pad = (n) => String(n).padStart(2, '0');

function timestamp() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

async function run() {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
    console.log(`MongoDB connected: database "${conn.connection.name}" (settings: ${envFile})`);

    const data = await buildBackup({ includeUsers: !contentOnly });

    const backupDir = path.join(__dirname, '..', 'data', 'backups');
    fs.mkdirSync(backupDir, { recursive: true });
    const filePath = path.join(backupDir, `backup-${data.scope}-${timestamp()}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

    console.log(`Backup saved: ${filePath}`);
    console.log(`Languages: ${data.languages.length}, Questions: ${data.questions.length}`);
    if (!contentOnly) {
      await recordFullBackup(data, 'command line'); // IPP-1008: admin dashboard shows this as the last backup
      console.log(`Users: ${data.users.length}, Quiz results: ${data.quizAttempts.length}`);
      console.log('This file has user emails and hashed passwords: keep it private.');
    }
  } catch (error) {
    console.error('Backup failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

run();
