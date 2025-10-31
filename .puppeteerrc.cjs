const {join} = require('path');
const os = require('os');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Use system cache on production, local cache for development
  cacheDirectory: process.env.NODE_ENV === 'production' 
    ? join(os.homedir(), '.cache', 'puppeteer')
    : join(__dirname, '.cache', 'puppeteer'),
};
