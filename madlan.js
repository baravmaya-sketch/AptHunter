const { delay } = require('./utils');
const ScraperBot = require('./scraper_bot');

async function scrapeMadlan(page, searchConfig) {
    const bot = new ScraperBot(page);
    const listings = [];
    console.log("\n--- Starting Madlan Scrape ---");
    try {
        console.log(`Navigating to Madlan Home...`);
        await bot.goto('https://www.madlan.co.il/', { waitUntil: 'domcontentloaded', timeout: 45000 });

        // 1. Popup Handling
        console.log("Checking for popups...");
        try {
            await bot.clickByRoleIfExists('button', 'הבנתי');
            await bot.clickByRoleIfExists('button', 'אחר-כך');
        } catch (popupErr) {
            console.log("No popups to handle or error interacting. Continuing...");
        }

        // 1.5 Automated Captcha / Bot Challenge Bypass
        console.log("Checking for DataDome 'PRESS & HOLD' Challenge...");
        try {
            const box = await bot.getBoundingBoxByText(/PRESS & HOLD/i, 4000);

            if (box) {
                console.log("CRITICAL: Captcha Challenge Detected! Attempting automated bypass...");

                // Calculate center of the button text
                const centerX = box.x + box.width / 2;
                const centerY = box.y + box.height / 2;

                console.log(`Moving mouse to coordinate: (${centerX}, ${centerY})`);
                await bot.mouseMove(centerX, centerY, 15); // Slow movement to avoid jitter penalties
                await bot.wait(500); // Breathe

                console.log("Pressing mouse down...");
                await bot.mouseDown();

                console.log("Holding for 10 seconds to satisfy challenge requirements...");
                await bot.wait(10000);

                console.log("Releasing mouse...");
                await bot.mouseUp();

                console.log("Human simulation complete. Waiting 4 seconds to see if challenge clears...");
                await bot.wait(4000);
            } else {
                console.log("No Captcha challenge detected in the main DOM or failed to acquire bounding box. Proceeding.");
            }
        } catch (captchaErr) {
            console.log("Challenge bypass aborted or not present:", captchaErr.message);
        }

        // 2. City Input Interaction
        if (searchConfig.cities) {
            console.log("Locating search input...");
            console.log(`Focusing and typing sequentially: ${searchConfig.cities}`);
            await bot.focusAndType('[data-auto="autocomplete-textfield"]', searchConfig.cities, 100);

            // 3. Suggestion Click
            console.log("Waiting for autocomplete dropdown to populate...");
            console.log("Clicking top suggestion...");
            await bot.waitAndClickFirst('[data-auto="autocomplete-suggestion"]');

            console.log("Waiting 4000ms for navigation to complete...");
            await bot.wait(4000);
        }

        // Extract Madlan listings
        console.log("Extracting Madlan data...");
        // Use Math.random for bypassing aggressive caching signatures if needed
        const madlanListings = await bot.evaluate('div[data-testid^="bulletinCard"]', Math.random, elements => {
            return elements.map(el => {
                const title = el.querySelector('[data-testid="bulletinTitle"]')?.textContent?.trim() || 'דירה במדלן';
                const priceRaw = el.querySelector('[data-testid="bulletinPrice"]')?.textContent?.trim() || '0';
                const description = el.querySelector('[data-testid="bulletinDescription"]')?.textContent?.trim() || '';

                let link = el.querySelector('a')?.getAttribute('href') || '';
                if (link && !link.startsWith('http')) link = `https://www.madlan.co.il${link}`;

                return { title, price: priceRaw, description, link, source: 'מדלן (Madlan)' };
            });
        });

        console.log(`Successfully scraped ${madlanListings.length} raw listings from Madlan.`);
        listings.push(...madlanListings);

    } catch (madlanError) {
        console.log(`Non-fatal Error scraping Madlan: ${madlanError.message}. Proceeding to next site...`);
    }

    return listings;
}

module.exports = { scrapeMadlan };
