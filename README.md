# AptHunter 🏡

AptHunter is a personal apartment hunting automation tool designed to streamline the real estate search process. It continuously monitors real estate platforms based on your exact criteria and sends real-time notifications directly to your Telegram when a matching property is found. 

It features an integrated Telegram bot coupled with a clean, responsive web interface that allows you to easily configure your search preferences from any device.

---

## ✨ Features

- **Multi-City Search**: Seamlessly search across multiple cities simultaneously using a modern, searchable dropdown interface.
- **Granular Filtering**: Filter apartments by price range, square meters, and number of rooms to find exactly what you need.
- **Intelligent Blacklist (Disqualifying Keywords)**: Specify custom words or phrases (e.g., "basement", "roommates"). The system will automatically disqualify and hide any listings containing these keywords in the title or description.
- **Telegram Bot Integration**: Manage everything—from adding new filters to deleting old ones—directly via an inline interactive Telegram bot.
- **Automated Notifications**: Receive instant, formatted alerts for new properties, ensuring you never miss an opportunity.
- **Duplicate Prevention**: A robust tracking system ensures that you are only notified of new, unseen listings.

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js
- **Frontend**: HTML5, Vanilla JavaScript, Tailwind CSS
- **Integration**: node-telegram-bot-api
- **Storage**: Local JSON files (No external database required)
- **Automation**: node-cron

## 📂 Project Structure

- `server.js`: The main entry point for the Express web server and Telegram bot logic.
- `scraper.js`: The automation engine responsible for querying data and filtering results.
- `data_manager.js`: Handles persistent read/write operations for user configurations.
- `public/`: Contains the frontend assets (`index.html`) for the filter configuration web page.
- `users_configs.json`: Stores user-defined filters, preferences, and blacklist keywords.
- `seen_listings.json`: Keeps a record of previously processed listings to prevent duplicate alerts.

## 🚀 Installation & Setup

1. **Clone the repository** (if you haven't already):
   ```bash
   git clone https://github.com/baravmaya-sketch/AptHunter.git
   cd AptHunter
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Environment Configuration**:
   Create a `.env` file in the root directory and add your required configurations:
   ```env
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
   PORT=3000
   BASE_URL=http://your_public_domain_or_ip:3000
   ```

## 📱 How to Use

1. **Start the server and bot**:
   ```bash
   node server.js
   ```

2. **Interact with the Bot**:
   - Open Telegram and start a chat with your bot.
   - Send the `/start` command to open the main menu.
   - Use the inline buttons to **Add**, **Edit**, or **Delete** your search filters.
   
3. **Configure Filters**:
   - Tapping an action button in Telegram will securely open a dedicated web interface.
   - Use the web interface to define your targeted cities, price range, property size, and blacklist keywords.
   - Click "Save" to apply the filter. The bot will automatically update its search parameters.

## ⚙️ Running the Automation

The scraping engine is designed to run automatically in the background using `cron` jobs.

To trigger the automation manually (useful for testing and debugging), run:
```bash
node scraper.js --run-now
```

---

## ⚖️ Legal & Disclaimer

**IMPORTANT: Please read carefully before using this software.**

- **Personal Use Only**: This project was built strictly for educational and personal convenience purposes. It is for non-commercial use only.
- **Compliance with Terms of Service**: The user is solely responsible for complying with the Terms of Service (ToS) of any website or platform being accessed or scraped by this tool. Automated web scraping may violate the Terms of Service of certain platforms. **Use at your own risk.**
- **No Liability**: The author assumes no responsibility or liability for any misuse of this tool, nor for any violations of third-party website policies, terms of service, or applicable local and international laws.
- **As-Is Software**: This tool is provided "as-is" without any warranties. The author does not guarantee the accuracy, completeness, or reliability of the data retrieved.
