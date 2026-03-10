# AptHunter: Automated Real Estate Scraper & Tracker 🏢

![AptHunter](https://img.shields.io/badge/AptHunter-AutoScraper-orange?style=for-the-badge&logo=appveyor)
![Playwright](https://img.shields.io/badge/Playwright-Stealth-green?style=for-the-badge&logo=playwright)
![Telegram](https://img.shields.io/badge/Telegram_Bot-Integrated-blue?style=for-the-badge&logo=telegram)
![NodeJS](https://img.shields.io/badge/Node.js-Express-lightgreen?style=for-the-badge&logo=nodedotjs)

AptHunter is a powerful, highly-automated real estate search engine and SaaS platform. Driven by [Playwright](https://playwright.dev/) running in stealth mode and integrated with a custom [Telegram Bot](https://core.telegram.org/bots/api), AptHunter actively scrapes housing markets, precisely filters results based on extensive user parameters (Price, Rooms, Roommates, Negative Keywords), and immediately dispatches alerts to users in Telegram to give them the unfair advantage in a competitive housing market.

Featuring a full-stack architecture, users can add and edit their search filters using a responsive, modern Web App (built with Tailwind CSS) directly from Telegram's inline keyboards.

## ✨ Features

- **Robust Web Automation**: Utilizes `playwright-extra` running the `stealth` plugin to bypass basic automated browser detection checks.
- **Telegram Bot Integration**: Full two-way communication. Interact with the bot to see your filter menus (Add, Edit, Delete), and receive beautifully formatted HTML alerts when a new apartment hits the market.
- **Aesthetic Web UI**: A clean, fully responsive RTL (Hebrew) Web Application built natively with Tailwind CSS to manage search criteria.
- **Persistent Memory Deduplication**: Memorizes seen listings in a local `seen_listings.json` file to guarantee that you will strictly only receive alerts for genuinely *new* apartments. 
- **Advanced Filtering**: Eliminates redundant or unwanted apartments natively using your personal dictionary of Negative Keywords logic.
- **RESTful API**: Clean Express Server wrapping user data (up to 2 configuration profiles per user) handled cleanly by a local Data Manager. 

## 🛠 Tech Stack

- **Backend**: Node.js, Express.js
- **Scraping Engine**: Playwright Extra, Puppeteer Stealth
- **Bot Interface**: `node-telegram-bot-api`
- **Frontend**: HTML5, Vanilla JavaScript, Tailwind CSS (via CDN)
- **Data Persistence**: Local Storage (JSON structured state-management)

## 📦 Prerequisites

Before starting, ensure you have the following installed on your machine:

- **Node.js**: `v16.14.0` or higher
- **NPM**: `v8.0.0` or higher
- **Telegram Account**: A valid Telegram Bot Token from [@BotFather](https://t.me/botfather).

## 🚀 Installation & Local Setup

1. **Clone the Repository**
   ```bash
   git clone https://github.com/yourusername/AptHunter.git
   cd AptHunter
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Install Playwright Browsers**
   This downloads the Chromium instances required for headless scraping.
   ```bash
   npx playwright install chromium
   ```

4. **Environment Variables**
   Create a `.env` file at the root of the project with your Telegram credentials:
   ```env
   TELEGRAM_BOT_TOKEN=your_bot_token_here
   TELEGRAM_CHAT_ID=your_chat_id_here
   PORT=3000
   ```

5. **Start the Express Application**
   ```bash
   node server.js
   ```
   > The terminal should confirm: `[Express] AptHunter Web UI Server actively listening at http://localhost:3000` and `[Telegram] AptHunter Bot connected and polling`.

## 💻 Usage

1. **Begin the Bot Interaction**: Open your Telegram App, find your compiled bot, and send the `/start` command.
2. **Setup your Filter**: Click **"➕ הוסף סינון"** in the Inline Keyboard. It will securely route you to the local Web App on port 3000.
3. **Save your Layout**: Choose your City, Rooms, and Rent constraints. Click submit. The UI closes, and the config is saved locally.
4. **Trigger the Orchestrator**: Currently configured to be executed locally. Simply run:
   ```bash
   node scraper.js
   ```
   *Note: In production, `scraper.js` can be executed on a crontab schedule (e.g., every 5 minutes).*

---
<p align="center">Built with ❤️ to hunt the best apartments on the market.</p>
