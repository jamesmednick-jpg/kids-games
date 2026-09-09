import { test, expect } from '@playwright/test';
import { openSalon } from './helpers.mjs';

test('mute toggles, persists across reload, and never throws', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await openSalon(page);
  await expect(page.locator('#btn-mute')).toHaveText('🔊');
  await page.click('#btn-mute');
  await expect(page.locator('#btn-mute')).toHaveText('🔇');
  expect(await page.evaluate(() => localStorage.getItem('nail-salon-muted'))).toBe('1');
  await openSalon(page);
  await expect(page.locator('#btn-mute')).toHaveText('🔇');
  await page.click('#btn-done'); // plays the chime (muted)
  await page.click('#btn-mute');
  await page.click('#btn-new');
  await openSalon(page);
  await page.click('#btn-done'); // plays the chime for real
  expect(errors).toEqual([]);
});
