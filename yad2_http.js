const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const { delay, buildYad2Url } = require('./utils');

/**
 * Fetches the raw HTML content utilizing advanced gotScraping capabilities.
 * @param {string} url - The complete target URL.
 * @returns {Promise<string|null>} Resolves with the HTML string, or null on failure.
 */
async function fetchYad2Html(url) {
    if (!url) return null;

    // Core requirement: Add error handling and rate-limiting
    const sleepTime = Math.floor(2000 + Math.random() * 2000);
    console.log(`[HTTP Scraper] Rate-limiting active. Sleeping for ${sleepTime}ms...`);
    await delay(sleepTime);

    try {
        console.log(`[HTTP Scraper] Issuing GET request to: ${url}`);

        // Dynamically import ESM package got-scraping inside the async function
        const { gotScraping } = await import('got-scraping');

        // Emulate Chrome natively
        const response = await gotScraping({
            url: url,
            headerGeneratorOptions: {
                browsers: [{ name: 'chrome', minVersion: 110 }],
            },
            timeout: { request: 30000 },
        });

        return response.body;
    } catch (e) {
        console.error(`[HTTP Scraper] Failed fetching Yad2 HTML: ${e.message}`);
        return null;
    }
}

/**
 * Parses raw Yad2 HTML utilizing Cheerio to locate the Next.js hydration script.
 * Safely extracts the JSON payload and filters matching entries strictly against user constraints.
 * @param {string} html - Raw HTML source code
 * @param {Object} userConfig - Precise threshold filtering matrices
 * @returns {Array<Object>} List of sanitized matches passing numeric filters.
 */
function parseYad2Html(html, userConfig = {}) {
    if (!html) return [];

    let jsonData;
    try {
        const $ = cheerio.load(html);
        const titleText = $('title').text().trim() || '';
        console.log(`[HTTP Scraper] Fetched Page Title: "${titleText}"`);

        if (
            titleText.includes('ShieldSquare') ||
            titleText.includes('Captcha') ||
            titleText.includes('Access Denied')
        ) {
            throw new Error(`CRITICAL: Yad2 Bot-Protection Intercept Block Active. Page Title: ${titleText}`);
        }

        const scriptSrc = $('#__NEXT_DATA__').html();
        if (!scriptSrc) {
            console.error(`[HTTP Scraper] CRITICAL ERROR: <script id="__NEXT_DATA__"> was not found in the DOM.`);
            return [];
        }

        jsonData = JSON.parse(scriptSrc);
    } catch (e) {
        console.error(`[HTTP Scraper] General parsing exception occurred: ${e.message}`);
        return [];
    }

    const feedBuckets = [
        'private',
        'agency',
        'yad1',
        'platinum',
        'kingOfTheHar',
        'trio',
        'booster',
        'leadingBroker',
    ];
    const feed = jsonData?.props?.pageProps?.feed || {};
    const items = feedBuckets.flatMap((key) => (Array.isArray(feed[key]) ? feed[key] : []));
    const matchedListings = [];

    // Parse constraint caps from user config
    const minP = userConfig.minRent ? parseFloat(userConfig.minRent) : null;
    const maxP = userConfig.maxRent ? parseFloat(userConfig.maxRent) : null;
    const minR = userConfig.minRooms ? parseFloat(userConfig.minRooms) : null;
    const maxR = userConfig.maxRooms ? parseFloat(userConfig.maxRooms) : null;
    const minS = userConfig.minSqm ? parseFloat(userConfig.minSqm) : null;
    const maxS = userConfig.maxSqm ? parseFloat(userConfig.maxSqm) : null;

    items.forEach((item) => {
        try {
            if (!item || typeof item !== 'object') return;

            const rawPrice = item.price ? item.price.toString().replace(/[^\d]/g, '') : null;
            const itemPrice = parseInt(rawPrice, 10);

            let itemRooms = item.additionalDetails?.roomsCount || null;
            if (typeof itemRooms === 'string') itemRooms = parseFloat(itemRooms.replace(/[^\d.]/g, ''));
            else itemRooms = parseFloat(itemRooms);

            let itemSqm = item.additionalDetails?.squareMeter || null;
            if (typeof itemSqm === 'string') itemSqm = parseFloat(itemSqm.replace(/[^\d.]/g, ''));
            else itemSqm = parseFloat(itemSqm);

            // Execute Hard Threshold Filtering
            if (minP !== null && !isNaN(itemPrice) && itemPrice < minP) return;
            if (maxP !== null && !isNaN(itemPrice) && itemPrice > maxP) return;
            if (minR !== null && !isNaN(itemRooms) && itemRooms < minR) return;
            if (maxR !== null && !isNaN(itemRooms) && itemRooms > maxR) return;
            if (minS !== null && !isNaN(itemSqm) && itemSqm < minS) return;
            if (maxS !== null && !isNaN(itemSqm) && itemSqm > maxS) return;

            const id = item.token || item.id;
            if (!id) return;

            matchedListings.push({
                id: id,
                title: item.address?.street?.text ||
                       item.address?.neighborhood?.text ||
                       item.address?.city?.text ||
                       'דירה ביד2',
                price: item.price ? item.price : 'מחיר לא צוין',
                rooms: itemRooms !== null && !isNaN(itemRooms) ? itemRooms : 'לא ידוע',
                sqm: itemSqm !== null && !isNaN(itemSqm) ? itemSqm : 'לא צוין',
                link: `https://www.yad2.co.il/item/${id}`,
                source: 'יד2 (HTTP/Next)',
            });
        } catch (err) {
            console.error(`[HTTP Scraper] Target skipped due to internal variance map failure: ${err.message}`);
        }
    });

    console.log(`[HTTP Scraper] Retained ${matchedListings.length} pristine items passing rigid configurations.`);
    return matchedListings;
}

/**
 * High-level orchestration endpoint for external applications.
 * Coordinates URL generation, rate-limited execution, HTML fetching, and structurally-safe parsing.
 * @param {Object} userConfig - User configuration constraints
 * @returns {Promise<Array<Object>>} Resolved array of clean listing objects
 */
async function scrapeYad2(userConfig) {
    console.log(`[Yad2 HTTP Scraper] Initiating process for config...`);
    const targetUrl = buildYad2Url(userConfig);
    console.log(`[Yad2 HTTP Scraper] Generated Target URL: ${targetUrl}`);

    const htmlMap = await fetchYad2Html(targetUrl);

    try {
        const listingsList = parseYad2Html(htmlMap, userConfig);
        return listingsList;
    } catch (criticalError) {
        console.error(criticalError.message);
        return [];
    }
}

module.exports = { scrapeYad2 };