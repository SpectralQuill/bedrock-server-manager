import fs from "fs";
import crypto from "crypto";
import path from "path";
import dotenv from "dotenv";
import { execSync } from "child_process";

dotenv.config();

const projectRoot = process.cwd();
const envFilePath = path.join(projectRoot, ".env");
const envHashFile = path.join(projectRoot, process.env.ENV_HASH_FILE || ".env.hash");
const backupDir = path.resolve(projectRoot, process.env.BACKUP_DIR || "./backups");

const {
  CONTAINER_NAME,
  SERVER_NAME,
  LEVEL_NAME,
  SEED,
  GAMEMODE,
  DIFFICULTY,
  ENABLE_TUNNEL,
  TUNNEL_TYPE,
} = process.env;

// Compute full hash of .env
function getFileHash(file) {
  const content = fs.readFileSync(file, "utf-8");
  return crypto.createHash("sha256").update(content).digest("hex");
}

// Compute basic config hash (world-related)
function getWorldConfigHash() {
  return crypto
    .createHash("sha256")
    .update(`${SERVER_NAME}${LEVEL_NAME}${SEED}${GAMEMODE}${DIFFICULTY}`)
    .digest("hex")
    .slice(0, 8);
}

const currentEnvHash = getFileHash(envFilePath);
let previousEnvHash = fs.existsSync(envHashFile)
  ? fs.readFileSync(envHashFile, "utf-8").trim()
  : null;

// Compare hashes
const needsRebuild = !previousEnvHash || previousEnvHash !== currentEnvHash;

// Check if container exists
const containerExists =
  execSync(`docker ps -a --format '{{.Names}}'`)
    .toString()
    .split("\n")
    .includes(CONTAINER_NAME);

if (needsRebuild) {
  console.log("🔄 Environment has changed — renewing container...");

  if (containerExists) {
    console.log("🗑️ Removing old container...");
    execSync(`docker rm -f ${CONTAINER_NAME}`, { stdio: "inherit" });
  }

  // Find latest backup matching same world config
  const worldHash = getWorldConfigHash();
  const backups = fs
    .readdirSync(backupDir)
    .filter((f) => f.endsWith(".tar.gz") && f.includes(worldHash))
    .sort((a, b) => fs.statSync(path.join(backupDir, b)).mtime - fs.statSync(path.join(backupDir, a)).mtime);

  let latestBackup = backups[0];

  if (latestBackup) {
    console.log(`♻️ Using latest backup: ${latestBackup}`);
    execSync(`docker compose up -d`, { stdio: "inherit" });
    execSync(
      `tar -xzf "${path.join(backupDir, latestBackup)}" -C ./.tmp_restore && docker cp ./.tmp_restore/worlds ${CONTAINER_NAME}:/data && rm -rf ./.tmp_restore`,
      { shell: "/bin/bash" }
    );
  } else {
    console.log("🆕 No backups found, starting new world...");
    execSync(`docker compose up -d`, { stdio: "inherit" });
  }

  fs.writeFileSync(envHashFile, currentEnvHash);
} else {
  console.log("✅ No env change detected — starting existing container...");
  execSync(`docker start ${CONTAINER_NAME}`, { stdio: "inherit" });
}

// Optional: enable remote tunneling
if (ENABLE_TUNNEL === "true") {
  console.log(`🌐 Setting up remote tunnel via ${TUNNEL_TYPE}...`);
  execSync(`npm run tunnel`, { stdio: "inherit" });
}
