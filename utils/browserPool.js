const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

class BrowserPool {
  constructor(maxConcurrent = 5) {
    this.maxConcurrent = maxConcurrent;
    this.activeBrowsers = 0;
    this.queue = [];
    this.browser = null;
    this.chromePathCached = undefined;
    console.log(`Browser pool initialized with max concurrent browsers: ${maxConcurrent}`);
  }

  // Get the Chrome executable path
  getChromePath() {
    if (this.chromePathCached !== undefined) {
      return this.chromePathCached;
    }
    // Environment override
    if (process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH) {
      this.chromePathCached = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH;
      return this.chromePathCached;
    }

    // For packaged app (production)
    if (process.env.NODE_ENV === 'production' || process.resourcesPath) {
      const appPath = process.resourcesPath || path.join(__dirname, '..');
      
      const possiblePaths = [
        // Unpacked from asar (electron-builder asarUnpack)
        path.join(appPath, 'app.asar.unpacked', 'node_modules', 'puppeteer', '.local-chromium', 'win64-142.0.7444.59', 'chrome-win64', 'chrome.exe'),
        // Alternative unpacked location
        path.join(appPath, 'app.asar.unpacked', 'node_modules', '@puppeteer', 'browsers', 'chrome', 'win64-142.0.7444.59', 'chrome-win64', 'chrome.exe'),
        // Bundled with app resources
        path.join(appPath, 'chrome', 'win64-142.0.7444.59', 'chrome-win64', 'chrome.exe'),
        path.join(appPath, 'chrome', 'chrome.exe'),
        // Local node_modules (development)
        path.join(__dirname, '..', 'node_modules', 'puppeteer', '.local-chromium', 'win64-142.0.7444.59', 'chrome-win64', 'chrome.exe'),
        // Puppeteer cache directory (new location for Puppeteer v19+)
        path.join(process.env.USERPROFILE || '', '.cache', 'puppeteer', 'chrome', 'win64-142.0.7444.59', 'chrome-win64', 'chrome.exe'),
        path.join(process.env.LOCALAPPDATA || '', 'puppeteer', 'chrome', 'win64-142.0.7444.59', 'chrome-win64', 'chrome.exe'),
        // User's local Chrome installation
        // --- Windows common installs ---
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        // --- Linux common installs (Render, Docker, etc.) ---
        '/usr/bin/google-chrome-stable',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
        path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      ];

      for (const chromePath of possiblePaths) {
        if (fs.existsSync(chromePath)) {
          console.log(`Found Chrome at: ${chromePath}`);
          this.chromePathCached = chromePath;
          return this.chromePathCached;
        }
      }
      
      console.warn('Chrome not found in any expected location. Will try default Puppeteer path.');
    }
    
    // For development, let Puppeteer use its default
    this.chromePathCached = undefined;
    return undefined;
  }

  async execute(task) {
    // Wait if we're at max capacity
    while (this.activeBrowsers >= this.maxConcurrent) {
      await new Promise(resolve => {
        this.queue.push(resolve);
      });
    }

    this.activeBrowsers++;
    let page;

    try {
      const launchOptions = {
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu'
        ]
      };

      // Add executable path for production
      const chromePath = this.getChromePath();
      if (chromePath) {
        launchOptions.executablePath = chromePath;
      }

      if (!this.browser) {
        this.browser = await puppeteer.launch(launchOptions);
      }

      page = await this.browser.newPage();
      await page.setViewport({ width: 1366, height: 768 });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await page.setDefaultNavigationTimeout(15000);
      await page.setRequestInterception(true);
      page.on('request', req => {
        const type = req.resourceType();
        if (type === 'image' || type === 'media' || type === 'font' || type === 'websocket' || type === 'webtransport' || type === 'manifest') {
          return req.abort();
        }
        const url = req.url();
        if (/(google-analytics|googletagmanager|doubleclick|facebook|hotjar|segment|mixpanel|clarity)/i.test(url)) {
          return req.abort();
        }
        req.continue();
      });

      const result = await task(page);
      return result;

    } finally {
      if (page) {
        try { await page.close(); } catch (e) {}
      }
      
      this.activeBrowsers--;
      
      // Release next waiting task
      if (this.queue.length > 0) {
        const resolve = this.queue.shift();
        resolve();
      }
    }
  }
}

// Create a singleton instance with high concurrency for speed
const browserPool = new BrowserPool(parseInt(process.env.POOL_CONCURRENCY || '5', 10));

module.exports = { browserPool };
