import fs from "fs";
import readline from "readline";
import dotenv from "dotenv";
dotenv.config();

const { BACKUP_DIR, REMOVAL_PASSWORD } = process.env;
const backupDir = BACKUP_DIR || "./backups";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askPassword(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
}

async function main() {
  console.log("⚠️  You are about to delete ALL backups in:");
  console.log(`   ${backupDir}`);
  console.log("This action is irreversible.\n");

  if (!fs.existsSync(backupDir)) {
    console.log("✅ Backup directory does not exist or is already empty.");
    rl.close();
    return;
  }

  const input = await askPassword("Enter removal password to confirm: ");
  if (input.trim() !== REMOVAL_PASSWORD) {
    console.log("❌ Incorrect password. Operation aborted.");
    rl.close();
    return;
  }

  try {
    fs.rmSync(backupDir, { recursive: true, force: true });
    console.log("🧹 All backups deleted successfully.");
  } catch (err) {
    console.error("❌ Failed to delete backups:", err.message);
  } finally {
    rl.close();
  }
}

main();
