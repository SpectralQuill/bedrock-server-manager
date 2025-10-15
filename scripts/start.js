import fs from "fs";
import crypto from "crypto";
import { execSync, spawn, spawnSync } from "child_process";
import os from "os";
import path from "path";
import dotenv from "dotenv";
import { getLocalIP } from "./utils/getLocalIP.js";

dotenv.config();

const {
  CONTAINER_NAME,
  SERVER_NAME,
  LEVEL_NAME,
  LEVEL_SEED,
  GAMEMODE,
  DIFFICULTY,
  SERVER_PORT,
  ENABLE_TUNNEL,
  TUNNEL_TYPE,
  TUNNEL_AUTHTOKEN,
  TUNNEL_REGION,
  BACKUP_DIR,
  ENV_HASH_FILE
} = process.env;

const PORT = Number(SERVER_PORT) || 19132;
const ROOT = path.resolve(".");
const ENV_FILE = path.join(ROOT, ".env");
const HASH_FILE = path.resolve(ENV_HASH_FILE || ".env.hash");
const BACKUPS = path.resolve(BACKUP_DIR || "./backups");

function getHash(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file, "utf8")).digest("hex");
}

function containerExists() {
  try {
    const list = execSync("docker ps -a --format '{{.Names}}'")
      .toString()
      .split("\n")
      .map(s => s.trim())
      .filter(Boolean);
    return list.includes(CONTAINER_NAME);
  } catch {
    return false;
  }
}

function containerRunning() {
  try {
    const list = execSync("docker ps --format '{{.Names}}'")
      .toString()
      .split("\n")
      .map(s => s.trim())
      .filter(Boolean);
    return list.includes(CONTAINER_NAME);
  } catch {
    return false;
  }
}

function getLatestBackup() {
  if (!fs.existsSync(BACKUPS)) return null;
  const files = fs.readdirSync(BACKUPS).filter(f => f.endsWith(".tar.gz"));
  if (files.length === 0) return null;
  return path.join(
    BACKUPS,
    files.sort(
      (a, b) =>
        fs.statSync(path.join(BACKUPS, b)).mtime -
        fs.statSync(path.join(BACKUPS, a)).mtime
    )[0]
  );
}

function restoreBackup(backupPath) {
  console.log(`🗃️  Restoring from backup: ${path.basename(backupPath)}`);
  fs.mkdirSync("./data", { recursive: true });
  execSync(`tar -xzf "${backupPath}" -C ./data`);
}

function attachLogs() {
  console.log("\n📜 Attaching to container logs (Ctrl+C to stop viewing)...\n");
  const proc = spawn("docker", ["logs", "-f", CONTAINER_NAME], { stdio: "inherit" });
  proc.on("close", () => console.log("\n🛑 Log stream ended.\n"));
}

function ensureNgrokAuth() {
  try {
    const ngrokConfigPath =
      os.platform() === "win32"
        ? path.join(os.homedir(), "AppData", "Local", "ngrok", "ngrok.yml")
        : path.join(os.homedir(), ".config", "ngrok", "ngrok.yml");

    if (!fs.existsSync(ngrokConfigPath) && TUNNEL_AUTHTOKEN) {
      console.log("🔑 Registering ngrok authtoken...");
      spawnSync("npx", ["ngrok", "config", "add-authtoken", TUNNEL_AUTHTOKEN], {
        stdio: "inherit",
        shell: true
      });
    }
  } catch (err) {
    console.error("⚠️  Failed to ensure ngrok authentication:", err.message);
  }
}

function startNgrokTunnel() {
  return new Promise((resolve, reject) => {
    console.log("🌐 Starting ngrok TCP tunnel...");
    const args = ["tcp", PORT.toString()];
    if (TUNNEL_REGION) args.push("--region", TUNNEL_REGION);
    const ngrok = spawn("npx", ["ngrok", ...args], { shell: true });

    let output = "";
    ngrok.stdout.on("data", d => {
      const text = d.toString();
      output += text;
      const match = text.match(/tcp:\/\/([^\s]+)/);
      if (match) {
        const publicAddress = match[1];
        resolve(publicAddress);
        console.log(`✅ Tunnel active: tcp://${publicAddress}`);
      }
    });

    ngrok.stderr.on("data", d => {
      console.error(d.toString());
    });

    ngrok.on("error", err => reject(err));
    ngrok.on("close", code => {
      if (!output.includes("tcp://")) reject(new Error(`ngrok exited (code ${code})`));
    });
  });
}

