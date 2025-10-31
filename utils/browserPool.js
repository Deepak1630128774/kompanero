const puppeteer = require('puppeteer');

class BrowserPool {
  constructor(maxConcurrent = 5) {
    this.maxConcurrent = maxConcurrent;
    this.activeBrowsers = 0;
    this.queue = [];
  }

  async execute(task) {
    // Wait if we're at max capacity
    while (this.activeBrowsers >= this.maxConcurrent) {
      await new Promise(resolve => {
        this.queue.push(resolve);
      });
    }

    this.activeBrowsers++;
    let browser;

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

      // Use system Chrome if PUPPETEER_EXECUTABLE_PATH is set
      if (process.env.PUPPETEER_EXECUTABLE_PATH) {
        launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
      }

      browser = await puppeteer.launch(launchOptions);

      const page = await browser.newPage();
      const result = await task(page);
      return result;

    } finally {
      if (browser) {
        await browser.close();
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

// Create a singleton instance
const browserPool = new BrowserPool(5);

module.exports = { browserPool };
