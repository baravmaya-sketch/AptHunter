require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const path = require("path");
const cors = require("cors");
const fs = require("fs");
const dataManager = require("./data_manager");

/**
 * Generates a simplistic unique identifier for configuration entries without
 * pulling in external dependencies like UUID.
 * @returns {string} A pseudo-random unique ID string.
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}

// 1. Initialize Bot
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error(
    "FATAL ERROR: TELEGRAM_BOT_TOKEN is not defined in the environment.",
  );
  process.exit(1);
}
const bot = new TelegramBot(token, { polling: true });

// 2. Initialize Express
const app = express();
const PORT = process.env.PORT || 3000;
// Telegram API does not allow "localhost" in inline button URLs.
// We use 127.0.0.1 for local dev, but you should set BASE_URL in .env for production.
const BASE_URL = process.env.BASE_URL || `http://127.0.0.1:${PORT}`;

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

const citiesDictPath = path.join(__dirname, "cities_dict.json");
let citiesMap = {};
if (fs.existsSync(citiesDictPath)) {
  try {
    const dict = JSON.parse(fs.readFileSync(citiesDictPath, "utf8"));
    for (const [name, code] of Object.entries(dict)) {
      citiesMap[code] = name;
    }
  } catch (e) {
    console.error("Failed to parse cities dict", e);
  }
}

function getCityNames(citiesArray) {
  if (!citiesArray) return "לא נבחרו ערים";
  const arr = Array.isArray(citiesArray) ? citiesArray : [citiesArray];
  return arr.map((code) => citiesMap[code] || code).join(", ");
}

// 3. Telegram Bot Logic
bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  // Send main menu on every message (/start or free text)
  sendMainMenu(chatId);
});

/**
 * Dispatches the main inline keyboard menu to the user's Telegram chat.
 * @param {number|string} chatId - The ID of the chat interacting with the bot.
 */
function sendMainMenu(chatId) {
  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "➕ הוסף סינון",
            url: `${BASE_URL}/?chatId=${chatId}&action=add`,
          },
        ],
        [{ text: "✏️ ערוך סינון", callback_data: "EDIT_CONFIG" }],
        [{ text: "🗑️ מחק סינון", callback_data: "DELETE_CONFIG" }],
      ],
    },
  };
  bot.sendMessage(
    chatId,
    "ברוכים הבאים למערכת חיפוש הדירות האוטומטית! 🏘️\nבחר פעולה מהתפריט:",
    keyboard,
  );
}

bot.on("callback_query", (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  bot.answerCallbackQuery(query.id);

  const configs = dataManager.getUserConfigs(chatId.toString());

  if (data === "EDIT_CONFIG") {
    if (configs.length === 0) {
      bot.sendMessage(chatId, "⚠️ אין לך עדיין סינונים במערכת.");
      return;
    }
    const buttons = configs.map((c) => [
      {
        text: `ערוך: ${getCityNames(c.cities)}`,
        url: `${BASE_URL}/?chatId=${chatId}&action=edit&configId=${c.id}`,
      },
    ]);
    bot.sendMessage(chatId, "בחר איזה סינון תרצה לערוך:", {
      reply_markup: { inline_keyboard: buttons },
    });
  } else if (data === "DELETE_CONFIG") {
    if (configs.length === 0) {
      bot.sendMessage(chatId, "⚠️ אין לך עדיין סינונים במערכת.");
      return;
    }
    const buttons = configs.map((c) => [
      {
        text: `מחק: ${getCityNames(c.cities)}`,
        url: `${BASE_URL}/?chatId=${chatId}&action=delete&configId=${c.id}`,
      },
    ]);
    bot.sendMessage(chatId, "בחר איזה סינון תרצה למחוק לגמרי:", {
      reply_markup: { inline_keyboard: buttons },
    });
  }
});

// 4. Express API Routes
app.get("/api/config", (req, res) => {
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

app.get("/api/cities", (req, res) => {
  try {
    const citiesPath = path.join(__dirname, "cities_dict.json");

    let cities = {};
    if (fs.existsSync(citiesPath)) {
      cities = JSON.parse(fs.readFileSync(citiesPath, "utf8"));
    }

    // Return an array of structured mappings for the frontend
    const structuredCities = Object.keys(cities).map((name) => ({
      name: name,
      code: cities[name],
    }));

    res.json(structuredCities);
  } catch (e) {
    res.status(500).json({ error: "Failed to load cities" });
  }
});

app.post("/api/save-config", (req, res) => {
  const { chatId, config, action } = req.body;

  if (!chatId || !config || !config.cities) {
    return res
      .status(400)
      .json({ error: "Invalid payload or missing required fields." });
  }

  if (!config.id) {
    config.id = generateId(); // Assign an ID for new configs
  }

  try {
    dataManager.saveUserConfig(chatId.toString(), config);
    const actionText = action === "edit" ? "עודכן" : "נוסף";
    const cityNames = getCityNames(config.cities);
    bot.sendMessage(
      chatId,
      `✅ הסינון עבור ${cityNames} ${actionText} בהצלחה! לאיתור תוצאות המבוססות על הסינון החדש, ההרצה הבאה תתעדכן אוטומטית.`,
    );
    res.status(200).json({ success: true, id: config.id });
  } catch (e) {
    if (e.message.includes("limit")) {
      return res.status(403).json({ error: e.message });
    }
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/delete-config", (req, res) => {
  const { chatId, configId } = req.body;
  if (!chatId || !configId) {
    return res.status(400).json({ error: "Missing parameters" });
  }

  try {
    const config = dataManager.getConfig(chatId, configId);
    if (config) {
      dataManager.deleteUserConfig(chatId.toString(), configId);
      bot.sendMessage(
        chatId,
        `✅ הסינון עבור ${getCityNames(config.cities)} נמחק בהצלחה!`,
      );
    }
    res.status(200).json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(
    `[Express] AptHunter Web UI Server actively listening at ${BASE_URL}`,
  );
  console.log(
    `[Telegram] AptHunter Bot connected and polling for user actions.`,
  );
});
