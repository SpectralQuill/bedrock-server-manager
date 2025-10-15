import { execSync } from "child_process";
import dgram from "dgram";
import dotenv from "dotenv";
import { getLocalIP } from "./utils/getLocalIP.js";

dotenv.config();

const CONTAINER_NAME = process.env.CONTAINER_NAME;
const PORT = Number(process.env.SERVER_PORT || 19132);
const HOST = getLocalIP();

function listContainers() {
  return execSync("docker ps --format '{{.Names}}'")
    .toString()
    .split("\n")
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => s.replace(/^['\"]|['\"]$/g, ""));
}

function containerRunning(name) {
  const containers = listContainers();
  return containers.includes(name);
}

async function pingBedrock(host, port, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const sock = dgram.createSocket("udp4");
    const packet = Buffer.from([
      0x01,
      0, 0, 0, 0, 0, 0, 0, 0,
      0x00, 0xff, 0xff, 0x00, 0xfe, 0xfe, 0xfe, 0xfe, 0xfd, 0xfd, 0xfd, 0xfd, 0x12, 0x34, 0x56, 0x78
    ]);
    let finished = false;

    const timer = setTimeout(() => {
      if (!finished) {
        finished = true;
        sock.close();
        reject(new Error("timeout"));
      }
    }, timeout);

    sock.on("message", msg => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      sock.close();
      resolve(msg.toString());
    });

    sock.on("error", err => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      sock.close();
      reject(err);
    });

    sock.send(packet, 0, packet.length, port, host);
  });
}

async function main() {
  console.log("\n🔍 === Bedrock Server Connectivity Test ===\n");

  const containers = listContainers();
  if (!containers.includes(CONTAINER_NAME)) {
    console.error(`❌ Container "${CONTAINER_NAME}" not running.`);
    console.log("🧠 Active containers:", containers.join(", ") || "(none)");
    process.exit(1);
  }

  console.log(`✅ Container "${CONTAINER_NAME}" is running.`);
  console.log(`🌐 Checking joinability at ${HOST}:${PORT} (UDP)...`);

  try {
    const res = await pingBedrock(HOST, PORT);
    if (res.includes("MCPE")) {
      console.log("✅ Server responded to Bedrock ping!");
      console.log(`ℹ️  Raw: ${res.slice(0, 200)}`);
    } else {
      console.log("⚠️  UDP reachable, but no recognizable Bedrock response.");
    }
  } catch (err) {
    console.error(`❌ Could not reach server UDP ${HOST}:${PORT} — ${err.message}`);
  }

  console.log("\n✅ Test complete.\n");
}

main();
