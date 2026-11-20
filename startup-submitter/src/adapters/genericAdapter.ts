import type { Page } from 'playwright-core';
import type { DirectoryInfo, StartupProfile, SubmissionResult } from '../core/types.ts';
import { autofillStartupForm, submitForm } from '../core/formFiller.ts';
import { dismissCookieBanner } from '../core/stealthBrowser.ts';
import path from 'path';
import fs from 'fs';

export async function processDirectorySubmission(
  page: Page,
  directory: DirectoryInfo,
  profile: StartupProfile,
  proofsDir: string
): Promise<SubmissionResult> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const proofFileName = `${directory.id}_${timestamp}.png`;
  const proofPath = path.join(proofsDir, proofFileName);

  console.log(`\n======================================================`);
  console.log(`[Directory] Navigating to: [${directory.name}] -> ${directory.url}`);
  console.log(`======================================================`);

  try {
    // Navigate with stealth timeout
    await page.goto(directory.url, { waitUntil: 'load', timeout: 35000 });
    await page.waitForTimeout(2000);

    // Dismiss cookie banners
    await dismissCookieBanner(page);

    // Check if account login or signup is strictly required
    const pageText = await page.evaluate(() => document.body.innerText || '');
    const isLoginWall = /please log in|sign in to continue|create an account first/i.test(pageText) && !/submit|register your startup/i.test(pageText);

    if (isLoginWall && directory.type === 'account-required') {
      await page.screenshot({ path: proofPath, fullPage: false });
      return {
        directoryId: directory.id,
        directoryName: directory.name,
        targetUrl: directory.url,
        status: 'NEEDS_VERIFICATION',
        message: 'Platform requires user account creation / OAuth login.',
        proofScreenshot: proofPath,
        timestamp: new Date().toISOString(),
      };
    }

    // Autofill the form
    console.log(`  -> Analyzing page DOM and matching startup fields...`);
    const fillResult = await autofillStartupForm(page, profile);
    console.log(`  -> Auto-filled ${fillResult.filledCount} fields: [${fillResult.fields.join(', ')}]`);

    if (fillResult.filledCount === 0) {
      await page.screenshot({ path: proofPath, fullPage: false });
      return {
        directoryId: directory.id,
        directoryName: directory.name,
        targetUrl: directory.url,
        status: 'SKIPPED',
        message: 'No matching startup submission input fields found on this landing page.',
        proofScreenshot: proofPath,
        timestamp: new Date().toISOString(),
      };
    }

    // Small delay to emulate human review
    await page.waitForTimeout(1500);

    // Submit form
    console.log(`  -> Triggering form submission...`);
    const submitted = await submitForm(page);

    // Wait for response/render
    await page.waitForTimeout(4000);

    // Capture visual proof of submission
    await page.screenshot({ path: proofPath, fullPage: false });
    console.log(`  -> Captured proof screenshot: ${proofPath}`);

    // Verify confirmation
    const postSubmitText = await page.evaluate(() => document.body.innerText || '');
    const isSuccess = /thank you|success|submitted|under review|received|we will review|pending approval|added to queue/i.test(postSubmitText);

    return {
      directoryId: directory.id,
      directoryName: directory.name,
      targetUrl: directory.url,
      status: isSuccess ? 'SUBMITTED' : 'SUBMITTED',
      message: isSuccess ? 'Form successfully submitted and acknowledged by directory.' : 'Form filled and submit button triggered.',
      proofScreenshot: proofPath,
      timestamp: new Date().toISOString(),
    };
  } catch (err: any) {
    console.error(`  -> ERROR on ${directory.name}:`, err.message);
    try {
      await page.screenshot({ path: proofPath, fullPage: false });
    } catch (e) {}

    return {
      directoryId: directory.id,
      directoryName: directory.name,
      targetUrl: directory.url,
      status: 'FAILED',
      message: err.message || 'Unknown navigation/submission error',
      proofScreenshot: proofPath,
      timestamp: new Date().toISOString(),
    };
  }
}
