import { chromium, Page } from '@playwright/test';

// Configuration for the multi-tab automation flow
const TOTAL_TABS = 15;              // Total number of tabs to have open (including the initial one)
const TAB_OPEN_DELAY_MS = 1500;     // Delay between opening each new tab (in milliseconds)
const SHOULD_CLICK_PAYMENT_BUTTON = true; // Set to true to click the "Save and next" button in the payment section

// Precision target time for the first batch (10 tabs)
// Change this to the target time in future runs
const TARGET_CLICK_TIME = new Date('2026-08-14T17:59:54+05:00').getTime();
const SECOND_BATCH_DELAY_MS = 1000; // Delay for the second batch (5 tabs) - 1 second

type StepperPill = {
  label: string;
  active: boolean;
  done: boolean;
};

type PageDiagnostics = {
  tabIndex: number;
  batch: 'A (tabs 1-10)' | 'B (tabs 11-15)' | 'n/a';
  scheduledClick: string;
  url: string;
  title: string;
  activeStep: string | null;
  stepperPills: StepperPill[];
  serviceType: string | null;
  educationSystem: string | null;
  educationLevel: string | null;
  sectionHeading: string | null;
  sessionTimer: string | null;
  warnings: string[];
  buttons: string[];
  saveAndNextVisible: boolean;
  isPaymentSection: boolean;
};

function log(message: string, detail?: Record<string, unknown>) {
  const ts = new Date().toISOString();
  if (detail) {
    console.log(`[${ts}] ${message}`, detail);
  } else {
    console.log(`[${ts}] ${message}`);
  }
}

function formatClickTime(ms: number): string {
  return new Date(ms).toLocaleString('en-PK', {
    timeZone: 'Asia/Karachi',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  });
}

function getScheduledClickTime(tabIndex: number): number {
  return tabIndex <= 10
    ? TARGET_CLICK_TIME
    : TARGET_CLICK_TIME + SECOND_BATCH_DELAY_MS;
}

// String script avoids tsx/esbuild injecting __name into page.evaluate callbacks
const BROWSER_DIAGNOSTICS_SCRIPT = `(() => {
  const clean = (value) => (value || '').replace(/\\s+/g, ' ').trim();

  const stepperPills = [...document.querySelectorAll('.q-stepper__tab')].map((el) => ({
    label: clean(el.textContent),
    active: el.classList.contains('q-stepper__tab--active'),
    done: el.classList.contains('q-stepper__tab--done'),
  }));

  const activeStep =
    (stepperPills.find((pill) => pill.active) || {}).label ||
    clean(document.querySelector('.q-stepper__tab--active')?.textContent) ||
    null;

  const bodyText = clean(document.body.innerText);
  const serviceMatch = bodyText.match(
    /Comparability[^]*?Verification|Verification[^]*?Comparability/i
  );

  const countryMatch = bodyText.match(/Country of the Education System\\s+([^\\n]+)/i);
  const levelMatch = bodyText.match(/Level of Education System\\s+([^\\n]+)/i);
  const sessionMatch = bodyText.match(/Session expires in\\s+[\\d:]+/i);

  const warnings = [...document.querySelectorAll('.q-banner, .q-notification, [role="alert"]')]
    .map((el) => clean(el.textContent))
    .filter(Boolean);

  const buttons = [...document.querySelectorAll('button')]
    .map((el) => clean(el.textContent))
    .filter(Boolean);

  const sectionHeading =
    clean(document.querySelector('h1, h2, h3, .text-h5, .text-h6')?.textContent) || null;

  const saveAndNextVisible = buttons.some((label) => /^save and next$/i.test(label));
  const isPaymentSection =
    (activeStep && activeStep.toLowerCase().includes('payment')) ||
    stepperPills.some((pill) => pill.active && /payment|^4$/i.test(pill.label));

  return {
    title: document.title,
    activeStep,
    stepperPills,
    serviceType: serviceMatch ? clean(serviceMatch[0]) : null,
    educationSystem: countryMatch ? clean(countryMatch[1]) : null,
    educationLevel: levelMatch ? clean(levelMatch[1]) : null,
    sectionHeading,
    sessionTimer: sessionMatch ? clean(sessionMatch[0]) : null,
    warnings,
    buttons: [...new Set(buttons)].slice(0, 12),
    saveAndNextVisible,
    isPaymentSection,
  };
})()`;

