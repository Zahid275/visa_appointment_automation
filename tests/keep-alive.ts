import { chromium } from '@playwright/test';

async function main() {
  console.log('============================================================');
  console.log('Starting Keep-Alive worker...');
  console.log('Connecting to Google Chrome on port 9222...');
  console.log('This will reload the dashboard every 15 minutes to prevent logout.');
  console.log('============================================================');
  
  while (true) {
    try {
      const browser = await chromium.connectOverCDP('http://localhost:9222');
      const contexts = browser.contexts();
      
      if (contexts.length > 0) {
        const context = contexts[0];
        const pages = context.pages();
        const page = pages.length > 0 ? pages[0] : await context.newPage();
        
        console.log(`[${new Date().toLocaleTimeString()}] Reloading dashboard to extend session...`);
        await page.goto('https://mywallet.cimea-diplome.it/');
        
        // Wait for page load
        await page.waitForTimeout(5000);
        console.log(`[${new Date().toLocaleTimeString()}] Session extended successfully.`);
      }
      
      await browser.close();
    } catch (error: any) {
      console.log(`[${new Date().toLocaleTimeString()}] Keep-Alive warning: ${error.message}`);
      console.log('Make sure Chrome is running with remote debugging enabled.');
    }
    
    console.log('Sleeping for 15 minutes...');
    // Sleep for 15 minutes (900,000 milliseconds)
    await new Promise((resolve) => setTimeout(resolve, 900000));
  }
}

main().catch(console.error);
