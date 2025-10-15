import { execSync } from 'child_process';
import dotenv from 'dotenv';
import inquirer from 'inquirer';
dotenv.config();

const { CONTAINER_NAME, REMOVAL_PASSWORD } = process.env;

try {
  const answer = await inquirer.prompt([
    {
      type: 'password',
      name: 'pw',
      message: 'Enter removal password:',
      mask: '*'
    }
  ]);

  if (answer.pw !== REMOVAL_PASSWORD) {
    console.log('❌ Incorrect password. Aborting.');
    process.exit(1);
  }

  const exists = execSync(`docker ps -a --filter "name=${CONTAINER_NAME}" --format "{{.Names}}"`).toString().trim();
  if (!exists) {
    console.log('Container does not exist.');
    process.exit(0);
  }

  console.log('Stopping and removing container...');
  execSync(`docker stop ${CONTAINER_NAME}`, { stdio: 'inherit' });
  execSync(`docker rm ${CONTAINER_NAME}`, { stdio: 'inherit' });

  console.log('✅ Container removed successfully.');
} catch (err) {
  console.error('Error removing container:', err.message);
}
