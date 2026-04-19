# AptHunter - Automated Real Estate Scraper & Telegram Bot

AptHunter is a Node.js-based bot that automatically scrapes real estate sites (Yad2) for apartments matching your criteria and sends immediate alerts to your Telegram.

## Features

- **Multi-City Search**: Select multiple cities in a single configuration using a modern searchable dropdown.
- **Disqualifying Keywords ("מילים לפסילה")**: Specify words (e.g., "מרתף", "שותפים") that will automatically filter out unwanted apartments if found in the title or description.
- **Granular Filters**: Filter by Price, Rooms, and Square Meters.
- **Telegram Bot UI**: Everything is manageable via an inline interactive Telegram bot.
- **Filter Management**: Full support for adding, editing (pre-filled), and securely deleting configurations via a modern responsive Web UI.
- **Automated Scheduler**: Runs securely via `node-cron` twice a day (04:00 & 16:00).

## How to Integrate & Setup

1. **Install Dependencies**:
   Ensure you have Node.js installed, then run:

   ```bash
   npm install
   ```

2. **Environment Configuration**:
   Create a `.env` file in the root directory and add your Telegram Bot Token:

   ```env
   TELEGRAM_BOT_TOKEN=your_bot_token_here
   PORT=3000
   ```

3. **Running the Web Server & Bot**:
   To start the backend and Telegram bot:

   ```bash
   node server.js
   ```

4. **Running the Scraper**:
   The scraper runs automatically via `cron` daily, but you can trigger it manually for debugging:
   ```bash
   node scraper.js --run-now
   ```

## Architecture Notes

- All code is formatted cleanly using modern ES6+ paradigms.
- Disqualifying keywords are stored seamlessly under `customNegativeKeywords` array in `users_configs.json`.
- `seen_listings.json` guarantees duplicate alerts are never dispatched.
