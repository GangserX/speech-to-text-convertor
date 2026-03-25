/**
 * Build script that injects the Groq API key from an environment variable into angular.json
 * before running the Angular build. This is needed for Cloudflare Pages deployment
 * where API keys are set as environment variables.
 */
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

const angularJsonPath = './angular.json';
const angularJson = readFileSync(angularJsonPath, 'utf-8');

// Read API key from environment variable, fall back to placeholder
const complexKey = process.env.GROQ_API_KEY_COMPLEX || 'MISSING_COMPLEX_KEY';

// Replace placeholders with actual quoted values
const updated = angularJson
  .replace('"GROQ_API_KEY_COMPLEX_PLACEHOLDER"', `"\\"${complexKey}\\""`);

// Write the updated angular.json
writeFileSync(angularJsonPath, updated, 'utf-8');
console.log('✓ API keys injected into angular.json');

// Run the Angular build
try {
  execSync('npx ng build', { stdio: 'inherit' });
} finally {
  // Restore original angular.json (so keys aren't persisted in the file)
  writeFileSync(angularJsonPath, angularJson, 'utf-8');
  console.log('✓ angular.json restored to original');
}
