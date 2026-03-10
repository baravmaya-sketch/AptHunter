/**
 * @fileoverview Core Scraper Orchestrator
 * Bootstraps Playwright (Stealth), executes component scripts, 
 * filters results, prevents redundancies, and dispatches updates.
 */
const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const { readConfig, filterListings, sendTelegramAlerts } = require('./utils');
const { scrapeHomeless } = require('./homeless');
const fs = require('fs');
const path = require('path');

// Apply stealth plugin to mask automation signatures from bot protections
chromium.use(stealth);

/**
 * Main execution container handling end-to-end scraper behavior safely.
 * @returns {Promise<void>}
 */
async function runOrchestrator() {
    let browser;
    try {
        console.log("[Orchestrator] System booting. Loading configuration definitions...");
        const searchConfig = readConfig();

        console.log("[Orchestrator] Spawning Chromium headless interface (Stealth Profile enabled)...");
        browser = await chromium.launch({ headless: false });

        const context = await browser.newContext();
        const page = await context.newPage();

        // 1. Scrape Homeless
        const homelessData = await scrapeHomeless(page, searchConfig);
        console.log(`\n[Orchestrator] Extraction phase complete: ${homelessData.length} unfiltered item(s) secured.`);

        // 2. Filter Results (Negative Keywords & Price check bounds enforcement)
        const filteredListings = filterListings(homelessData, searchConfig);
        console.log(`\n[Orchestrator] Final Report generated: ${filteredListings.length} premium matches survived validation logic.\n`);

        // 3. Deduplicate listings using persistent memory
        const memoryPath = path.join(__dirname, 'seen_listings.json');
        let seenListings = [];
        try {
            if (fs.existsSync(memoryPath)) {
                const data = fs.readFileSync(memoryPath, 'utf8');
                seenListings = JSON.parse(data);
            }
        } catch (error) {
            console.warn(`[Orchestrator] Memory read anomaly - proceeding with blank state: ${error.message}`);
        }

        const newListings = filteredListings.filter(listing => !seenListings.includes(listing.link));

        if (newListings.length === 0) {
            console.log("[Orchestrator] Analysis result: No fresh unseen assets retrieved. Skipping push alerts.");
            return; // Exit gracefully
        }

        // 4. Update memory with new listings
        const newLinks = newListings.map(listing => listing.link);
        seenListings.push(...newLinks);
        
        try {
            fs.writeFileSync(memoryPath, JSON.stringify(seenListings, null, 2), 'utf8');
        } catch (error) {
            console.error(`[Orchestrator] Persistence failure when updating local memory file: ${error.message}`);
        }

        // 5. Send to Telegram (includes 1.5s delay inside)
        await sendTelegramAlerts(newListings);

    } catch (error) {
        console.error(`[Orchestrator] A fatal runtime exception occurred preventing normal execution flow:`, error);
    } finally {
        if (browser) {
            console.log("\n[Orchestrator] Shutting down Chromium interface sequence...");
            await browser.close();
        }
    }
}

// Execute
runOrchestrator();
