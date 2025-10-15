import { execSync } from "child_process";
import dotenv from "dotenv";
import { getLocalIP } from "./utils/getLocalIP.js";

dotenv.config();

const {
  CONTAINER_NAME,
  SERVER_NAME,
  SERVER_PORT,
  BACKUP_DIR,
  ENABLE_TUNNEL,
  TUNNEL_TYPE,
  TUNNEL_AUTHTOKEN,
  PLAYIT_TUNNEL_URL
} = process.env;

function listContainers() {
  return execSync("docker ps --format '{{.Names}}'")
    .toString()
    .split("\n")
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => s.replace(/^['\"]|['\"]$/g, ""));
}

function containerRunning(name) {
  return listContainers().includes(name);
}

function main() {
  const running = containerRunning(CONTAINER_NAME);
  const ip = getLocalIP();
  const port = Number(SERVER_PORT || 19132);

  console.log("\nℹ️ === Server Information ===\n");
  console.log(`🧩 Container: ${CONTAINER_NAME} (${running ? "running" : "stopped"})`);
  console.log(`🗺️  Server Name: ${SERVER_NAME}`);
  console.log(`🌐 LAN Address: ${ip}:${port}`);
  console.log(`📦 Backups: ${BACKUP_DIR || "./backups"}`);

  if (ENABLE_TUNNEL === "true") {
    console.log("\n🔗 Remote Tunnel Enabled");
    console.log(`Type: ${TUNNEL_TYPE || "localtunnel"}`);
    switch (TUNNEL_TYPE) {
      case "ngrok":
        console.log(`Auth token present: ${TUNNEL_AUTHTOKEN}`);
        break;
      case "playit":
        if(!PLAYIT_TUNNEL_URL) {
          console.log("Tunnel not running.");
          break;
        }
        const parts = PLAYIT_TUNNEL_URL.split(":");
        const host = parts[0];
        const port = parts[1] || "19132";
        console.log(`Host: ${host}`);
        console.log(`Port: ${port}`);
        console.log(`Full Address: ${PLAYIT_TUNNEL_URL}`);
        break;
    }
    
  } else {
    console.log("\n🔒 Remote tunnel disabled");
  }

  console.log("\n🐳 Active Containers:");
  console.log(listContainers().join("\n - ") || "(none)");
  console.log("\n✅ Info displayed.\n");
}

main();
