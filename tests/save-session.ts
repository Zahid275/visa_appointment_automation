import { chromium } from '@playwright/test';
import * as fs from 'fs';

const authFile = 'playwright/.auth/user.json';

async function main() {
  console.log('Connecting to your open Google Chrome instance on port 9222...');
  
  try {
    // Connect to the already running Chrome browser via remote debugging port
    const browser = await chromium.connectOverCDP('http://localhost:9222');
    
    // Get the active browser context
    const contexts = browser.contexts();
    if (contexts.length === 0) {
      throw new Error('No browser context found. Make sure Google Chrome is open with remote debugging enabled.');
    }
    
    const context = contexts[0];
    
    // Ensure the folder exists
    if (!fs.existsSync('playwright/.auth')) {
      fs.mkdirSync('playwright/.auth', { recursive: true });
    }
    
    // Save storage state (cookies, session, etc.)
    await context.storageState({ path: authFile });
    console.log(`------------------------------------------------------------`);
    console.log(`Session successfully captured and saved to: ${authFile}`);
    console.log(`You can now close the debugging browser window.`);
    console.log(`------------------------------------------------------------`);
    
    await browser.close();
  } catch (error: any) {
    console.error('Error connecting to Chrome:', error.message);
    console.log('Please make sure you started Chrome with:');
    console.log('google-chrome --remote-debugging-port=9222 --user-data-dir="/tmp/chrome-dev-profile"');
  }
}

main().catch(console.error);
