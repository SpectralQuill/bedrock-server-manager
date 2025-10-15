import { execSync } from 'child_process';
import dgram from 'dgram';
import dotenv from 'dotenv';
dotenv.config();

const { CONTAINER_NAME, BEDROCK_PORT } = process.env;

try {
  const running = execSync(`docker ps --filter "name=${CONTAINER_NAME}" --format "{{.Names}}"`).toString().trim();
  if (!running) {
    console.log('❌ Server is not running.');
    process.exit(1);
  }

  console.log('✅ Container is running. Checking joinability...');

  // Lightweight UDP ping
  const client = dgram.createSocket('udp4');
  const host = '127.0.0.1';
  const packet = Buffer.from([0x01, 0x00, 0x00, 0x00, 0x00]); // minimal ping

  client.send(packet, 0, packet.length, BEDROCK_PORT, host, err => {
    if (err) console.error('UDP check failed:', err);
  });

  client.on('message', msg => {
    console.log('✅ Server responded! World is joinable.');
    client.close();
  });

  setTimeout(() => {
    console.error('❌ No response — world might not be joinable yet.');
    client.close();
  }, 3000);
} catch (err) {
  console.error('Error checking server status:', err.message);
}
