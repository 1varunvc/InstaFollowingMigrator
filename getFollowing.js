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
    const notNowButtons = await page.$$("xpath/.//button[contains(text(), 'Not now')]");
    if (notNowButtons.length) {
        for (const btn of notNowButtons) {
            await btn.click();
            await randomDelay(1000, 1500);
        }
    }
}

async function simulateHumanInteraction(page) {
    // Scroll down a bit then up to simulate reading.
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
    const browser = await puppeteer.launch({ headless: false, defaultViewport: null});
    const mainPage = await browser.newPage();

    try {
        await mainPage.setViewport({
            width: 1728,
            height: 1117,
        });
        await mainPage.goto('https://www.instagram.com/accounts/login/');
        await mainPage.waitForSelector('input[name="username"]', { visible: true });
        await randomDelay(1000, 1500);
        await mainPage.type('input[name="username"]', process.env.MAIN_USERNAME, { delay: 100 });
        await randomDelay(500, 1000);
        await mainPage.type('input[name="password"]', process.env.MAIN_PASSWORD, { delay: 100 });
        await randomDelay(500, 1000);
        await mainPage.click('button[type="submit"]');
        await mainPage.waitForNavigation({ timeout: 15000 }).catch(e => console.error("Navigation timeout during login:", e));
        await randomDelay(2000, 3000);
        await dismissPopups(mainPage);

        // Navigate to the "following" list (opens in a modal)
        const profileUrl = `https://www.instagram.com/${process.env.MAIN_USERNAME}/`;
        await mainPage.goto(profileUrl);
        await randomDelay(2000, 3000);
        await mainPage.goto(`${profileUrl}following/`);

        // Wait for the modal container
        const modalSelector = 'html > body > div:nth-of-type(4) > div:nth-of-type(2) > div > div > div:nth-of-type(1) > div > div:nth-of-type(2) > div > div > div > div > div:nth-of-type(2) > div > div > div:nth-of-type(3) > div:nth-of-type(1) > div > div:nth-of-type(1) > div > div > div > div:nth-of-type(2) > div > div > div > div > span > div > a > div > div > span';
        await mainPage.waitForSelector(modalSelector, { visible: true, timeout: 10000 });
        await randomDelay(2000, 3000);

        // Scroll the modal to load all followings
        let previousHeight = 0;
        try {
            while (true) {
                previousHeight = await mainPage.evaluate(selector => {
                    const el = document.querySelector(selector);
                    return el ? el.scrollHeight : 0;
                }, modalSelector);
                await mainPage.evaluate(selector => {
                    const el = document.querySelector(selector);
                    if (el) el.scrollTo(0, el.scrollHeight);
                }, modalSelector);
                await randomDelay(1500, 2500);
                const newHeight = await mainPage.evaluate(selector => {
                    const el = document.querySelector(selector);
                    return el ? el.scrollHeight : 0;
                }, modalSelector);
                if (newHeight === previousHeight) break;
            }
        } catch (e) {
            console.error('Error during modal scrolling:', e);
        }

        // Extract usernames; adjust selector if Instagram changes its DOM
        followings = await mainPage.evaluate(() => {
            const elements = document.querySelectorAll('a.FPmhX');
            return Array.from(elements).map(el => el.textContent);
        });
        console.log('Extracted Followings:', followings);

        // Save the followings list to followings.json in the project root.
        fs.writeFileSync(path.join(__dirname, 'followings.json'), JSON.stringify(followings, null, 2));
        console.log('Followings saved to followings.json');
    } catch (e) {
        console.error("Error in getFollowing:", e);
    } finally {
        await browser.close();
    }
};
