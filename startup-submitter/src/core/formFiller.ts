import type { Page } from 'playwright-core';
import type { StartupProfile } from './types.ts';
import fs from 'fs';

/**
 * Smart Form Filling Engine:
 * Analyzes the DOM to find fields matching startup profile data,
 * uses prototype descriptors to bypass SPA synthetic wrappers,
 * and handles file uploads.
 */
export async function autofillStartupForm(page: Page, profile: StartupProfile): Promise<{ filledCount: number; fields: string[] }> {
  // Step 1: Text inputs & Textareas
  const fillResult = await page.evaluate(({ p }) => {
    const filled: string[] = [];

    const setValue = (el: HTMLElement, val: string) => {
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        const proto = el instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
        const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
        if (descriptor && descriptor.set) {
          descriptor.set.call(el, val);
        } else {
          el.value = val;
        }
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    };

    const getFieldScore = (el: HTMLElement, pattern: RegExp): boolean => {
      const name = el.getAttribute('name') || '';
      const id = el.getAttribute('id') || '';
      const placeholder = el.getAttribute('placeholder') || '';
      const aria = el.getAttribute('aria-label') || '';
      const label = el.closest('label')?.textContent || '';
      const prevLabel = el.previousElementSibling?.textContent || '';
      const textToSearch = `${name} ${id} ${placeholder} ${aria} ${label} ${prevLabel}`.toLowerCase();
      return pattern.test(textToSearch);
    };

    const inputs = Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="file"]), textarea'));

    for (const el of inputs) {
      if (el.value) continue; // Already filled

      // 1. Website / URL
      if (getFieldScore(el, /website|url|homepage|link|domain/i)) {
        setValue(el, p.startup.url);
        filled.push('Website URL');
      }
      // 2. Startup / Product Name
      else if (getFieldScore(el, /startup|product|tool|title|company|brand|project|name/i) && !getFieldScore(el, /founder|your name|first name|last name|user/i)) {
        setValue(el, p.startup.name);
        filled.push('Startup Name');
      }
      // 3. Tagline / Short Pitch
      else if (getFieldScore(el, /tagline|one liner|short pitch|subtitle|punchline|headline/i)) {
        setValue(el, p.startup.tagline);
        filled.push('Tagline');
      }
      // 4. Description / Pitch / About
      else if (el instanceof HTMLTextAreaElement || getFieldScore(el, /description|pitch|about|summary|details|overview/i)) {
        setValue(el, p.startup.descriptionLong || p.startup.descriptionShort);
        filled.push('Description');
      }
      // 5. Email
      else if (el.type === 'email' || getFieldScore(el, /email|e-mail|contact/i)) {
        setValue(el, p.founder.email);
        filled.push('Email');
      }
      // 6. Founder Name
      else if (getFieldScore(el, /founder|your name|creator|author|contact name/i)) {
        setValue(el, p.founder.name);
        filled.push('Founder Name');
      }
      // 7. Twitter / X
      else if (p.startup.twitterUrl && getFieldScore(el, /twitter|x\.com|social/i)) {
        setValue(el, p.startup.twitterUrl);
        filled.push('Twitter');
      }
      // 8. Tags / Keywords
      else if (getFieldScore(el, /tags|keywords|category/i) && el.tagName === 'INPUT') {
        setValue(el, p.startup.tags.join(', '));
        filled.push('Tags');
      }
    }

    // Step 2: Handle Select dropdowns (Category / Pricing)
    const selects = Array.from(document.querySelectorAll<HTMLSelectElement>('select'));
    for (const sel of selects) {
      const textToSearch = `${sel.name} ${sel.id} ${sel.closest('label')?.textContent || ''}`.toLowerCase();
      // Pricing
      if (/pricing|cost|model/i.test(textToSearch)) {
        const option = Array.from(sel.options).find(o => new RegExp(p.startup.pricingModel, 'i').test(o.text || o.value));
        if (option) {
          sel.value = option.value;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
          filled.push('Pricing Dropdown');
        }
      }
      // Category
      else if (/category|industry|topic/i.test(textToSearch)) {
        const option = Array.from(sel.options).find(o => /saas|tool|tech|software|developer|marketing|seo|productivity|ai/i.test(o.text || o.value));
        if (option) {
          sel.value = option.value;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
          filled.push('Category Dropdown');
        }
      }
    }

    return { filledCount: filled.length, fields: filled };
  }, { p: profile });

  // Step 3: Handle File Uploads (Logo / Screenshot)
  if (profile.assets?.logoPath && fs.existsSync(profile.assets.logoPath)) {
    try {
      const fileInputs = await page.$$('input[type="file"]');
      for (const input of fileInputs) {
        await input.setInputFiles(profile.assets.logoPath);
        fillResult.fields.push('Logo Upload');
        fillResult.filledCount++;
      }
    } catch (e) {
      // Non-fatal
    }
  }

  return fillResult;
}

/**
 * Finds and clicks the submission button on the page
 */
export async function submitForm(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll<HTMLButtonElement | HTMLInputElement>('button, input[type="submit"]'));
    const submitBtn = candidates.find((b) => {
      const text = (b.textContent || (b as HTMLInputElement).value || '').trim().toLowerCase();
      return (
        /submit|add startup|publish|post startup|send|create|register|save/i.test(text) &&
        !/cancel|reset|clear|login|sign in|google|facebook|github/i.test(text)
      );
    });

    if (submitBtn) {
      submitBtn.scrollIntoView();
      (submitBtn as HTMLElement).click();
      return true;
    }
    return false;
  });
}
