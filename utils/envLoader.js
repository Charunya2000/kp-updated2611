import fs from 'fs';
import path from 'path';

/**
 * Loads environment variables from a specified .env file into process.env.
 * @param {string} envFileName - Name of the .env file to load (default: '.env.local')
 */
export function loadEnvLocal(envFileName = '.env.local') {
  try {
    const envFile = path.resolve(process.cwd(), `${envFileName}`);

    if (!fs.existsSync(envFile)) {
      console.log(`No ${envFileName} file found, skipping...`);
      return;
    }

    const envContent = fs.readFileSync(envFile, 'utf8');

    envContent.split('\n').forEach(line => {
      const trimmedLine = line.trim();

      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith('#')) {
        return;
      }

      const [key, ...valueParts] = trimmedLine.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim();
        // Remove quotes if present
        const cleanValue = value.replace(/^["']|["']$/g, '');
        process.env[key.trim()] = cleanValue;
      }
    });

    console.log(`Environment variables loaded from ${envFileName}`);
  } catch (error) {
    console.warn(`Warning: Could not load ${envFileName} file:`, error.message);
  }
}
