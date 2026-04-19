/**
 * @fileoverview Core HTTP Scraper Orchestrator
 * Fully refactored to remove Playwright dependency.
 * Bootstraps the HTTP routines, reads user configurations, launches scrapers natively,
 * evaluates duplication memory, and dispatches updates cleanly.
 */
require('dotenv').config();
const cron = require('node-cron');
const { readUsersConfigs, sendTelegramAlerts, filterListings } = require('./utils');
const { scrapeYad2 } = require('./yad2_http');
const fs = require('fs');
const path = require('path');

// Memory Persistence location
const memoryPath = path.join(__dirname, 'seen_listings.json');

/**
 * Main execution container handling end-to-end generic HTTP scraper behavior safely.
 * @returns {Promise<void>}
 */
async function runOrchestrator() {
    try {
        console.log('[Orchestrator] Lightweight HTTP System booting. Loading configuration definitions...');
        const usersConfigs = readUsersConfigs();

        // Initialize Central Data Deduplication Memory Container
        let seenListings = [];
        try {
            if (fs.existsSync(memoryPath)) {
                const data = fs.readFileSync(memoryPath, 'utf8');
                seenListings = JSON.parse(data);
            }
        } catch (error) {
            console.warn(`[Orchestrator] Memory read anomaly - proceeding with blank state: ${error.message}`);
        }

        // Iterate over configurations
        for (const [chatId, configsArray] of Object.entries(usersConfigs)) {
            console.log(`\n[Orchestrator] Processing tasks for User (Chat ID): ${chatId}`);

            for (const searchConfig of configsArray) {
                // Support both legacy string configurations and the new multi-city array format
                const citiesTargetGroup = Array.isArray(searchConfig.cities) ? searchConfig.cities : [searchConfig.cities];

                // Execute sequentially for each city explicitly
                for (const cityTarget of citiesTargetGroup) {
                    if (!cityTarget) continue;

                    const executionConfig = { ...searchConfig, cities: cityTarget };
                    console.log(`\n[Orchestrator] Running Configuration uniquely for City: ${cityTarget}`);

                    let extractedData = [];
                    try {
                        // Extract strictly via pure HTTP targeting
                        extractedData = await scrapeYad2(executionConfig);
                    } catch (scrapeErr) {
                        console.error(`[Orchestrator] Extraction error for ${cityTarget}: ${scrapeErr.message}`);
                        continue;
                    }

                    if (extractedData.length === 0) {
                        console.log('[Orchestrator] Extraction yield was empty. Moving to next target.');
                        continue;
                    }

                    // Strict memory evaluation logic
                    let newListings = extractedData.filter((listing) => !seenListings.includes(listing.id));

                    if (newListings.length === 0) {
                        console.log('[Orchestrator] Analysis result: No fresh unseen assets retrieved. Skipping complex filtering.');
                        continue;
                    }

                    // Apply Global Unified Negative Check and Math parsing
                    const beforeFilterCount = newListings.length;
                    newListings = filterListings(newListings, executionConfig);

                    if (newListings.length < beforeFilterCount) {
                        console.log(`[Orchestrator] Removed ${beforeFilterCount - newListings.length} listings containing blacklisted/disqualified textual content.`);
                    }

                    if (newListings.length === 0) {
                        console.log('[Orchestrator] Post-Filter: No assets survived the blacklist logic. Skipping push alerts.');
                        continue;
                    }

                    console.log(`[Orchestrator] Validated ${newListings.length} absolutely pristine discoveries. Dispatching logic...`);

                    // Update Persistence JSON Memory Buffer immediately
                    const newIds = newListings.map((listing) => listing.id);
                    seenListings.push(...newIds);
                    try {
                        fs.writeFileSync(memoryPath, JSON.stringify(seenListings, null, 2), 'utf8');
                    } catch (error) {
                        console.error(`[Orchestrator] Persistence failure when updating local memory file: ${error.message}`);
                    }

                    // Securely Dispatch payloads to Telegram via Utils layer
                    await sendTelegramAlerts(newListings, chatId);
                }
            }
        }

        console.log('\n[Orchestrator] Sequence completed seamlessly. Shutting down.');
    } catch (error) {
        console.error('[Orchestrator] A fatal runtime exception occurred preventing normal execution flow:', error);
    }
}

// Establish cron schedule to execute twice a day at 04:00 and 16:00 exclusively under Israel local time
cron.schedule(
    '0 4,16 * * *',
    () => {
        console.log('[Chrontab] Triggering automated orchestrator payload extraction...');
        runOrchestrator();
    },
    {
        scheduled: true,
        timezone: 'Asia/Jerusalem',
    }
);

console.log('[Scheduler] AptHunter Background Job active and armed. Awaiting 04:00 and 16:00 (Asia/Jerusalem).');
console.log("[Scheduler] Tip: You can run 'node scraper.js --run-now' to execute an immediate scrape on startup.");

// Immediate Execution Option
if (process.argv.includes('--run-now') || process.argv.includes('--now')) {
    console.log('\n[Scheduler] Immediate execution flag detected (--run-now). Launching orchestrator...');
    runOrchestrator();
}
