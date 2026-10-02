import { test, expect } from '@playwright/test';

test('an unknown one-word URL is not a musician profile', async ({ page }) => {
  await page.goto('/not-a-real-musician');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await expect(page.getByText('That page isn\'t on Gigin.')).toBeVisible();
});

test('join-artist and testimonials leave the legacy pages', async ({ page }) => {
  await page.goto('/join-artist');
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/testimonials');
  await expect(page).toHaveURL(/\/$/);
});

test('the public artist route stays /artist/:id', async ({ page }) => {
  await page.goto('/artist/missing-profile-id');
  await expect(page).toHaveURL(/\/artist\/missing-profile-id$/);
  await expect(page.getByRole('heading', { name: 'Page not found' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Artist profile not found.' })).toBeVisible();
});
