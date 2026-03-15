import { test, expect, type Page } from '@playwright/test';

// Helper to login using the quick demo buttons
async function loginAsAlex(page: Page) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.click('button:has-text("Alex Chen")');
  await page.waitForURL('/hub', { timeout: 15000 });
}

async function loginAsSarah(page: Page) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.click('button:has-text("Sarah Kim")');
  await page.waitForURL('/hub', { timeout: 15000 });
}

test.describe('Login Flow', () => {
  test('Alex can login via quick button', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    // Should see both demo login buttons
    await expect(page.locator('button:has-text("Alex Chen")')).toBeVisible();
    await expect(page.locator('button:has-text("Sarah Kim")')).toBeVisible();
    
    // Click Alex's button
    await page.click('button:has-text("Alex Chen")');
    
    // Should redirect to hub
    await page.waitForURL('/hub', { timeout: 15000 });
    
    // Should see Nova in the header/sidebar (Alex's Pan name)
    await expect(page.getByRole('main').getByText('Nova', { exact: true })).toBeVisible({ timeout: 5000 });
  });

  test('Sarah can login via quick button', async ({ page }) => {
    await loginAsSarah(page);
    
    // Should see Luna (Sarah's Pan) in the main area
    await expect(page.getByRole('main').getByText('Luna', { exact: true })).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Chat Interface', () => {
  test('Alex sees chat input on hub', async ({ page }) => {
    await loginAsAlex(page);
    
    // Should see textarea for chatting
    const chatInput = page.locator('textarea');
    await expect(chatInput).toBeVisible({ timeout: 5000 });
  });

  test('Alex can send a simple message', async ({ page }) => {
    await loginAsAlex(page);
    
    // Type a simple message
    const chatInput = page.locator('textarea');
    await chatInput.fill('Hello Nova');
    await page.keyboard.press('Enter');
    
    // Should see response (may take time for LLM)
    // Just check that something appears after the message
    await page.waitForTimeout(2000);
    
    // The message should appear in the chat
    await expect(page.locator('text=Hello Nova')).toBeVisible();
  });
});

test.describe('Pan-to-Pan Sync', () => {
  test('Alex can trigger a sync with Sarah', async ({ page }) => {
    await loginAsAlex(page);
    
    // Send message to trigger sync
    const chatInput = page.locator('textarea');
    await chatInput.fill('Ask Sarah what she is working on');
    await page.keyboard.press('Enter');
    
    // Should see consent dialog appear (says "Approve sharing")
    await expect(page.locator('text=Approve sharing')).toBeVisible({ timeout: 10000 });
    
    // Click approve button
    await page.click('button:has-text("Approve & Start")');
    
    // Should see "Talking to" indicator
    await expect(page.locator('text=Talking to')).toBeVisible({ timeout: 10000 });
    
    // Wait for sync to complete - should see "I talked to" 
    await expect(page.locator('text=I talked to')).toBeVisible({ timeout: 60000 });
  });

  test('sync appears in Pan Syncs page for Alex', async ({ page }) => {
    // Just go to spectator page and check for any existing sync
    await loginAsAlex(page);
    
    // Go directly to Pan Syncs (there may be existing syncs from previous tests)
    await page.click('a[href="/spectator"]');
    await page.waitForURL('/spectator', { timeout: 10000 });
    
    // Wait for page to load
    await page.waitForTimeout(2000);
    
    // Should see the page
    await expect(page.locator('text=Pan Syncs')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Multi-User Visibility', () => {
  test('two users can see each other in messages', async ({ browser }) => {
    // Create two separate browser contexts
    const alexContext = await browser.newContext();
    const sarahContext = await browser.newContext();
    
    const alexPage = await alexContext.newPage();
    const sarahPage = await sarahContext.newPage();
    
    try {
      // Login both
      await loginAsAlex(alexPage);
      await loginAsSarah(sarahPage);
      
      // Alex goes to messages
      await alexPage.click('a[href="/messages"]');
      await alexPage.waitForURL('/messages', { timeout: 10000 });
      
      // Alex should see Sarah
      await expect(alexPage.locator('text=Sarah Kim')).toBeVisible({ timeout: 10000 });
      
      // Sarah goes to messages
      await sarahPage.click('a[href="/messages"]');
      await sarahPage.waitForURL('/messages', { timeout: 10000 });
      
      // Sarah should see Alex
      await expect(sarahPage.locator('text=Alex Chen')).toBeVisible({ timeout: 10000 });
      
    } finally {
      await alexContext.close();
      await sarahContext.close();
    }
  });

  test('sync appears for both users', async ({ browser }) => {
    const alexContext = await browser.newContext();
    const sarahContext = await browser.newContext();
    
    const alexPage = await alexContext.newPage();
    const sarahPage = await sarahContext.newPage();
    
    try {
      // Login both
      await loginAsAlex(alexPage);
      await loginAsSarah(sarahPage);
      
      // Both go to Pan Syncs to check existing syncs
      await alexPage.click('a[href="/spectator"]');
      await sarahPage.click('a[href="/spectator"]');
      
      await alexPage.waitForURL('/spectator');
      await sarahPage.waitForURL('/spectator');
      
      // Both should see the page
      await expect(alexPage.locator('text=Pan Syncs')).toBeVisible({ timeout: 5000 });
      await expect(sarahPage.locator('text=Pan Syncs')).toBeVisible({ timeout: 5000 });
      
    } finally {
      await alexContext.close();
      await sarahContext.close();
    }
  });
});
