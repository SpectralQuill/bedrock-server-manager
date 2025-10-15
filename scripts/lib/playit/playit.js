import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import dotenv from "dotenv";

dotenv.config();

export async function startPlayitTunnel() {
  const binary = path.resolve("scripts/lib/playit/playit-agent.exe");

  if (!fs.existsSync(binary)) {
    throw new Error("Playit binary not found at " + binary);
  }

  console.log("🌐 Starting Playit.gg agent in background...");

  const playit = spawn(binary, [], {
    shell: true,
    detached: true,
    stdio: "ignore",
    windowsHide: true
  });

  playit.unref();

  const tunnelUrl = process.env.PLAYIT_TUNNEL_URL || null;
  if (tunnelUrl) {
    console.log(`✅ Using Playit tunnel URL: ${tunnelUrl}`);
  } else {
    console.warn("⚠️ PLAYIT_TUNNEL_URL not set. Tunnel may not be reachable from outside.");
  }

  return tunnelUrl;
}
