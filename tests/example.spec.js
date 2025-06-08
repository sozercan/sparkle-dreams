// @ts-check
const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  // Navigate to the local file.
  // Using file:// protocol and an absolute path.
  // __dirname will be the 'tests' directory, so we go up one level.
  // Make sure your index.html is in the root of your project.
  await page.goto('file://' + require('path').join(__dirname, '..', 'index.html'));
});

test('has title', async ({ page }) => {
  // Check if the main heading "Sparkle Dreams" is present.
  // This assumes you have an <h1> element with this text or a similar prominent element.
  // You might need to adjust the selector if your heading is different.
  const heading = page.locator('h1', { hasText: 'Sparkle Dreams' });
  await expect(heading).toBeVisible();
});

test('has generate schedule button', async ({ page }) => {
  // Check if the "Generate Schedule" button exists.
  // This assumes your button has the ID 'generateSchedule'.
  // Adjust the selector if your button has a different ID or selector.
  const generateButton = page.locator('button#generateSchedule');
  await expect(generateButton).toBeVisible();
  await expect(generateButton).toHaveText('Generate Schedule');
});

test('form submission and basic schedule generation', async ({ page }) => {
  // Fill out the form for a 0-3 months old baby for a full day schedule
  await page.locator('#babyAge').selectOption('0-3');
  await page.locator('#planningMode').selectOption('fullDay');
  await page.locator('#wakeUpTime').fill('07:00');
  await page.locator('#desiredBedtime').fill('19:00');

  // Click the generate schedule button
  await page.locator('button#generateSchedule').click();

  // Check if the schedule timeline container has content
  const timelineContainer = page.locator('#timelineContainer');
  await expect(timelineContainer).not.toBeEmpty();

  // Check for the "Morning Wake Up" event
  const wakeUpEvent = timelineContainer.locator('div:has-text("Morning Wake Up")');
  await expect(wakeUpEvent).toBeVisible();
  await expect(wakeUpEvent).toContainText('7:00 AM');

  // Check for a "Bedtime" event
  const bedtimeEvent = timelineContainer.locator('div:has-text("Bedtime")');
  await expect(bedtimeEvent).toBeVisible();
  // We won't check the exact bedtime as it can vary based on calculations.
});

test('dark mode toggle', async ({ page }) => {
  const htmlElement = page.locator('html');
  const initialClass = await htmlElement.getAttribute('class');

  // Click the theme toggle button
  await page.locator('#themeToggle').click();

  const classAfterFirstClick = await htmlElement.getAttribute('class');
  if (initialClass && initialClass.includes('dark')) {
    expect(classAfterFirstClick).not.toContain('dark');
  } else {
    expect(classAfterFirstClick).toContain('dark');
  }

  // Click the theme toggle button again
  await page.locator('#themeToggle').click();
  const classAfterSecondClick = await htmlElement.getAttribute('class');
  if (classAfterFirstClick && classAfterFirstClick.includes('dark')) {
    expect(classAfterSecondClick).not.toContain('dark');
  } else {
    expect(classAfterSecondClick).toContain('dark');
  }
  // Ensure it toggled back to the opposite of the first click's result
  expect(classAfterSecondClick).toBe(initialClass || ''); // if initialClass was null, it should be empty string
});
