import os from "os";

export function getLocalIP() {
  const interfaces = os.networkInterfaces();
  let wifiCandidate = null;
  let fallbackCandidate = null;
  let chosenAdapter = null;

  for (const [name, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue;

    for (const addr of addrs) {
      if (addr.family !== "IPv4" || addr.internal) continue;
      if (/vmware|vbox|hyper|docker|loopback/i.test(name)) continue;

      if (/wi-?fi|wlan|wireless/i.test(name)) {
        wifiCandidate = addr.address;
        chosenAdapter = name;
        break;
      }

      if (/^192\.168|^10\.|^172\.(1[6-9]|2\d|3[0-1])\./.test(addr.address)) {
        fallbackCandidate ??= addr.address;
        chosenAdapter ??= name;
      }
    }

    if (wifiCandidate) break;
  }

  const ip = wifiCandidate || fallbackCandidate || "127.0.0.1";
  if (process.env.DEBUG_NETWORK === "true") {
    console.log(`🌐 Selected adapter: ${chosenAdapter || "none"} (${ip})`);
  }
  return ip;
}