const BROWSER_SCROLL_SCRIPT = `(() => {
  window.scrollTo(0, document.body.scrollHeight);
  document.querySelectorAll('*').forEach((el) => {
    if (el.scrollHeight > el.clientHeight) {
      el.scrollTop = el.scrollHeight;
    }
  });
})()`;

async function collectPageDiagnostics(p: Page, tabIndex: number): Promise<PageDiagnostics> {
  const scheduledMs = tabIndex > 0 ? getScheduledClickTime(tabIndex) : 0;

  const data = (await p.evaluate(BROWSER_DIAGNOSTICS_SCRIPT)) as any;

  return {
    tabIndex,
    batch: tabIndex <= 0 ? 'n/a' : tabIndex <= 10 ? 'A (tabs 1-10)' : 'B (tabs 11-15)',
    scheduledClick: tabIndex > 0 ? formatClickTime(scheduledMs) : 'n/a',
    url: p.url(),
    ...data,
  };
}

function logPageDiagnostics(phase: string, diag: PageDiagnostics) {
  log(`[Tab ${diag.tabIndex}] ${phase}`, {
    batch: diag.batch,
    scheduledClick: diag.scheduledClick,
    url: diag.url,
    title: diag.title,
    activeStep: diag.activeStep,
    serviceType: diag.serviceType,
    educationSystem: diag.educationSystem,
    educationLevel: diag.educationLevel,
    sectionHeading: diag.sectionHeading,
    sessionTimer: diag.sessionTimer,
    isPaymentSection: diag.isPaymentSection,
    saveAndNextVisible: diag.saveAndNextVisible,
    stepperPills: diag.stepperPills.map((pill) =>
      `${pill.done ? 'done' : pill.active ? 'ACTIVE' : 'pending'}:${pill.label}`
    ),
    warnings: diag.warnings.length ? diag.warnings : ['none'],
    buttons: diag.buttons,
  });
}

function logDiagnosticsSummary(title: string, diagnostics: PageDiagnostics[]) {
  log(`\n=== ${title} ===`);
  for (const diag of diagnostics) {
    const pills = diag.stepperPills
      .map((pill) => (pill.active ? `[${pill.label}]` : pill.label))
      .join(' > ');
    log(
      `Tab ${String(diag.tabIndex).padStart(2, '0')} | batch ${diag.batch} | click ${diag.scheduledClick} | ` +
      `system=${diag.educationSystem ?? '?'} / ${diag.educationLevel ?? '?'} | ` +
      `step=${diag.activeStep ?? '?'} | payment=${diag.isPaymentSection} | saveNext=${diag.saveAndNextVisible}`
    );
    if (pills) log(`  pills: ${pills}`);
    if (diag.warnings.length) log(`  warnings: ${diag.warnings.join(' | ')}`);
    if (diag.sessionTimer) log(`  ${diag.sessionTimer}`);
  }
}

