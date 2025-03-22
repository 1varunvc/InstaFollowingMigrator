// followPeople.js

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

function randomDelay(min, max) {
    return new Promise(resolve =>
        setTimeout(resolve, Math.floor(Math.random() * (max - min + 1)) + min)
    );
}

async function dismissPopups(page) {
    const notNowButtons = await page.$$("xpath/.//button[contains(text(), 'Not Now')]");
    if (notNowButtons.length) {
        for (const btn of notNowButtons) {
            await btn.click();
            await randomDelay(1000, 1500);
        }
    }
}

async function simulateHumanInteraction(page) {
    try {
        await page.evaluate(() => window.scrollBy(0, Math.floor(Math.random() * 300) + 50));
        await randomDelay(1000, 2000);
        await page.evaluate(() => window.scrollBy(0, -Math.floor(Math.random() * 150)));
        await randomDelay(1000, 2000);
    } catch (e) {
        console.error("Scrolling simulation error:", e);
    }

    try {
        const randomX = Math.floor(Math.random() * 600) + 50;
        const randomY = Math.floor(Math.random() * 600) + 50;
        await page.mouse.move(randomX, randomY, { steps: 20 });
        await randomDelay(1000, 2000);
    } catch (e) {
        console.error("Mouse movement error:", e);
    }
}

module.exports = async function followPeople() {
    let followings = [];
    try {
        console.log("Read the saved followings list");
        const data = fs.readFileSync(path.join(__dirname, 'followings.json'), 'utf-8');
        followings = JSON.parse(data);
    } catch (e) {
        console.error('Error reading followings.json:', e);
        return;
    }

    console.log("Parse the SKIP_NAMES from the .env file (comma-separated)");
    const skipNames = process.env.SKIP_NAMES ? process.env.SKIP_NAMES.split(',').map(name => name.trim()) : [];
    const accountsToFollow = followings.filter(name => !skipNames.includes(name));
    console.log('Accounts to follow:', accountsToFollow);

    const browser = await puppeteer.launch({ headless: false });
    try {
        const sidePage = await browser.newPage();
        await sidePage.goto('https://www.instagram.com/accounts/login/');
        await sidePage.waitForSelector('input[name="username"]', { visible: true });
        await randomDelay(1000, 1500);
        await sidePage.type('input[name="username"]', process.env.SIDE_USERNAME, { delay: 100 });
        await randomDelay(500, 1000);
        await sidePage.type('input[name="password"]', process.env.SIDE_PASSWORD, { delay: 100 });
        await randomDelay(500, 1000);
        await sidePage.click('button[type="submit"]');
        await sidePage.waitForNavigation({ timeout: 15000 }).catch(e => console.error("Navigation timeout during side login:", e));
        await randomDelay(2000, 3000);
        await dismissPopups(sidePage);

        let index = 0;
        while (index < accountsToFollow.length) {
            console.log("Randomize batch size between 18 and 22 accounts per batch");
            const batchSize = Math.floor(Math.random() * 5) + 18;
            const batch = accountsToFollow.slice(index, index + batchSize);

            for (const username of batch) {
                try {
                    const profileUrl = `https://www.instagram.com/${username}/`;
                    await sidePage.goto(profileUrl);
                    await randomDelay(3000, 5000);
                    await simulateHumanInteraction(sidePage);

                    try {
                        await sidePage.waitForSelector('button', { timeout: 5000 });
                    } catch (e) {
                        console.error(`No button found on ${username}'s page; skipping.`);
                        continue;
                    }

                    const buttonText = await sidePage.evaluate(() => {
                        const btn = document.querySelector('button');
                        return btn ? btn.innerText.toLowerCase() : '';
                    });

                    if (buttonText === 'follow') {
                        const followButton = await sidePage.$('button');
                        if (followButton) {
                            const box = await followButton.boundingBox();
                            if (box) {
                                await sidePage.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 15 });
                                await randomDelay(1000, 1500);
                            }
                        }
                        await sidePage.click('button');
                        console.log(`Followed ${username}`);
                    } else {
                        console.log(`Skipped ${username} (button text: ${buttonText})`);
                    }
                } catch (profileError) {
                    console.error(`Error processing ${username}:`, profileError);
                }

                await randomDelay(4000, 7000);
            }

            index += batchSize;
            const waitTimeMinutes = Math.random() * (2.5 - 1.5) + 1.5;
            const waitTime = waitTimeMinutes * 60 * 1000;
            console.log(`Batch complete. Waiting for approximately ${waitTimeMinutes.toFixed(1)} minutes before next batch...`);
            await sidePage.waitForTimeout(waitTime);
        }
    } catch (e) {
        console.error("Error in followPeople:", e);
    } finally {
        await browser.close();
    }
};
