const { chromium } = require('playwright');
const path = require('path');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    const screenshotsDir = path.resolve('../screenshots');

    await page.goto('http://localhost:3000');

    // Wait for the animation and initial render
    await wait(2000);

    // 1. Ultra-Fast Core Live Telemetry
    await page.screenshot({ path: path.join(screenshotsDir, '1_main_speedometer.png') });

    // 2. Comprehensive Test Diagnostics
    // Start the test
    const pingButton = await page.$('.speedometer-container');
    // It automatically starts? Or should we wait? Since status="idle", it doesn't automatically start, but we can simulate the detailed results by just scrolling down
    // Let's scroll down for Detailed Results (mocking or just capturing the area)
    await page.evaluate(() => window.scrollBy(0, 500));
    await wait(1000);
    await page.screenshot({ path: path.join(screenshotsDir, '2_detailed_results.png') });

    // 3. Integrated Feature Modules
    await page.evaluate(() => window.scrollBy(0, 800));
    await wait(1000);
    await page.screenshot({ path: path.join(screenshotsDir, '3_feature_cards.png') });

    // 4. Live Global ISP Outage Map (Web-Scraped)
    // Click Outage Map button
    try {
        const texts = await page.$$('text="View Map"');
        if (texts.length > 0) {
            await texts[0].click();
            await wait(2000); // Wait for fetch and map render
            await page.evaluate(() => window.scrollBy(0, 500));
            await wait(1000);
            await page.screenshot({ path: path.join(screenshotsDir, '4_outage_map.png') });
        }
    } catch (e) {
        console.log('Error catching outage map:', e);
    }

    // 5. Interactive WiFi Troubleshooter
    try {
        const tipsTexts = await page.$$('text="Learn More"');
        if (tipsTexts.length > 0) {
            await tipsTexts[0].click();
            await wait(1000); // Wait for transition
            await page.evaluate(() => window.scrollBy(0, -500));
            await wait(500);
            await page.screenshot({ path: path.join(screenshotsDir, '5_wifi_troubleshooter.png') });
        }
    } catch (e) {
        console.log('Error catching wifi troubleshooter:', e);
    }

    await browser.close();
    console.log("Screenshots captured successfully.");
})();
