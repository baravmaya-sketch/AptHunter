class ScraperBot {
    /**
     * Initializes a new ScraperBot instance.
     * @param {import('playwright').Page} page - The Playwright Page object to wrap.
     */
    constructor(page) {
        this.page = page;
    }

    /**
     * Navigates the wrapped page to the given URL.
     * @param {string} url - The URL to navigate to.
     * @param {Object} options - Navigation options (defaults to waiting for domcontentloaded).
     * @returns {Promise<import('playwright').Response|null>} The main resource response.
     */
    async goto(url, options = { waitUntil: 'domcontentloaded', timeout: 45000 }) {
        return this.page.goto(url, options);
    }

    /**
     * Pauses execution for a specified duration.
     * @param {number} ms - Milliseconds to wait.
     * @returns {Promise<void>}
     */
    async wait(ms) {
        return this.page.waitForTimeout(ms);
    }

    /**
     * Clicks an element by its ARIA role and accessible name, if it becomes visible within the timeout.
     * @param {string} role - The ARIA role (e.g., 'button', 'link').
     * @param {string|RegExp} name - The accessible name of the element.
     * @param {number} timeout - Maximum time to wait for visibility in ms (default: 2000).
     * @returns {Promise<boolean>} True if the element was clicked, false if it never appeared.
     */
    async clickByRoleIfExists(role, name, timeout = 2000) {
        const btn = this.page.getByRole(role, { name });
        if (await btn.isVisible({ timeout })) {
            await btn.click();
            return true;
        }
        return false;
    }

    /**
     * Finds the first element matching the given text regex and returns its bounding box if visible.
     * Useful for determining coordinates for manual mouse movements (e.g. Captcha bypass).
     * @param {RegExp} regex - The regular expression to match element text against.
     * @param {number} timeout - Maximum time to wait for visibility in ms (default: 4000).
     * @returns {Promise<{x: number, y: number, width: number, height: number}|null>} The bounding box coordinates or null.
     */
    async getBoundingBoxByText(regex, timeout = 4000) {
        const locator = this.page.getByText(regex).first();
        if (await locator.isVisible({ timeout })) {
            return await locator.boundingBox();
        }
        return null;
    }

    /**
     * Moves the virtual mouse to the specific coordinates.
     * @param {number} x - The X-coordinate.
     * @param {number} y - The Y-coordinate.
     * @param {number} steps - Number of intermediate steps to take to simulate human movement (default: 15).
     * @returns {Promise<void>}
     */
    async mouseMove(x, y, steps = 15) {
        return this.page.mouse.move(x, y, { steps });
    }

    /**
     * Simulates pressing the mouse button down at the current mouse position.
     * @returns {Promise<void>}
     */
    async mouseDown() {
        return this.page.mouse.down();
    }

    /**
     * Simulates releasing the mouse button at the current mouse position.
     * @returns {Promise<void>}
     */
    async mouseUp() {
        return this.page.mouse.up();
    }

    /**
     * Waits for an element to be visible, focuses it, and types the provided text with a delay between keystrokes.
     * @param {string} selector - The CSS or XPath selector of the input field.
     * @param {string} text - The text to type into the field.
     * @param {number} delay - The delay in ms between key presses (default: 100).
     * @param {number} timeout - Maximum time to wait for the element to become visible (default: 5000).
     * @returns {Promise<void>}
     */
    async focusAndType(selector, text, delay = 100, timeout = 5000) {
        const locator = this.page.locator(selector);
        await locator.waitFor({ state: 'visible', timeout });
        await locator.focus();
        await locator.pressSequentially(text, { delay });
    }

    /**
     * Waits for the first matching element to become visible and clicks it.
     * @param {string} selector - The CSS or XPath selector of the target element.
     * @param {number} timeout - Maximum time to wait for visibility in ms (default: 5000).
     * @returns {Promise<void>}
     */
    async waitAndClickFirst(selector, timeout = 5000) {
        const locator = this.page.locator(selector).first();
        await locator.waitFor({ state: 'visible', timeout });
        await locator.click();
    }

    /**
     * Executes a function in the browser context, passing elements matching the selector as the first argument.
     * @param {string} selector - A selector to query the page for.
     * @param  {...any} args - The evaluation function and any additional arguments to pass to it.
     * @returns {Promise<any>} The result of the evaluated function.
     */
    async evaluate(selector, ...args) {
        return this.page.$$eval(selector, ...args);
    }
}

module.exports = ScraperBot;
