/**
 * Dev script that reads the Groq API key from .env.local
 * and injects it into angular.json before starting ng serve.
 * Restores angular.json on exit.
 */
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

const envFile = readFileSync('.env.local', 'utf-8');
const complexKey = envFile.match(/GROQ_API_KEY_COMPLEX=(.+)/)?.[1]?.trim() || 'MISSING_KEY';

const angularJsonPath = './angular.json';
const angularJson = readFileSync(angularJsonPath, 'utf-8');

// Replace the placeholder with the actual key
const updated = angularJson.replace(
  '"GROQ_API_KEY_COMPLEX_PLACEHOLDER"',
  `"\\"${complexKey}\\""`
);

writeFileSync(angularJsonPath, updated, 'utf-8');
console.log('✓ API key injected for dev server');

try {
  execSync('npx ng serve', { stdio: 'inherit' });
} finally {
  writeFileSync(angularJsonPath, angularJson, 'utf-8');
  console.log('✓ angular.json restored');
}
