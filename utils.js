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
const chatId = process.env.TELEGRAM_CHAT_ID;

let bot = null;
if (token && chatId) {
    bot = new TelegramBot(token, { polling: false });
} else {
    console.warn("WARNING: Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID. Notifications disabled.");
}

/**
 * Promisified setTimeout for async/await flow control.
 * 
 * @param {number} ms - Milliseconds to delay execution.
 * @returns {Promise<void>}
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Reads and parses the user's search configuration from the disk.
 * 
 * @returns {Object} The parsed search configuration.
 * @throws {Error} If `search_config.json` is missing or cannot be read.
 */
function readConfig() {
    const configPath = path.join(__dirname, 'search_config.json');
    if (!fs.existsSync(configPath)) {
        throw new Error("[Utils] Critical Error: search_config.json is missing.");
    }
    const configData = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(configData);
}

/**
 * Filters an array of apartment listings based on strict user constraints.
 * Excludes listings containing negative keywords and enforces strict rent bounds.
 * 
 * @param {Array<Object>} listings - Raw unverified listings extracted by the scraper.
 * @param {Object} searchConfig - The user configuration containing constraints.
 * @returns {Array<Object>} Highly relevant listings that survived the filtering.
 */
function filterListings(listings, searchConfig) {
    console.log("[Utils] Engine applying filtering logic to structured datasets...");
    const negativeKeywords = searchConfig.negative_keywords || [];

    // Parse rent for price filtering if needed (if not handled natively by the scraper config)
    let minRent = 0, maxRent = Infinity;
    if (searchConfig.rent) {
        const parts = searchConfig.rent.split('-');
        minRent = parseInt(parts[0], 10) || 0;
        maxRent = parseInt(parts[1], 10) || Infinity;
    }

    const filteredListings = [];

    for (const listing of listings) {
        // Checking negative keywords against a combined title+description string
        const combinedText = `${listing.title || ''} ${listing.description || ''}`.toLowerCase();

        let isBlacklisted = false;
        for (const negKeyword of negativeKeywords) {
            if (combinedText.includes(negKeyword.toLowerCase())) {
                isBlacklisted = true;
                break;
            }
        }

        if (isBlacklisted) continue;

        // Optional post-filtering for price to ensure strict accuracy
        const cleanPriceString = (listing.price || '').replace(/[^\d]/g, '');
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
 * 
 * @param {Array<Object>} filteredListings - Final listings to send.
 * @returns {Promise<void>}
 */
async function sendTelegramAlerts(filteredListings) {
    if (!bot) {
        console.warn("[Utils] WARNING: Telegram bot not configured. Bypassing alerts.");
        return;
    }

    if (filteredListings.length === 0) {
        console.log("[Utils] Engine check: No actionable results. Execution silent.");
        return;
    }

    console.log(`[Utils] Dispatching ${filteredListings.length} payloads to Telegram...`);

    for (const listing of filteredListings) {
        const message = `
🏢 <b>מקור:</b> ${listing.source}
🏠 <b>${listing.title}</b>
💰 <b>מחיר:</b> ${listing.price}

📝 <b>תיאור:</b>
${listing.description || 'ללא תיאור נוסף'}

🔗 <a href="${listing.link}">למעבר למודעה לחץ כאן</a>`;

        try {
            await bot.sendMessage(chatId, message, { parse_mode: 'HTML', disable_web_page_preview: true });
            console.log(`[Telegram Broadcast] Sent listing: ${listing.title || 'Untitled'} (${listing.price})`);
        } catch (err) {
            console.error(`[Telegram Broadcast] Failure on specific item dispatch: ${err.message}`);
        }

        // Delay 1.5s between messages to prevent Telegram API rate limits (HTTP 429)
        await delay(1500);
    }
    console.log("[Utils] All alerts dispatched securely.");
}

module.exports = {
    delay,
    readConfig,
    filterListings,
    sendTelegramAlerts
};
