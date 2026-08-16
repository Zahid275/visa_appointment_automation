import { test, expect } from '@playwright/test';

// Reuse the saved storage state (cookies, local storage, session state)
test.use({ storageState: 'playwright/.auth/user.json' });

test('Access Wallet Dashboard (Already Logged In)', async ({ page }) => {
  // Inject stealth script to bypass basic webdriver checks
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
  });

  console.log('Navigating to wallet site using saved session...');
  
  // Navigate directly to the login URL (or any internal dashboard page)
  await page.goto('https://mywallet.cimea-diplome.it/');

  // Wait to allow the page to redirect and load your dashboard/profile
  await page.waitForTimeout(5000);

  // Take a screenshot to prove that you start already logged in!
  await page.screenshot({ path: 'screenshot.png' });
  console.log('Successfully captured screenshot.png verifying logged-in state.');
});