async function main() {
  log('Run started', {
    totalTabs: TOTAL_TABS,
    batchATime: formatClickTime(TARGET_CLICK_TIME),
    batchBTime: formatClickTime(TARGET_CLICK_TIME + SECOND_BATCH_DELAY_MS),
    batchGapMs: SECOND_BATCH_DELAY_MS,
  });
  log('Connecting to Chrome on port 9222...');
  
  try {
    const browser = await chromium.connectOverCDP('http://localhost:9222');
    
    const contexts = browser.contexts();
    if (contexts.length === 0) {
      throw new Error('No active browser context found. Make sure Chrome is open on port 9222.');
    }
    
    const context = contexts[0];
    const pages = context.pages();
    
    // Find the initial page with Cimea
    let firstPage = pages.find(p => p.url().includes('cimea-diplome.it'));
    if (!firstPage) {
      log('Cimea page not found in open tabs. Using the first available page.');
      firstPage = pages[0];
    }
    
    log('Initial tab selected', { url: firstPage.url(), openTabCount: pages.length });
    
    // Helper to scroll all scrollable elements on a page
    async function scrollPageToBottom(p: Page) {
      await p.evaluate(BROWSER_SCROLL_SCRIPT);
    }
    
    // Step 1: Ensure the initial page goes to/is on the Payment section
    log('Phase: initial tab check');
    await firstPage.waitForTimeout(1000);
    
    let initialDiag = await collectPageDiagnostics(firstPage, 1);
    logPageDiagnostics('INITIAL STATE', initialDiag);
    
    if (!initialDiag.isPaymentSection) {
      log('Initial tab not on Payment — attempting wizard navigation');
      const targetUrl = 'https://mywallet.cimea-diplome.it/#/service/new';
      if (!firstPage.url().includes('/service/new')) {
        log('Navigating initial tab to wizard start', { targetUrl });
        await firstPage.goto(targetUrl, { waitUntil: 'load' });
        await firstPage.waitForTimeout(5000);
        initialDiag = await collectPageDiagnostics(firstPage, 1);
        logPageDiagnostics('AFTER GOTO /service/new', initialDiag);
      }
      
      let stepCount = 1;
      while (stepCount <= 6) {
        await firstPage.waitForTimeout(3000);
        const stepDiag = await collectPageDiagnostics(firstPage, 1);
        logPageDiagnostics(`NAV STEP ${stepCount} (before click)`, stepDiag);
        
        if (stepDiag.isPaymentSection) {
          log('Reached Payment section on initial tab', { afterSteps: stepCount - 1 });
          break;
        }
        
        await scrollPageToBottom(firstPage);
        const saveNextBtn = firstPage.locator('button', { hasText: /^Save and next$/i }).first();
        if (await saveNextBtn.count() > 0) {
          log(`Clicking "Save and next" on initial tab`, { wizardStep: stepCount, activeStep: stepDiag.activeStep });
          await saveNextBtn.scrollIntoViewIfNeeded();
          await saveNextBtn.click({ timeout: 10000 });
          await firstPage.waitForTimeout(5000);
          const afterClickDiag = await collectPageDiagnostics(firstPage, 1);
          logPageDiagnostics(`NAV STEP ${stepCount} (after click)`, afterClickDiag);
        } else {
          log('Save and next not found — stopping wizard navigation on initial tab', {
            wizardStep: stepCount,
            activeStep: stepDiag.activeStep,
            visibleButtons: stepDiag.buttons,
          });
          break;
        }
        stepCount++;
      }
    }
    
    initialDiag = await collectPageDiagnostics(firstPage, 1);
    if (initialDiag.isPaymentSection) {
      log('Initial tab ready on Payment section');
    } else {
      log('Initial tab not on Payment yet — continuing to open all tabs anyway', {
        activeStep: initialDiag.activeStep,
        stepperPills: initialDiag.stepperPills,
      });
    }
    
    // Step 2: Open remaining tabs sequentially with a delay
    const activeTabs: Page[] = [firstPage];
    const allDiagnostics: PageDiagnostics[] = [initialDiag];
    
    log('Phase: opening tabs', { targetCount: TOTAL_TABS, delayMs: TAB_OPEN_DELAY_MS });
    
    for (let i = 2; i <= TOTAL_TABS; i++) {
      log(`Waiting ${TAB_OPEN_DELAY_MS / 1000}s before opening tab ${i}`);
      await new Promise(resolve => setTimeout(resolve, TAB_OPEN_DELAY_MS));
      
      log(`Opening tab ${i}/${TOTAL_TABS}`);
      const newPage = await context.newPage();
      
      log(`Navigating tab ${i} to wizard page`);
      await newPage.goto('https://mywallet.cimea-diplome.it/#/service/new', { waitUntil: 'load' });
      await newPage.waitForTimeout(4000);
      
      const tabDiag = await collectPageDiagnostics(newPage, i);
      logPageDiagnostics('TAB OPENED', tabDiag);
      activeTabs.push(newPage);
      allDiagnostics.push(tabDiag);
    }
    
    logDiagnosticsSummary('ALL TABS READY — FULL STATE', allDiagnostics);
    
    const paymentTabCount = allDiagnostics.filter((d) => d.isPaymentSection).length;
    log('Tab open phase complete', {
      tabsOpen: activeTabs.length,
      onPayment: paymentTabCount,
      notOnPayment: activeTabs.length - paymentTabCount,
    });
    
    // Scroll all tabs so we can screenshot them clearly and ensure buttons are loaded
    log('Phase: pre-click screenshots');
    for (let i = 0; i < activeTabs.length; i++) {
      const p = activeTabs[i];
      await scrollPageToBottom(p);
      const screenshotPath = `tab_${i + 1}_before_click.png`;
      await p.screenshot({ path: screenshotPath });
      const diag = await collectPageDiagnostics(p, i + 1);
      log(`Pre-click screenshot saved`, {
        tab: i + 1,
        file: screenshotPath,
        system: `${diag.educationSystem ?? '?'} / ${diag.educationLevel ?? '?'}`,
        activeStep: diag.activeStep,
        saveAndNextVisible: diag.saveAndNextVisible,
      });
    }
    
    // Step 3: Trigger the "Save and next" click on ALL tabs concurrently at target times
    if (SHOULD_CLICK_PAYMENT_BUTTON) {
      const overallStartTime = TARGET_CLICK_TIME;
      const waitTime = overallStartTime - Date.now();
      
      if (waitTime > 0) {
        log('Waiting for batch A click time', {
          waitSeconds: (waitTime / 1000).toFixed(1),
          batchATime: formatClickTime(TARGET_CLICK_TIME),
          batchBTime: formatClickTime(TARGET_CLICK_TIME + SECOND_BATCH_DELAY_MS),
        });
        while (Date.now() < overallStartTime - 50) {
          await new Promise(resolve => setTimeout(resolve, 5));
        }
      } else {
        log('Batch A click time already passed — clicking immediately', {
          batchATime: formatClickTime(TARGET_CLICK_TIME),
          now: formatClickTime(Date.now()),
        });
      }
      
      log('Phase: scheduled concurrent clicks');
      
      await Promise.all(activeTabs.map(async (p, idx) => {
        const tabNum = idx + 1;
        const targetTime = getScheduledClickTime(tabNum);
        const preClickDiag = await collectPageDiagnostics(p, tabNum);
        
        if (Date.now() < targetTime) {
          while (Date.now() < targetTime) {
            // tight wait loop
          }
        }
        
        const clickAt = formatClickTime(Date.now());
        log(`CLICK TRIGGER tab ${tabNum}`, {
          batch: preClickDiag.batch,
          scheduledFor: preClickDiag.scheduledClick,
          actualTime: clickAt,
          system: `${preClickDiag.educationSystem ?? '?'} / ${preClickDiag.educationLevel ?? '?'}`,
          activeStep: preClickDiag.activeStep,
          saveAndNextVisible: preClickDiag.saveAndNextVisible,
        });
        
        try {
          const saveNextBtn = p.locator('button', { hasText: /^Save and next$/i }).first();
          if (await saveNextBtn.count() > 0) {
            await saveNextBtn.scrollIntoViewIfNeeded();
            await saveNextBtn.click({ timeout: 5000 });
            const postClickDiag = await collectPageDiagnostics(p, tabNum);
            log(`CLICK OK tab ${tabNum}`, {
              activeStepAfter: postClickDiag.activeStep,
              warnings: postClickDiag.warnings.length ? postClickDiag.warnings : ['none'],
            });
          } else {
            log(`CLICK SKIPPED tab ${tabNum} — Save and next button not found`, {
              visibleButtons: preClickDiag.buttons,
              activeStep: preClickDiag.activeStep,
            });
          }
        } catch (err: any) {
          log(`CLICK FAILED tab ${tabNum}`, { error: err.message, activeStep: preClickDiag.activeStep });
        }
      }));
      
      log('Waiting 5s for post-click page loads');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      log('Phase: post-click screenshots');
      const postClickDiagnostics: PageDiagnostics[] = [];
      for (let i = 0; i < activeTabs.length; i++) {
        try {
          const screenshotPath = `tab_${i + 1}_after_click.png`;
          await activeTabs[i].screenshot({ path: screenshotPath });
          const diag = await collectPageDiagnostics(activeTabs[i], i + 1);
          postClickDiagnostics.push(diag);
          log(`Post-click screenshot saved`, {
            tab: i + 1,
            file: screenshotPath,
            activeStep: diag.activeStep,
            warnings: diag.warnings.length ? diag.warnings : ['none'],
          });
        } catch (err: any) {
          log(`Post-click screenshot failed for tab ${i + 1}`, { error: err.message });
        }
      }
      
      logDiagnosticsSummary('POST-CLICK FINAL STATE', postClickDiagnostics);
    } else {
      log('SHOULD_CLICK_PAYMENT_BUTTON is false — skipping scheduled clicks');
    }
    
    log('Run finished');
    
  } catch (error: any) {
    log('Fatal error', { error: error.message, stack: error.stack });
  }
}

main().catch(console.error);
