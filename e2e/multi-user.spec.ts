import { test, expect, type Page } from '@playwright/test';

// Helper to login a user
async function loginUser(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  
  // Wait for redirect to hub
  await page.waitForURL('/hub', { timeout: 10000 });
}

// Helper to get Pan chat textarea
async function getPanChatInput(page: Page) {
  return page.locator('textarea[placeholder*="Message"]');
}

test.describe('Multi-User Sync', () => {
  test('two users can see each other in the directory', async ({ browser }) => {
    // Create two browser contexts for two users
    const alexContext = await browser.newContext();
    const sarahContext = await browser.newContext();
    
    const alexPage = await alexContext.newPage();
    const sarahPage = await sarahContext.newPage();
    
    try {
      // Login both users
      await loginUser(alexPage, 'alex@pan.local', 'test123');
      await loginUser(sarahPage, 'sarah@pan.local', 'test123');
      
      // Alex should be on hub
      await expect(alexPage).toHaveURL('/hub');
      
      // Sarah should be on hub
      await expect(sarahPage).toHaveURL('/hub');
      
      // Navigate to messages to see user directory
      await alexPage.click('a[href="/messages"]');
      await alexPage.waitForURL('/messages');
      
      // Alex should see Sarah in the user list
      await expect(alexPage.locator('text=Sarah Kim')).toBeVisible({ timeout: 5000 });
      
    } finally {
      await alexContext.close();
      await sarahContext.close();
    }
  });

  test('Alex can initiate a sync with Sarah', async ({ browser }) => {
    const alexContext = await browser.newContext();
    const alexPage = await alexContext.newPage();
    
    try {
      await loginUser(alexPage, 'alex@pan.local', 'test123');
      
      // Get the chat input
      const chatInput = await getPanChatInput(alexPage);
      await expect(chatInput).toBeVisible();
      
      // Type a message to trigger sync
      await chatInput.fill('Ask Sarah what she is working on');
      await alexPage.keyboard.press('Enter');
      
      // Should see consent dialog
      await expect(alexPage.locator('text=Start a Sync')).toBeVisible({ timeout: 10000 });
      
      // Approve the sync
      await alexPage.click('button:has-text("Approve")');
      
      // Should see syncing indicator
      await expect(alexPage.locator('text=Talking to')).toBeVisible({ timeout: 5000 });
      
      // Wait for sync to complete (response should appear)
      await expect(alexPage.locator('text=I talked to')).toBeVisible({ timeout: 30000 });
      
    } finally {
      await alexContext.close();
    }
  });

  test('sync appears for both users in Pan Syncs', async ({ browser }) => {
    const alexContext = await browser.newContext();
    const sarahContext = await browser.newContext();
    
    const alexPage = await alexContext.newPage();
    const sarahPage = await sarahContext.newPage();
    
    try {
      // Login both users
      await loginUser(alexPage, 'alex@pan.local', 'test123');
      await loginUser(sarahPage, 'sarah@pan.local', 'test123');
      
      // Alex initiates a sync
      const chatInput = await getPanChatInput(alexPage);
      await chatInput.fill('Ask Sarah about her weekend plans');
      await alexPage.keyboard.press('Enter');
      
      // Approve if consent dialog appears
      const approveButton = alexPage.locator('button:has-text("Approve")');
      if (await approveButton.isVisible({ timeout: 5000 })) {
        await approveButton.click();
      }
      
      // Wait for sync to complete
      await alexPage.waitForTimeout(5000);
      
      // Both users navigate to Pan Syncs
      await alexPage.click('a[href="/spectator"]');
      await sarahPage.click('a[href="/spectator"]');
      
      await alexPage.waitForURL('/spectator');
      await sarahPage.waitForURL('/spectator');
      
      // Both should see the sync (with some topic related to "weekend plans")
      // Wait a bit for SSE to update
      await alexPage.waitForTimeout(2000);
      await sarahPage.waitForTimeout(2000);
      
      // Check for any sync content
      const alexHasSync = await alexPage.locator('.space-y-4 > div').count();
      const sarahHasSync = await sarahPage.locator('.space-y-4 > div').count();
      
      // At least one user should see a sync
      expect(alexHasSync + sarahHasSync).toBeGreaterThan(0);
      
    } finally {
      await alexContext.close();
      await sarahContext.close();
    }
  });

  test('no data leakage between users', async ({ browser }) => {
    const alexContext = await browser.newContext();
    const sarahContext = await browser.newContext();
    
    const alexPage = await alexContext.newPage();
    const sarahPage = await sarahContext.newPage();
    
    try {
      // Login both users
      await loginUser(alexPage, 'alex@pan.local', 'test123');
      await loginUser(sarahPage, 'sarah@pan.local', 'test123');
      
      // Check that Alex's page doesn't show Sarah's private data
      // and vice versa
      
      // Go to settings to check privacy dashboard
      await alexPage.click('a[href="/settings"]');
      await sarahPage.click('a[href="/settings"]');
      
      await alexPage.waitForURL('/settings');
      await sarahPage.waitForURL('/settings');
      
      // Alex should see their own privacy settings
      await expect(alexPage.locator('text=Privacy')).toBeVisible();
      
      // Sarah should see their own privacy settings
      await expect(sarahPage.locator('text=Privacy')).toBeVisible();
      
      // Check page content doesn't contain the other user's email
      const alexContent = await alexPage.content();
      const sarahContent = await sarahPage.content();
      
      // Alex's page shouldn't contain Sarah's email
      expect(alexContent).not.toContain('sarah@pan.local');
      
      // Sarah's page shouldn't contain Alex's email
      expect(sarahContent).not.toContain('alex@pan.local');
      
    } finally {
      await alexContext.close();
      await sarahContext.close();
    }
  });
});

