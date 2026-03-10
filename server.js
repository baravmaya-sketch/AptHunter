require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const path = require('path');
const cors = require('cors');
const dataManager = require('./data_manager');

/**
 * Generates a simplistic unique identifier for configuration entries without
 * pulling in external dependencies like UUID.
 * 
 * @returns {string} A pseudo-random unique ID string.
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// 1. Initialize Bot
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
    console.error("FATAL ERROR: TELEGRAM_BOT_TOKEN is not defined in the environment.");
    process.exit(1);
}
const bot = new TelegramBot(token, { polling: true });

// 2. Initialize Express
const app = express();
const PORT = process.env.PORT || 3000;
// Note: Hardcoded localhost for the local development. In production this would be an actual domain.
const BASE_URL = `http://localhost:${PORT}`; 

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// 3. Telegram Bot Logic
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    // Send main menu on every message (/start or free text)
    sendMainMenu(chatId);
});

/**
 * Dispatches the main inline keyboard menu to the user's Telegram chat.
 * 
 * @param {number|string} chatId - The ID of the chat interacting with the bot.
 */
function sendMainMenu(chatId) {
    const keyboard = {
        reply_markup: {
            inline_keyboard: [
                [{ text: "➕ הוסף סינון", callback_data: "ADD_CONFIG" }],
                [{ text: "✏️ ערוך סינון", callback_data: "EDIT_CONFIG" }],
                [{ text: "🗑️ מחק סינון", callback_data: "DELETE_CONFIG" }]
            ]
        }
    };
    bot.sendMessage(chatId, "ברוכים הבאים למערכת חיפוש הדירות האוטומטית! 🏘️\nבחר פעולה מהתפריט:", keyboard);
}

bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    bot.answerCallbackQuery(query.id);

    const configs = dataManager.getUserConfigs(chatId.toString());

    if (data === "ADD_CONFIG") {
        if (configs.length >= 2) {
            bot.sendMessage(chatId, "❌ הגעת למגבלת הסינונים האפשרית (מקסימום 2). ניתן למחוק סינון קיים כדי להוסיף חדש.");
            return;
        }
        const link = `${BASE_URL}/?chatId=${chatId}&action=add`;
        bot.sendMessage(chatId, `לחץ על הקישור הבא כדי להגדיר סינון חדש:\n${link}`);
    } 
    else if (data === "EDIT_CONFIG") {
        if (configs.length === 0) {
            bot.sendMessage(chatId, "⚠️ אין לך עדיין סינונים במערכת.");
            return;
        }
        const buttons = configs.map(c => [{ text: `ערוך: ${c.cities} (${c.rent} ש"ח)`, url: `${BASE_URL}/?chatId=${chatId}&action=edit&configId=${c.id}` }]);
        bot.sendMessage(chatId, "בחר איזה סינון תרצה לערוך:", { reply_markup: { inline_keyboard: buttons } });
    }
    else if (data === "DELETE_CONFIG") {
        if (configs.length === 0) {
            bot.sendMessage(chatId, "⚠️ אין לך עדיין סינונים במערכת.");
            return;
        }
        const buttons = configs.map(c => [{ text: `מחק: ${c.cities} (${c.rent} ש"ח)`, callback_data: `DEL_${c.id}` }]);
        bot.sendMessage(chatId, "בחר איזה סינון תרצה למחוק לגמרי:", { reply_markup: { inline_keyboard: buttons } });
    }
    else if (data.startsWith("DEL_")) {
        const configId = data.replace("DEL_", "");
        dataManager.deleteUserConfig(chatId.toString(), configId);
        bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: query.message.message_id });
        bot.sendMessage(chatId, "✅ הסינון נמחק בהצלחה!");
        sendMainMenu(chatId);
    }
});

// 4. Express API Routes
app.get('/api/config', (req, res) => {
    const { chatId, configId } = req.query;
    if (!chatId || !configId) {
        return res.status(400).json({ error: "Missing parameters" });
    }
    const config = dataManager.getConfig(chatId, configId);
    if (!config) {
        return res.status(404).json({ error: "Config not found" });
    }
    res.json(config);
});

app.post('/api/save-config', (req, res) => {
    const { chatId, config, action } = req.body;
    
    if (!chatId || !config || !config.cities || !config.rent) {
        return res.status(400).json({ error: "Invalid payload or missing required fields." });
    }

    if (!config.id) {
        config.id = generateId(); // Assign an ID for new configs
    }

    try {
        dataManager.saveUserConfig(chatId.toString(), config);
        const actionText = action === 'edit' ? "עודכן" : "נוסף";
        bot.sendMessage(chatId, `✅ הסינון ל-${config.cities} ${actionText} בהצלחה! לאיתור תוצאות המבוססות על הסינון החדש, ההרצה הבאה תתעדכן אוטומטית.`);
        res.status(200).json({ success: true, id: config.id });
    } catch (e) {
        if (e.message.includes("limit")) {
            return res.status(403).json({ error: e.message });
        }
        res.status(500).json({ error: e.message });
    }
});

app.listen(PORT, () => {
    console.log(`[Express] AptHunter Web UI Server actively listening at ${BASE_URL}`);
    console.log(`[Telegram] AptHunter Bot connected and polling for user actions.`);
});
