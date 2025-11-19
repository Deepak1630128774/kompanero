const fs = require('fs-extra');
const path = require('path');
const os = require('os');

async function prepareChrome() {
  console.log('🔍 Preparing Chrome for build...');
  
  const userProfile = process.env.USERPROFILE || os.homedir();
  const chromeSource = path.join(userProfile, '.cache', 'puppeteer', 'chrome', 'win64-142.0.7444.59');
  const chromeTarget = path.join(__dirname, '..', 'chrome-bundle', 'win64-142.0.7444.59');
  
  try {
    // Check if Chrome exists in cache
    if (!fs.existsSync(chromeSource)) {
      console.error('❌ Chrome not found in Puppeteer cache!');
      console.log('📥 Please run: npm run postinstall');
      process.exit(1);
    }
    
    console.log(`📦 Found Chrome at: ${chromeSource}`);
    
    // Create target directory
    await fs.ensureDir(chromeTarget);
    
    // Copy Chrome to bundle directory
    console.log('📋 Copying Chrome to bundle directory...');
    await fs.copy(chromeSource, chromeTarget, {
      overwrite: true,
      errorOnExist: false
    });
    
    console.log('✅ Chrome prepared successfully!');
    console.log(`📁 Bundle location: ${chromeTarget}`);
    
    // Verify the executable exists
    const chromeExe = path.join(chromeTarget, 'chrome-win64', 'chrome.exe');
    if (fs.existsSync(chromeExe)) {
      console.log('✅ Chrome executable verified!');
    } else {
      console.error('❌ Chrome executable not found after copy!');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Error preparing Chrome:', error.message);
    process.exit(1);
  }
}

prepareChrome();
