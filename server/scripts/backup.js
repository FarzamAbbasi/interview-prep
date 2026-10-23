/**
 * Backup script: MongoDB -> JSON file
 *
 *   npm run backup   -> saves data/backups/backup-YYYY-MM-DD-HHmm.json
 *
 * The file uses language slugs (not database ids), so it can be restored on any database with:
 *   npm run seed -- --file=data/backups/<file name>.json
 */
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const { buildBackup } = require('../utils/contentBackup');

const pad = (n) => String(n).padStart(2, '0');

function timestamp() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
    console.log('MongoDB connected');

    const data = await buildBackup();

    const backupDir = path.join(__dirname, '..', 'data', 'backups');
    fs.mkdirSync(backupDir, { recursive: true });
    const filePath = path.join(backupDir, `backup-${timestamp()}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

    console.log(`Backup saved: ${filePath}`);
    console.log(`Languages: ${data.languages.length}, Questions: ${data.questions.length}`);
  } catch (error) {
    console.error('Backup failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

run();
