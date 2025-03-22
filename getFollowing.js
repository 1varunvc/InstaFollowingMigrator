// getFollowing.js

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

function randomDelay(min, max) {
    console.log("Random Delay");
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
    console.log("Scroll down then up to simulate reading.");
    await page.evaluate(() => window.scrollBy(0, Math.floor(Math.random() * 300) + 50));
    await randomDelay(1000, 2000);
    await page.evaluate(() => window.scrollBy(0, -Math.floor(Math.random() * 150)));
    await randomDelay(1000, 2000);

    console.log("Additional random mouse movement.");
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

        console.log("Navigate to the profile page and open the following modal");
        const profileUrl = `https://www.instagram.com/${process.env.MAIN_USERNAME}/`;
        await page.goto(profileUrl);
        await randomDelay(2000, 3000);

        console.log("Click on the 'following' button – using a case-insensitive search");
        const [followingButton] = await page.$$("xpath/.//section//main//header//ul//li//a[span]//span[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'following')]");
        await followingButton?.click();

        console.log("Wait for the modal container.");
        console.log("Use a CSS selector to look for a div inside the dialog that contains a 'max-height' style.");
        const modalSelector = 'div[role="dialog"] div[style*="max-height"]';
        await page.waitForSelector(modalSelector, { visible: true, timeout: 10000 });
        await randomDelay(2000, 3000);

        console.log("Scroll the modal until all followings are loaded.");
        let previousHeight;
        try {
            while (true) {
                console.log("Get current scroll height of the modal");
                previousHeight = await page.evaluate(selector => {
                    const modal = document.querySelector(selector);
                    return modal ? modal.scrollHeight : 0;
                }, modalSelector);

                console.log("Scroll down by 300px in the modal");
                await page.evaluate(selector => {
                    const modal = document.querySelector(selector);
                    if (modal) {
                        modal.scrollBy(0, 100000);
                    }
                }, modalSelector);

                console.log("Wait for new items to load");
                await randomDelay(5000, 10000);

                console.log("Get new scroll height");
                const newHeight = await page.evaluate(selector => {
                    const modal = document.querySelector(selector);
                    return modal ? modal.scrollHeight : 0;
                }, modalSelector);

                console.log("If the scroll height hasn't increased, assume we reached the end");
                if (newHeight === previousHeight) break;
            }
        } catch (e) {
            console.error('Error during modal scrolling:', e);
        }

        console.log("Extract usernames using updated selectors.");
        followings = await page.evaluate(() => {
            console.log("Instagram followings are rendered as <a> elements with specific classes.");
            const elements = document.querySelectorAll('a.notranslate._a6hd');
            return Array.from(elements).map(el => el.textContent.trim());
        });
        console.log('Extracted Followings:', followings);

        console.log("Save the followings list to followings.json.");
        fs.writeFileSync(path.join(__dirname, 'followings.json'), JSON.stringify(followings, null, 2));
        console.log('Followings saved to followings.json');
    } catch (e) {
        console.error("Error in getFollowing:", e);
    } finally {
        await browser.close();
    }
};
