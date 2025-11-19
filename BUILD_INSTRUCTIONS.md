# Build Instructions for Kompanero Tracking

## Problem Fixed
The "Could not find Chrome" error has been resolved by configuring the app to:
1. Bundle Chrome with the application during build
2. Automatically detect Chrome in multiple locations (bundled, cache, system)
3. Fall back to system Chrome if bundled Chrome is not available

## Prerequisites
Before building, ensure Chrome is downloaded by Puppeteer:

```bash
npm install
npm run postinstall
```

This will download Chrome to `%USERPROFILE%\.cache\puppeteer\chrome\`

**IMPORTANT:** The build process will automatically:
1. Run `prepare-chrome.js` to copy Chrome to `chrome-bundle/`
2. Include the Chrome bundle in the final `.exe`
3. Extract Chrome to the app's resources folder

## Building the Application

### For Windows Portable (Recommended for distribution)
```bash
npm run build:win:portable
```

This creates a portable `.exe` file in the `dist` folder that includes Chrome.

### For Windows Installer
```bash
npm run build:win
```

### For Development Testing
```bash
npm run electron
```

## Verifying Chrome Installation

Check if Chrome is downloaded:
```bash
dir %USERPROFILE%\.cache\puppeteer\chrome
```

You should see a folder like `win64-142.0.7444.59` containing Chrome.

After running the build, verify Chrome was bundled:
```bash
dir chrome-bundle
```

## Distribution to Clients

When giving the `.exe` to clients:

1. **Option 1 (Recommended)**: Distribute the entire output folder from `dist/`
   - The folder contains the `.exe` and all necessary files
   - Chrome is bundled in `app.asar.unpacked`

2. **Option 2**: If clients have Chrome installed
   - The app will automatically detect and use their system Chrome
   - Located at: `C:\Program Files\Google\Chrome\Application\chrome.exe`

## Troubleshooting

### If Chrome is still not found:

1. **Check Chrome was downloaded during build:**
   ```bash
   npm run postinstall
   ```

2. **Verify the build includes Chrome:**
   - After building, check `dist/win-unpacked/resources/chrome/win64-142.0.7444.59/`

3. **Check logs:**
   - The app logs which Chrome path it finds
   - Look for: "Found Chrome at: [path]"

4. **Manual Chrome installation:**
   - Ask clients to install Google Chrome
   - The app will automatically detect it

### Build Size
The packaged app will be larger (~150-200MB) because it includes Chrome. This is normal and necessary for the app to work on systems without Chrome installed.

## Notes
- The app automatically detects if it's running in production (packaged) or development
- In development, it uses the local `node_modules` Chrome
- In production, it uses the unpacked Chrome from the asar archive
- Falls back to system Chrome if bundled Chrome is not found
