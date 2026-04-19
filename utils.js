/**
 * @fileoverview Utilities
 * Contains generic helper functions for the AptHunter scraping ecosystem,
 * including Sleep promises, Config ingestion, Result Filtering, and Telegram Broadcasting.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');

// 1. Telegram bot initialization (polling: false)
const token = process.env.TELEGRAM_BOT_TOKEN;

let bot = null;
if (token) {
    bot = new TelegramBot(token, { polling: false });
} else {
    console.warn('WARNING: Missing TELEGRAM_BOT_TOKEN. Notifications disabled.');
}

/**
 * Promisified setTimeout for async/await flow control.
 * @param {number} ms - Milliseconds to delay execution.
 * @returns {Promise<void>}
 */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Reads and parses the user's multi-tenant search configurations from the disk.
 * @returns {Object} The parsed users_configs.json map.
 * @throws {Error} If `users_configs.json` is missing or cannot be read.
 */
function readUsersConfigs() {
    const configPath = path.join(__dirname, 'users_configs.json');
    if (!fs.existsSync(configPath)) {
        throw new Error('[Utils] Critical Error: users_configs.json is missing.');
    }
    const configData = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(configData);
}

/**
 * Filters an array of apartment listings based on strict user constraints.
 * Excludes listings containing negative keywords and enforces strict rent bounds.
 * @param {Array<Object>} listings - Raw unverified listings extracted by the scraper.
 * @param {Object} searchConfig - The user configuration containing constraints.
 * @returns {Array<Object>} Highly relevant listings that survived the filtering.
 */
function filterListings(listings, searchConfig) {
    console.log('[Utils] Engine applying filtering logic to structured datasets...');
    const systemNegativeKeywords = searchConfig.negative_keywords || [];
    const customNegativeKeywords = searchConfig.customNegativeKeywords || [];
    const negativeKeywords = [...systemNegativeKeywords, ...customNegativeKeywords];

    // Parse rent for price filtering if needed (if not handled natively by the scraper config)
    let minRent = 0,
        maxRent = Infinity;
    if (searchConfig.rent) {
        const parts = searchConfig.rent.split('-');
        minRent = parseInt(parts[0], 10) || 0;
        maxRent = parseInt(parts[1], 10) || Infinity;
    }

    const filteredListings = [];

    for (const listing of listings) {
        // Checking negative keywords against a combined title+description string
        const combinedText = `${listing.title || ''} ${listing.description || ''}`.toLowerCase();

        const isBlacklisted = negativeKeywords.some((negKeyword) =>
            combinedText.includes(negKeyword.toLowerCase())
        );

        if (isBlacklisted) continue;

        // Optional post-filtering for price to ensure strict accuracy
        const cleanPriceString = String(listing.price || '').replace(/[^\d]/g, '');
        const parsedPrice = parseInt(cleanPriceString, 10);

        if (!isNaN(parsedPrice) && parsedPrice > 0) {
            if (parsedPrice < minRent || parsedPrice > maxRent) {
                continue;
            }
        }

        filteredListings.push(listing);
    }

    return filteredListings;
}

/**
 * Dispatches a formatted HTML message for each surviving apartment listing
 * directly to the user's Telegram Chat.
 * @param {Array<Object>} filteredListings - Final listings to send.
 * @param {string} targetChatId - Telegram user ID target for this payload.
 * @returns {Promise<void>}
 */
async function sendTelegramAlerts(filteredListings, targetChatId) {
    if (!bot) {
        console.warn('[Utils] WARNING: Telegram bot not configured. Bypassing alerts.');
        return;
    }

    if (filteredListings.length === 0) {
        console.log('[Utils] Engine check: No actionable results. Execution silent.');
        return;
    }

    console.log(`[Utils] Dispatching ${filteredListings.length} payloads to Telegram...`);

    for (const listing of filteredListings) {
        const message = `
🏢 <b>מקור:</b> ${listing.source || 'יד2'}
🏠 <b>${listing.title}</b>
💰 <b>מחיר:</b> ${listing.price}
🛏️ <b>חדרים:</b> ${listing.rooms || '-'} | 📏 <b>גודל:</b> ${listing.size || listing.sqm || '-'} | 🏢 <b>קומה:</b> ${listing.floor || '-'}

🔗 <a href="${listing.link}">למעבר למודעה לחץ כאן</a>`;

        try {
            await bot.sendMessage(targetChatId, message, {
                parse_mode: 'HTML',
                disable_web_page_preview: true,
            });
            console.log(
                `[Telegram Broadcast] Sent listing: ${listing.title || 'Untitled'} (${
                    listing.price
                }) to ${targetChatId}`
            );
        } catch (err) {
            console.error(`[Telegram Broadcast] Failure on specific item dispatch: ${err.message}`);
        }

        // Delay 1.5s between messages to prevent Telegram API rate limits (HTTP 429)
        await delay(1500);
    }
    console.log('[Utils] All alerts dispatched securely.');
}

/**
 * Dynamically constructs a Yad2 Search URL from the user's granular configs mapping Hebrew city names to Yad2 city codes.
 * @param {Object} userConfig - User configuration object { cities, rooms, rent }
 * @returns {string} Fully qualified Yad2 URL
 */
function buildYad2Url(userConfig) {
    const citiesDictPath = path.join(__dirname, 'cities_dict.json');
    let citiesDict = {};
    try {
        citiesDict = JSON.parse(fs.readFileSync(citiesDictPath, 'utf8'));
    } catch (e) {
        console.warn(`[Utils] Could not parse cities_dict.json: ${e.message}`);
    }

    const baseUrl = new URL('https://www.yad2.co.il/realestate/rent');

    if (userConfig.cities && citiesDict[userConfig.cities.trim()]) {
        baseUrl.searchParams.append('city', citiesDict[userConfig.cities.trim()]);
    }

    if (userConfig.minRent) baseUrl.searchParams.append('minPrice', userConfig.minRent.trim());
    if (userConfig.maxRent) baseUrl.searchParams.append('maxPrice', userConfig.maxRent.trim());

    if (userConfig.minRooms) baseUrl.searchParams.append('minRooms', userConfig.minRooms.trim());
    if (userConfig.maxRooms) baseUrl.searchParams.append('maxRooms', userConfig.maxRooms.trim());

    if (userConfig.minSqm)
        baseUrl.searchParams.append('minSquareMeterBuild', userConfig.minSqm.trim());
    if (userConfig.maxSqm)
        baseUrl.searchParams.append('maxSquareMeterBuild', userConfig.maxSqm.trim());

    return baseUrl.toString();
}

module.exports = {
    delay,
    readUsersConfigs,
    filterListings,
    sendTelegramAlerts,
    buildYad2Url,
};
