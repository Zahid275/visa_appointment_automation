import { test } from '@playwright/test';
import * as fs from 'fs';

const authFile = 'playwright/.auth/user.json';

// Helper function to simulate human-like mouse movements
async function moveMouseHumanLike(page: any, targetX: number, targetY: number) {
  // Start from a random position
  let currentX = Math.floor(Math.random() * 300);
  let currentY = Math.floor(Math.random() * 300);
  await page.mouse.move(currentX, currentY);

  const steps = 40; // Number of interpolation steps
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    // Linear interpolation with a sine-wave curve and slight random noise for realism
    const x = currentX + (targetX - currentX) * t + (Math.sin(t * Math.PI) * 15 * (Math.random() - 0.5));
    const y = currentY + (targetY - currentY) * t + (Math.cos(t * Math.PI) * 15 * (Math.random() - 0.5));
    await page.mouse.move(x, y);
    // Micro delay between coordinates
    await page.waitForTimeout(10 + Math.random() * 10);
  }
}

test('Manual Login and Captcha Solver', async ({ page }) => {
  // Allow up to 10 minutes for you to perform all manual steps
  test.setTimeout(600000);

  // Inject stealth script to bypass basic webdriver checks
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
  });

  console.log('Starting browser and navigating to login page...');
  await page.goto('https://mywallet.cimea-diplome.it/#/auth/login');
  await page.waitForTimeout(3000);

  // Reload the page twice
  console.log('Reloading page (1/2)...');
  await page.reload();
  await page.waitForTimeout(3000);

  console.log('Reloading page (2/2)...');
  await page.reload();
  await page.waitForTimeout(5000);

  console.log('Waiting for cookie consent banner...');
  const acceptCookiesButton = page.getByRole('button', { name: 'Accept all' });
  
  try {
    await acceptCookiesButton.waitFor({ state: 'visible', timeout: 30000 });
    console.log('Clicking "Accept all" cookies automatically...');
    await acceptCookiesButton.click();
    await page.waitForTimeout(2000); // Wait for transition
  } catch (e) {
    console.log('Cookie banner not found or already closed.');
  }

  // Attempt to solve the Turnstile Captcha
  console.log('Checking for Turnstile captcha...');
  try {
    const turnstileIframe = page.locator('iframe[src*="challenges.cloudflare.com"]').first();
    await turnstileIframe.waitFor({ state: 'visible', timeout: 15000 });
    
    const boundingBox = await turnstileIframe.boundingBox();
    if (boundingBox) {
      // The verification checkbox is normally located at the left of the iframe box
      const checkboxX = boundingBox.x + 35 + Math.random() * 10;
      const checkboxY = boundingBox.y + boundingBox.height / 2 + (Math.random() - 0.5) * 5;

      console.log(`Simulating human cursor movement to Turnstile checkbox at (${checkboxX}, ${checkboxY})...`);
      await moveMouseHumanLike(page, checkboxX, checkboxY);

      console.log('Clicking Turnstile checkbox...');
      await page.mouse.down();
      await page.waitForTimeout(60 + Math.random() * 80); // Natural press duration
      await page.mouse.up();
      
      console.log('Clicked Turnstile checkbox.');
      await page.waitForTimeout(3000); // Wait for verification to resolve
    }
  } catch (e) {
    console.log('No Turnstile captcha detected, or failed to interact. Continuing...');
  }

  const emailSelector = 'input[type="email"], input[placeholder*="email" i], input[placeholder*="Email" i], input[formcontrolname="email"], input[name="email"]';
  const passwordSelector = 'input[type="password"]';

  // Wait for login inputs to become visible (allowing up to 5 minutes for solving captcha)
  console.log('Waiting for login fields to be visible...');
  await page.waitForSelector(emailSelector, { timeout: 300000 });

  // Autofill credentials from environment variables
  console.log('Filling your credentials from .env file...');
  const email: string = process.env.EMAIL ?? 'bakoj93744@playboot.com';
  const password: string = process.env.PASSWORD ?? '@Baloch123789';
  await page.locator(emailSelector).first().fill(email);
  await page.locator(passwordSelector).fill(password);

  console.log('------------------------------------------------------------');
  console.log('Credentials filled!');
  console.log('1. If the captcha did not resolve, solve it manually.');
  console.log('2. Click the "Login" button.');
  console.log('3. Perform the 2FA token step on the next screen.');
  console.log('------------------------------------------------------------');

  // Wait until you pass the login AND 2FA screens (the URL will no longer contain '/auth')
  console.log('Waiting for you to complete captcha and 2FA...');
  await page.waitForURL((url) => !url.href.includes('/auth'), { timeout: 600000 });

  console.log('Login and 2FA verified! Saving session state...');
  
  // Create .auth directory if it doesn't exist
  if (!fs.existsSync('playwright/.auth')) {
    fs.mkdirSync('playwright/.auth', { recursive: true });
  }

  // Save the logged-in session state
  await page.context().storageState({ path: authFile });
  console.log(`Session successfully saved to: ${authFile}`);
});
