import { chromium, type BrowserContext, type Page } from 'playwright-core';
import fs from 'fs';
import path from 'path';

export async function createStealthContext(headless = false): Promise<{ context: BrowserContext; page: Page }> {
  const defaultChrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const cloakBinary = path.join(process.env.USERPROFILE || '', '.cloakbrowser', 'chromium-146.0.7680.177.5', 'chrome.exe');
  const executablePath = fs.existsSync(cloakBinary)
    ? cloakBinary
    : (process.env.CLOAKBROWSER_BINARY_PATH || defaultChrome);

  const userDataDir = path.resolve(process.cwd(), '.startup-submitter-profile');

  const context = await chromium.launchPersistentContext(userDataDir, {
    executablePath,
    headless,
    ignoreDefaultArgs: ['--enable-automation'],
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--start-maximized',
    ],
    viewport: null,
  });

  const page = context.pages()[0] || (await context.newPage());

  // Anti-bot pre-navigation cloaking
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    (window as any).chrome = (window as any).chrome || { runtime: {} };
  });

  return { context, page };
}

/**
 * Automatically detects and dismisses common cookie consent dialogs (GDPR/OneTrust/Cookiebot)
 */
export async function dismissCookieBanner(page: Page): Promise<void> {
  try {
    await page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll('button, a, [role="button"]'));
      const acceptBtn = candidates.find((el) => {
        const text = (el.textContent || '').trim().toLowerCase();
        return (
          text === 'accept' ||
          text === 'accept all' ||
          text === 'i agree' ||
          text === 'agree & continue' ||
          text === 'got it' ||
          text.includes('accept cookies')
        );
      });
      if (acceptBtn) {
        (acceptBtn as HTMLElement).click();
      }
    });
  } catch (e) {
    // Non-fatal
  }
}

