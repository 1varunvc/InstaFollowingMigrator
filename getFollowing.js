// getFollowing.js

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Utility: random delay in milliseconds
function randomDelay(min, max) {
    return new Promise(resolve =>
        setTimeout(resolve, Math.floor(Math.random() * (max - min + 1)) + min)
    );
}

async function dismissPopups(page) {
    // Using the updated syntax with "xpath/" prefix
    const notNowButtons = await page.$$("xpath/.//button[contains(text(), 'Not now')]");
    if (notNowButtons.length) {
        for (const btn of notNowButtons) {
            await btn.click();
            await randomDelay(1000, 1500);
        }
    }
}

async function simulateHumanInteraction(page) {
    // Scroll down then up to simulate reading.
    await page.evaluate(() => window.scrollBy(0, Math.floor(Math.random() * 300) + 50));
    await randomDelay(1000, 2000);
    await page.evaluate(() => window.scrollBy(0, -Math.floor(Math.random() * 150)));
    await randomDelay(1000, 2000);

    // Additional random mouse movement.
    const randomX = Math.floor(Math.random() * 600) + 50;
    const randomY = Math.floor(Math.random() * 600) + 50;
    await page.mouse.move(randomX, randomY, { steps: 20 });
    await randomDelay(1000, 2000);
}

module.exports = async function getFollowing() {
    let followings = [];
    const browser = await puppeteer.launch({ headless: false, defaultViewport: null });
    const page = await browser.newPage();

    try {
        await page.setViewport({ width: 1728, height: 1117 });
        await page.goto('https://www.instagram.com/accounts/login/');
        await page.waitForSelector('input[name="username"]', { visible: true });
        await randomDelay(1000, 1500);
        await page.type('input[name="username"]', process.env.MAIN_USERNAME, { delay: 100 });
        await randomDelay(500, 1000);
        await page.type('input[name="password"]', process.env.MAIN_PASSWORD, { delay: 100 });
        await randomDelay(500, 1000);
        await page.click('button[type="submit"]');
        await page.waitForNavigation({ timeout: 15000 }).catch(e => console.error("Navigation timeout during login:", e));
        await randomDelay(2000, 3000);
        await dismissPopups(page);

        // Navigate to the profile and then open the following modal
        const profileUrl = `https://www.instagram.com/${process.env.MAIN_USERNAME}/`;
        await page.goto(profileUrl);
        await randomDelay(2000, 3000);
        const [element] = await page.$$("xpath/.//section//main//header//ul//li//a[span]//span[contains(text(), 'following')]");
        await element?.click();
        // await page.goto(`${profileUrl}following/`);

        // Wait for the modal container.
        // From the provided HTML, the scrollable container seems to be the div with style containing "overflow: hidden auto"
        const modalSelector = "xpath/.//div[@role='dialog']//div[contains(@style, 'overflow: hidden auto')]";
        await page.waitForSelector(modalSelector, { visible: true, timeout: 10000 });
        await randomDelay(2000, 3000);

        // Scroll the modal until all followings are loaded.
        let previousHeight = 0;
        try {
            while (true) {
                previousHeight = await page.evaluate(selector => {
                    const el = document.evaluate(selector, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                    return el ? el.scrollHeight : 0;
                }, modalSelector);
                await page.evaluate(selector => {
                    const el = document.evaluate(selector, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                    if (el) el.scrollTo(0, el.scrollHeight);
                }, modalSelector);
                await randomDelay(1500, 2500);
                const newHeight = await page.evaluate(selector => {
                    const el = document.evaluate(selector, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                    return el ? el.scrollHeight : 0;
                }, modalSelector);
                if (newHeight === previousHeight) break;
            }
        } catch (e) {
            console.error('Error during modal scrolling:', e);
        }

        // Extract usernames using updated selectors (based on the provided HTML)
        followings = await page.evaluate(() => {
            const elements = document.querySelectorAll('a.notranslate._a6hd');
            return Array.from(elements).map(el => el.textContent);
        });
        console.log('Extracted Followings:', followings);

        // Save the followings list to followings.json.
        fs.writeFileSync(path.join(__dirname, 'followings.json'), JSON.stringify(followings, null, 2));
        console.log('Followings saved to followings.json');
    } catch (e) {
        console.error("Error in getFollowing:", e);
    } finally {
        await browser.close();
    }
};
