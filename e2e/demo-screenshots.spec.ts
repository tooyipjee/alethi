import { test } from '@playwright/test';
import { mkdirSync } from 'fs';

// Increase timeout for this test since it involves LLM calls
test.setTimeout(180000);

test('capture demo flow screenshots', async ({ browser }) => {
  // Create screenshots directory
  const timestamp = new Date().toISOString().split('T')[0];
  const screenshotDir = `demo-screenshots/${timestamp}`;
  
  // Ensure directory exists
  mkdirSync(screenshotDir, { recursive: true });
  
  // Alex's session
  const alexContext = await browser.newContext();
  const alexPage = await alexContext.newPage();
  
  // Sarah's session - start early so she can see sync in real-time
  const sarahContext = await browser.newContext();
  const sarahPage = await sarahContext.newPage();
  
  // Set viewport for consistent screenshots
  await alexPage.setViewportSize({ width: 1280, height: 800 });
  await sarahPage.setViewportSize({ width: 1280, height: 800 });
  
  console.log('📸 Step 1: Capturing login page...');
  await alexPage.goto('/login');
  await alexPage.waitForLoadState('networkidle');
  await alexPage.screenshot({ path: `${screenshotDir}/01-login-page.png` });
  
  console.log('📸 Step 2: Logging in as Alex...');
  await alexPage.click('button:has-text("Alex Chen")');
  await alexPage.waitForURL('/hub', { timeout: 15000 });
  await alexPage.waitForLoadState('networkidle');
  await alexPage.waitForTimeout(1000);
  await alexPage.screenshot({ path: `${screenshotDir}/02-alex-hub.png` });
  
  // Also login Sarah so she can see sync happen
  console.log('📸 Logging in Sarah in parallel...');
  await sarahPage.goto('/login');
  await sarahPage.click('button:has-text("Sarah Kim")');
  await sarahPage.waitForURL('/hub', { timeout: 15000 });
  
  console.log('📸 Step 3: Typing sync request...');
  const chatInput = alexPage.locator('textarea');
  await chatInput.fill('Ask Sarah what she is working on this week');
  await alexPage.screenshot({ path: `${screenshotDir}/03-typing-request.png` });
  
  console.log('📸 Step 4: Submitting and capturing consent dialog...');
  await alexPage.keyboard.press('Enter');
  await alexPage.waitForSelector('text=Approve sharing', { timeout: 15000 });
  await alexPage.waitForTimeout(500);
  await alexPage.screenshot({ path: `${screenshotDir}/04-consent-dialog.png` });
  
  console.log('📸 Step 5: Approving - capturing the "Talking to Luna" state...');
  await alexPage.click('button:has-text("Approve & Start")');
  await alexPage.waitForSelector('text=Talking to', { timeout: 15000 });
  await alexPage.waitForTimeout(300);
  await alexPage.screenshot({ path: `${screenshotDir}/05-syncing-talking-to-luna.png` });
  
  console.log('📸 Step 6: Waiting for sync response...');
  await alexPage.waitForSelector('text=I talked to', { timeout: 90000 });
  await alexPage.waitForTimeout(500);
  await alexPage.screenshot({ path: `${screenshotDir}/06-sync-complete-response.png` });
  
  console.log('📸 Step 7: Alex views Pan Syncs - showing the actual conversation...');
  await alexPage.goto('/spectator');
  await alexPage.waitForLoadState('networkidle');
  await alexPage.waitForTimeout(2000);
  
  // Click on the sync to expand it if needed
  const syncItem = alexPage.locator('.space-y-4 > div').first();
  if (await syncItem.isVisible()) {
    await syncItem.click();
    await alexPage.waitForTimeout(500);
  }
  await alexPage.screenshot({ path: `${screenshotDir}/07-pan-syncs-conversation-alex.png`, fullPage: true });
  
  console.log('📸 Step 8: Sarah views her Messages to see conversation with Alex...');
  await sarahPage.goto('/messages');
  await sarahPage.waitForLoadState('networkidle');
  await sarahPage.waitForTimeout(2000);
  await sarahPage.screenshot({ path: `${screenshotDir}/08-sarah-messages.png` });
  
  console.log('📸 Step 9: Sarah views Pan Syncs - same conversation from her side...');
  await sarahPage.goto('/spectator');
  await sarahPage.waitForLoadState('networkidle');
  await sarahPage.waitForTimeout(2000);
  
  // Click on the sync to expand it
  const sarahSyncItem = sarahPage.locator('.space-y-4 > div').first();
  if (await sarahSyncItem.isVisible()) {
    await sarahSyncItem.click();
    await sarahPage.waitForTimeout(500);
  }
  await sarahPage.screenshot({ path: `${screenshotDir}/09-pan-syncs-conversation-sarah.png`, fullPage: true });
  
  // Cleanup
  await alexContext.close();
  await sarahContext.close();
  
  console.log(`\n✅ Demo screenshots saved to: ${screenshotDir}/`);
  console.log('   01-login-page.png - Login page with demo accounts');
  console.log('   02-alex-hub.png - Alex logged in, seeing Nova');
  console.log('   03-typing-request.png - Typing a sync request');
  console.log('   04-consent-dialog.png - Privacy consent before sync');
  console.log('   05-syncing-talking-to-luna.png - Nova talking to Luna');
  console.log('   06-sync-complete-response.png - Response with Sarah work info');
  console.log('   07-pan-syncs-conversation-alex.png - Full Nova<->Luna conversation');
  console.log('   08-sarah-messages.png - Sarah seeing Alex in messages');
  console.log('   09-pan-syncs-conversation-sarah.png - Same conversation from Sarah view');
});