function startLocalTunnel() {
  return new Promise((resolve, reject) => {
    console.log("🌐 Starting LocalTunnel...");
    const lt = spawn("npx", ["localtunnel", "--port", PORT.toString()], { shell: true });
    lt.stdout.on("data", d => {
      const text = d.toString();
      const match = text.match(/https?:\/\/[^\s]+/);
      if (match) {
        resolve(match[0]);
        console.log(`✅ Tunnel active: ${match[0]}`);
      }
    });
    lt.stderr.on("data", d => console.error(d.toString()));
    lt.on("error", err => reject(err));
  });
}

async function setupTunnel() {
  if (!ENABLE_TUNNEL || ENABLE_TUNNEL.toLowerCase() !== "true") return null;
  try {
    if (TUNNEL_TYPE === "ngrok") {
      ensureNgrokAuth();
      return await startNgrokTunnel();
    } else if (TUNNEL_TYPE === "localtunnel") {
      return await startLocalTunnel();
    } else {
      console.error(`⚠️ Unknown tunnel type: ${TUNNEL_TYPE}`);
      return null;
    }
  } catch (err) {
    console.error("⚠️  Tunnel setup failed:", err.message);
    return null;
  }
}

async function main() {
  console.log("\n🌍 === Minecraft Bedrock Server Starter ===\n");

  if (!fs.existsSync(ENV_FILE)) {
    console.error("❌ Missing .env file.");
    process.exit(1);
  }

  const currentHash = getHash(ENV_FILE);
  const oldHash = fs.existsSync(HASH_FILE)
    ? fs.readFileSync(HASH_FILE, "utf8").trim()
    : "";
  const exists = containerExists();
  const running = containerRunning();
  const needsRenewal = !exists || currentHash !== oldHash;

  const composeFile =
    LEVEL_SEED && LEVEL_SEED.trim()
      ? "docker-compose.seed.yaml"
      : "docker-compose.yaml";

  if (needsRenewal) {
    if (exists) {
      console.log("♻️  Environment changed or missing container. Removing old one...");
      execSync("docker compose down", { stdio: "inherit" });
    }

    const backup = getLatestBackup();
    if (backup) restoreBackup(backup);
    else console.log("🆕 No backup found — starting fresh world.");

    console.log(
      `🚀 Creating new container (${LEVEL_SEED ? `SEED=${LEVEL_SEED}` : "random seed"})...`
    );

    execSync(`docker compose -f ${composeFile} up -d`, { stdio: "inherit" });

    fs.writeFileSync(HASH_FILE, currentHash);
  } else if (!running) {
    console.log("▶️  Starting existing container...");
    execSync(`docker start ${CONTAINER_NAME}`, { stdio: "inherit" });
  } else {
    console.log("🟢 Container already running.");
  }

  const ip = getLocalIP();
  console.log("\n📘 Connection Info:");
  console.log(`- Server Name: ${SERVER_NAME}`);
  console.log(`- Container: ${CONTAINER_NAME}`);
  console.log(`- Local IP: ${ip}:${PORT}`);

  const tunnelAddr = await setupTunnel();

  if (tunnelAddr) {
    console.log("\n🌎 Join from Outside Wi-Fi:");
    if (tunnelAddr.startsWith("tcp://")) {
      const [host, port] = tunnelAddr.replace("tcp://", "").split(":");
      console.log(`- Address: ${host}`);
      console.log(`- Port: ${port}`);
    } else {
      console.log(`- Address: ${tunnelAddr}`);
    }
  }

  attachLogs();
}

main();