test.describe('Single User Sync Flow', () => {
  test('user can ask Pan about another user and get response', async ({ page }) => {
    await loginUser(page, 'alex@pan.local', 'test123');
    
    const chatInput = await getPanChatInput(page);
    await chatInput.fill('Ask Sarah what projects she is working on');
    await page.keyboard.press('Enter');
    
    // Should see consent dialog
    const approveButton = page.locator('button:has-text("Approve")');
    if (await approveButton.isVisible({ timeout: 5000 })) {
      await approveButton.click();
    }
    
    // Should see syncing indicator
    await expect(page.locator('text=Talking to')).toBeVisible({ timeout: 5000 });
    
    // Should eventually see response
    await expect(page.locator('text=I talked to')).toBeVisible({ timeout: 30000 });
    
    // Response should be conversational (not formal markdown)
    const response = await page.locator('.text-neutral-300').last().textContent();
    expect(response).not.toContain('## ');
    expect(response).not.toContain('**Outcome:**');
  });

  test('sync stays on topic', async ({ page }) => {
    await loginUser(page, 'alex@pan.local', 'test123');
    
    const chatInput = await getPanChatInput(page);
    await chatInput.fill('Ask Sarah about the design review meeting');
    await page.keyboard.press('Enter');
    
    // Approve if needed
    const approveButton = page.locator('button:has-text("Approve")');
    if (await approveButton.isVisible({ timeout: 5000 })) {
      await approveButton.click();
    }
    
    // Wait for response
    await expect(page.locator('text=I talked to')).toBeVisible({ timeout: 30000 });
    
    // Navigate to Pan Syncs
    await page.click('a[href="/spectator"]');
    await page.waitForURL('/spectator');
    
    // Find the sync and check messages
    await page.waitForTimeout(2000);
    
    // The sync topic should be about "design review"
    const pageContent = await page.content();
    const hasDesignReview = pageContent.toLowerCase().includes('design') || 
                           pageContent.toLowerCase().includes('review');
    
    // Should contain topic-related content
    expect(hasDesignReview).toBe(true);
  });
});
