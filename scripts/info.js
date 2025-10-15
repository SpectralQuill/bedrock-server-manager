import dotenv from 'dotenv';
dotenv.config();

const { CONTAINER_NAME, SERVER_NAME, BEDROCK_PORT, ALLOW_REMOTE_ACCESS, PUBLIC_IP } = process.env;

console.log(`\n📘 Minecraft Bedrock Server Info`);
console.log(`-----------------------------------`);
console.log(`Container Name: ${CONTAINER_NAME}`);
console.log(`Server Name: ${SERVER_NAME}`);
console.log(`Port: ${BEDROCK_PORT}`);
console.log(`Local Connect IP: your.local.ip.address:${BEDROCK_PORT}`);

if (ALLOW_REMOTE_ACCESS === 'true') {
  console.log(`Remote Connect: ${PUBLIC_IP}:${BEDROCK_PORT}`);
  console.log(`Make sure UDP ${BEDROCK_PORT} is port-forwarded on your router.`);
}
console.log('-----------------------------------\n');
