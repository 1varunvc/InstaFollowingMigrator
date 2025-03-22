// app.js

require('dotenv').config();

const runExtract = process.env.RUN_EXTRACT === 'true';
const runFollow = process.env.RUN_FOLLOW === 'true';

(async () => {
    if (runExtract) {
        console.log('Starting extraction process...');
        await require('./getFollowing')();
    }

    if (runFollow) {
        console.log('Starting follow process...');
        await require('./followPeople')();
    }

    if (!runExtract && !runFollow) {
        console.log('No process selected. Please set RUN_EXTRACT and/or RUN_FOLLOW to true in your .env file.');
    }
})();
