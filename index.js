require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

// 1. Initialize Bot
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
    console.error("FATAL ERROR: TELEGRAM_BOT_TOKEN is not defined in the environment.");
    process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

// 2. Load the external keywords dictionary
const keywordsDictPath = path.join(__dirname, 'keywords_dict.json');
let keywordsDict = {};
try {
    const data = fs.readFileSync(keywordsDictPath, 'utf8');
    keywordsDict = JSON.parse(data);
    console.log("Loaded keywords_dict.json successfully.");
} catch (err) {
    console.error("Failed to read keywords_dict.json:", err.message);
    process.exit(1);
}

// 3. Keep track of user sessions via chat IDs
const sessions = {};

// Bot State Enum
const STATES = {
    CITIES: 'CITIES',
    RENT: 'RENT',
    ROOMS: 'ROOMS',
    SUBLET: 'SUBLET',
    ROOMMATES: 'ROOMMATES',
    BROKER: 'BROKER'
};

// Reusable Inline Keyboard
const yesNoKeyboard = {
    reply_markup: {
        inline_keyboard: [
            [
                { text: "כן", callback_data: "כן" },
                { text: "לא", callback_data: "לא" },
                { text: "לא משנה", callback_data: "לא משנה" }
            ]
        ]
    }
};

// 4. Handle /start to begin the interview
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;

    sessions[chatId] = {
        state: STATES.CITIES,
        data: {
            cities: '',
            rent: '',
            rooms: '',
            sublet: '',
            roommates: '',
            broker: '',
            positive_keywords: [],
            negative_keywords: []
        }
    };

    bot.sendMessage(chatId, 'באילו ערים לחפש?');
});

// 5. Handle text responses based on current state
bot.on('message', (msg) => {
    const chatId = msg.chat.id;

    // Ignore if it's a command or user doesn't have an active session
    if (!sessions[chatId] || msg.text?.startsWith('/')) return;

    const session = sessions[chatId];
    const text = msg.text;

    switch (session.state) {
        case STATES.CITIES:
            session.data.cities = text;
            session.state = STATES.RENT;
            bot.sendMessage(chatId, 'מה טווח שכר הדירה? (מחירים בין 1,000 ל-15,000 בקפיצות של 500. לדוגמה: 3500-4500)');
            break;
        case STATES.RENT:
            const rentParts = text.split('-');
            if (rentParts.length !== 2) {
                bot.sendMessage(chatId, '❌ קלט לא תקין. יש להזין טווח תקין בקפיצות של 500 (לדוגמה: 3500-4500). נסה שוב:');
                return;
            }
            
            const minR = parseInt(rentParts[0].trim(), 10);
            const maxR = parseInt(rentParts[1].trim(), 10);
            
            if (isNaN(minR) || isNaN(maxR) || 
                minR < 1000 || minR > 15000 || 
                maxR < 1000 || maxR > 15000 || 
                minR % 500 !== 0 || maxR % 500 !== 0 || 
                minR >= maxR) {
                bot.sendMessage(chatId, '❌ קלט לא תקין. יש להזין טווח תקין בקפיצות של 500 (לדוגמה: 3500-4500). נסה שוב:');
                return;
            }

            session.data.rent = text;
            session.state = STATES.ROOMS;
            bot.sendMessage(chatId, 'מה טווח החדרים? (לדוגמה: 2-3)');
            break;
        case STATES.ROOMS:
            session.data.rooms = text;
            session.state = STATES.SUBLET;
            bot.sendMessage(chatId, 'האם אתה פתוח לדירות סאבלט?', yesNoKeyboard);
            break;
        default:
            // Input for inline keyboard questions should be ignored if sent via text
            break;
    }
});

// 6. Handle inline keyboard callback queries
bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id;
    if (!sessions[chatId]) return;

    const session = sessions[chatId];
    const answer = query.data; // "כן", "לא", "לא משנה"
    const messageId = query.message.message_id;

    // Answer to remove the loading spinner and prevent timeout warnings on the Telegram client side
    bot.answerCallbackQuery(query.id);

    // Remove the inline keyboard to prevent double clicking/editing old messages
    bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: messageId });

    // Helper to dynamically inject keywords
    const appendKeywords = (category, ans) => {
        if (ans === 'לא משנה') return;
        const catData = keywordsDict[category]?.[ans];
        if (catData) {
            if (catData.positive) session.data.positive_keywords.push(...catData.positive);
            if (catData.negative) session.data.negative_keywords.push(...catData.negative);
        }
    };

    switch (session.state) {
        case STATES.SUBLET:
            session.data.sublet = answer;
            appendKeywords('Sublet', answer);
            session.state = STATES.ROOMMATES;
            bot.sendMessage(chatId, 'שותפים?', yesNoKeyboard);
            break;

        case STATES.ROOMMATES:
            session.data.roommates = answer;
            appendKeywords('Roommates', answer);
            session.state = STATES.BROKER;
            bot.sendMessage(chatId, 'תיווך?', yesNoKeyboard);
            break;

        case STATES.BROKER:
            session.data.broker = answer;
            appendKeywords('Broker', answer);

            // Mark as done
            session.state = null;
            finishSession(chatId, session.data);
            break;
    }
});

// 7. Finish session, summarize details, and save the config
function finishSession(chatId, data) {
    // Deduplicate any overlapping keywords
    data.positive_keywords = [...new Set(data.positive_keywords)];
    data.negative_keywords = [...new Set(data.negative_keywords)];

    // Send formatted summary
    const summary = `
<b>סיכום העדפות החיפוש שלך:</b>

📍 <b>ערים:</b> ${data.cities}
💰 <b>שכר דירה:</b> ${data.rent}
🛏 <b>חדרים:</b> ${data.rooms}

📋 <b>העדפות נוספות:</b>
סאבלט: ${data.sublet}
שותפים: ${data.roommates}
תיווך: ${data.broker}
`;

    bot.sendMessage(chatId, summary, { parse_mode: 'HTML' });

    // Save configuration locally
    const configPath = path.join(__dirname, 'search_config.json');
    try {
        fs.writeFileSync(configPath, JSON.stringify(data, null, 2), 'utf8');
        console.log(`Saved search configuration for Chat ID ${chatId} to search_config.json`);
    } catch (err) {
        console.error("Error writing to search_config.json:", err);
    }

    // Clear user session to allow new searches
    delete sessions[chatId];
}

console.log("AptHunter Bot is awake and polling...");
