import { execSync } from "child_process";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import crypto from "crypto";
dotenv.config();

const {
  CONTAINER_NAME,
  BACKUP_DIR,
  MAX_BACKUPS,
  SERVER_NAME,
  LEVEL_NAME,
  SEED,
  GAMEMODE,
  DIFFICULTY,
} = process.env;

const projectRoot = process.cwd();
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const hash = crypto
  .createHash("sha256")
  .update(`${SERVER_NAME}${LEVEL_NAME}${SEED}${GAMEMODE}${DIFFICULTY}`)
  .digest("hex")
  .slice(0, 8);

const backupDir = path.resolve(projectRoot, BACKUP_DIR);
const backupFilename = `${SERVER_NAME}_${LEVEL_NAME}_${hash}_${timestamp}.tar.gz`;
const backupPath = path.join(backupDir, backupFilename);

// Ensure backup dir
if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

console.log(`🟡 Stopping container ${CONTAINER_NAME}...`);
try {
  execSync(`docker stop ${CONTAINER_NAME}`, { stdio: "inherit" });
} catch (err) {
  console.log("⚠️ Container not running, continuing...");
}

// Create backup of world data
console.log(`🗄️  Backing up world to ${backupPath}`);
execSync(
  `docker cp ${CONTAINER_NAME}:/data/worlds - | gzip > "${backupPath}"`,
  { shell: "/bin/bash" }
);

// Store backup metadata
const meta = {
  server_name: SERVER_NAME,
  level_name: LEVEL_NAME,
  seed: SEED,
  gamemode: GAMEMODE,
  difficulty: DIFFICULTY,
  hash_version: hash,
  timestamp,
};
fs.writeFileSync(
  path.join(backupDir, `${backupFilename}.json`),
  JSON.stringify(meta, null, 2)
);

// Cleanup old backups
const backups = fs
  .readdirSync(backupDir)
  .filter((f) => f.endsWith(".tar.gz"))
  .sort((a, b) => fs.statSync(path.join(backupDir, b)).mtime - fs.statSync(path.join(backupDir, a)).mtime);

if (backups.length > MAX_BACKUPS) {
  const toDelete = backups.slice(MAX_BACKUPS);
  toDelete.forEach((f) => {
    console.log(`🧹 Removing old backup: ${f}`);
    fs.unlinkSync(path.join(backupDir, f));
    const metaFile = path.join(backupDir, `${f}.json`);
    if (fs.existsSync(metaFile)) fs.unlinkSync(metaFile);
  });
}

console.log(`✅ Backup complete: ${backupFilename}`);
