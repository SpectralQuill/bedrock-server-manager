import { execSync, spawnSync } from "child_process";
import dgram from "dgram";
import os from "os";
import readline from "readline";
import dotenv from "dotenv";
import { getLocalIP } from "./utils/getLocalIP.js";

dotenv.config();

const CONTAINER_NAME = process.env.CONTAINER_NAME;
const IS_WINDOWS = os.platform() === "win32";

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => {
    rl.close();
    resolve(ans.trim().toLowerCase());
  }));
}

function listContainers() {
  return execSync("docker ps --format '{{.Names}}'")
    .toString()
    .split("\n")
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => s.replace(/^['\"]|['\"]$/g, ""));
}

function getDockerMapping(container) {
  try {
    const out = execSync(`docker port ${container}`).toString().trim();
    const udp = out.split("\n").find(line => line.includes("/udp"));
    return udp ? udp.split(" -> ")[1] : null;
  } catch {
    return null;
  }
}

async function udpPing(host, port, timeout = 2000) {
  return new Promise((resolve, reject) => {
    const sock = dgram.createSocket("udp4");
    const buf = Buffer.from([0x01]);
    let done = false;

    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        sock.close();
        reject(new Error("timeout"));
      }
    }, timeout);

    sock.on("message", () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      sock.close();
      resolve();
    });

    sock.on("error", err => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      sock.close();
      reject(err);
    });

    sock.send(buf, 0, buf.length, port, host);
  });
}

async function main() {
  console.log("\n🧩 === Bedrock Port Check ===\n");
  console.log(`📦 Container: ${CONTAINER_NAME}`);

  const containers = listContainers();
  if (!containers.includes(CONTAINER_NAME)) {
    console.error(`❌ Container "${CONTAINER_NAME}" not running.`);
    process.exit(1);
  }

  const mapping = getDockerMapping(CONTAINER_NAME);
  if (!mapping) {
    console.error("❌ Could not find UDP mapping.");
    process.exit(1);
  }

  const actualPort = Number(mapping.split(":").pop());
  console.log(`✅ Docker port mapping: ${mapping}`);

  const host = getLocalIP();
  console.log(`🌐 Testing ${host}:${actualPort}...`);

  try {
    await udpPing(host, actualPort);
    console.log(`✅ UDP ${actualPort} reachable from ${host}`);
  } catch {
    console.error(`❌ No UDP response from ${host}:${actualPort}`);
    if (IS_WINDOWS) {
      const ans = await ask("\n🧱 Add Windows Firewall rule? (y/N): ");
      if (ans === "y") {
        spawnSync("netsh", [
          "advfirewall", "firewall", "add", "rule",
          `name=\"Minecraft Bedrock UDP ${actualPort}\"`,
          "dir=in", "protocol=UDP",
          `localport=${actualPort}`, "action=allow"
        ], { stdio: "inherit", shell: true });
      }
    }
  }

  console.log("\n🎉 Port check complete.\n");
}

main();
