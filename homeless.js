/**
 * Scrapes apartment listings from Homeless.co.il based on user configuration.
 *
 * @param {import('playwright').Page} page - The Playwright Page instance to execute scraping on.
 * @param {Object} searchConfig - User search preferences.
 * @param {string} searchConfig.cities - Desired city name.
 * @param {string} searchConfig.rooms - Desired room count range (e.g., "2-3").
 * @param {string} searchConfig.rent - Desired rent price range in NIS (e.g., "3500-4500").
 * @param {string} searchConfig.roommates - Whether roommates are allowed ("כן", "לא", "לא משנה").
 * @returns {Promise<Array<Object>>} An array of apartment listing objects.
 */
async function scrapeHomeless(page, searchConfig) {
    const listings = [];
    console.log("[Homeless] Starting homeless.co.il scraper...");
    try {
        // 1. Navigate to https://www.homeless.co.il/rent/
        const homelessUrl = 'https://www.homeless.co.il/rent/';
        console.log(`Navigating to: ${homelessUrl}`);
        await page.goto(homelessUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });

        // 2. City Filter
        if (searchConfig.cities) {
            console.log(`[Homeless] Configuring City: ${searchConfig.cities}`);
            const cityLocator = page.locator('#city');
            await cityLocator.fill(''); // Clear first to be safe
            await cityLocator.pressSequentially(searchConfig.cities, { delay: 150 });
            
            // Wait for Typeahead dropdown suggestions to appear
            await page.waitForSelector('.tt-suggestion', { state: 'visible', timeout: 5000 });
            // Click the exact suggestion containing the user's city name
            await page.locator('.tt-suggestion', { hasText: searchConfig.cities }).first().click();
            // Short delay to ensure selection registers
            await page.waitForTimeout(500);
        }

        // Smart fill helper to handle either <input> or <select>
        async function smartFill(selector, value) {
            if (!value) return;
            const loc = page.locator(selector);
            await loc.waitFor({ state: 'attached', timeout: 5000 });
            const tagName = await loc.evaluate(el => el.tagName.toLowerCase());
            if (tagName === 'select') {
                await loc.selectOption({ label: String(value) }).catch(async () => {
                    await loc.selectOption({ value: String(value) });
                });
            } else {
                await loc.fill(String(value));
            }
        }

        // 3. Rooms Filter
        if (searchConfig.rooms) {
            console.log(`[Homeless] Configuring Rooms: ${searchConfig.rooms}`);
            await page.locator('button[data-target="iNumber4"]').click();
            const [minRooms, maxRooms] = searchConfig.rooms.split('-');
            await smartFill('#iNumber4', minRooms);
            if (maxRooms) await smartFill('#iNumber4_1', maxRooms);
        }

        // 4. Price (Rent) Filter
        if (searchConfig.rent) {
            console.log(`[Homeless] Configuring Price Range: ${searchConfig.rent}`);
            try {
                await page.locator('button[data-target="fLong3"]').click();
                await page.waitForSelector('.slider-container:has(#fLong3)', { state: 'visible' });
                const [minRent, maxRent] = searchConfig.rent.split('-');
                await page.evaluate(({ min, max }) => {
                    const minSelect = document.querySelector('#fLong3');
                    const maxSelect = document.querySelector('#fLong3_1');
                    if (minSelect) { minSelect.value = min; minSelect.dispatchEvent(new Event('change', { bubbles: true })); }
                    if (maxSelect) { maxSelect.value = max; maxSelect.dispatchEvent(new Event('change', { bubbles: true })); }
                }, { min: minRent, max: maxRent });
                await page.waitForTimeout(500);
                await page.locator('.slider-container:has(#fLong3) button.select-confirm').click();
            } catch (error) {
                console.warn(`[Homeless] Failed to seamlessly interact with price slider: ${error.message}`);
            }
        }

        // 5. Roommates Option
        if (searchConfig.roommates) {
            console.log(`[Homeless] Configuring Roommates preference: ${searchConfig.roommates}`);
            const roommatesLocator = page.locator('#iNumber15');
            const isChecked = await roommatesLocator.isChecked();
            if (searchConfig.roommates === 'כן' && !isChecked) {
                await roommatesLocator.check();
            } else if (searchConfig.roommates !== 'כן' && isChecked) {
                await roommatesLocator.uncheck();
            }
        }

        // 6. Submit Search
        console.log("[Homeless] Submitting query...");
        await page.locator('input[name="ctl00$ContentPlaceHolder1$SearchEngine$ctl04"]').click();

        // 7. Extract Results
        console.log("[Homeless] Awaiting search results layout...");
        // Wait for network idle or a specific search result element
        await page.waitForTimeout(4000);

        // Fix Strategy A (UI Toggle)
        await page.locator('text="גליריה"').first().click({ timeout: 3000 }).catch(() => { });
        await page.waitForTimeout(2000);

        // Fix Strategy B (Robust Fallback)
        const extractedListings = await page.$$eval('.ad_bg, .ad_bg2, tr.ad_bg, tr.ad_bg2', elements => {
            return elements.map(el => {
                let title = el.querySelector('.street')?.textContent?.trim();
                if (!title) {
                    title = el.querySelector('a')?.textContent?.trim() || 'דירת הומלס';
                }

                let priceRaw = el.querySelector('.price')?.textContent?.trim();
                if (!priceRaw) {
                    // Fallback for table layout: find the first td containing '₪'
                    const tds = Array.from(el.querySelectorAll('td'));
                    const priceTd = tds.find(td => td.textContent?.includes('₪'));
                    priceRaw = priceTd ? priceTd.textContent.trim() : '0';
                }

                const description = el.querySelector('.remarks')?.textContent?.trim() || '';

                let link = el.querySelector('a')?.getAttribute('href') || '';
                if (link && !link.startsWith('http')) link = `https://www.homeless.co.il${link}`;

                return { title, price: priceRaw, description, link, source: 'Homeless' };
            }).filter(item => item.link && item.price);
        });

        console.log(`[Homeless] Successfully extracted ${extractedListings.length} raw apartments.`);
        listings.push(...extractedListings);

    } catch (homelessError) {
        console.error(`[Homeless] Critical extraction failure:`, homelessError);
    }

    return listings;
}

module.exports = { scrapeHomeless };
