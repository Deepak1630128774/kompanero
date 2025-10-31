# Kompanero Tracking - Electron Desktop App

## 🚀 Quick Start

### Development Mode

1. **Install dependencies:**
```bash
npm install
```

2. **Run the Electron app:**
```bash
npm run electron
```

For development with DevTools:
```bash
npm run electron-dev
```

---

## 📦 Building Executables

### Windows
```bash
npm run build-win
```
Output: `dist/Kompanero Tracking Setup.exe`

### macOS
```bash
npm run build-mac
```
Output: `dist/Kompanero Tracking.dmg`

### Linux
```bash
npm run build-linux
```
Output: `dist/Kompanero Tracking.AppImage`

---

## 📁 Project Structure

```
kompanero-tracking/
├── electron.js          # Electron main process
├── server.js            # Express server (for web deployment)
├── public/              # Frontend files
├── scripts/             # Tracking scripts (DTDC, BlueDart, Delhivery)
├── utils/               # Utilities (CSV export, browser pool)
└── .env                 # Environment variables
```

---

## ⚙️ Environment Variables

Create a `.env` file in the root directory:

```env
SHOPIFY_STORE_URL=your-store.myshopify.com
SHOPIFY_ACCESS_TOKEN=your_access_token
SHOPIFY_API_VERSION=2024-01
```

---

## 🔧 How It Works

1. **Electron starts** → Launches Express server on port 3000
2. **Server ready** → Opens Electron window pointing to localhost:3000
3. **Your app runs** → Same UI as web version, but in desktop app
4. **Puppeteer works** → All tracking scripts work normally

---

## 📊 Features

- ✅ Desktop app with native window
- ✅ All tracking features (DTDC, BlueDart, Delhivery)
- ✅ Puppeteer scraping works perfectly
- ✅ CSV export functionality
- ✅ Auto-hide menu bar for cleaner UI
- ✅ Cross-platform (Windows, macOS, Linux)

---

## 🐛 Troubleshooting

### App won't start
- Make sure port 3000 is not in use
- Check `.env` file exists with correct credentials

### Puppeteer errors
- Run `npx puppeteer browsers install chrome`
- Check `.cache/puppeteer` directory exists

### Build errors
- Delete `node_modules` and run `npm install` again
- Make sure you have the latest Node.js version

---

## 📦 Distribution

After building, you'll get:

**Windows:** 
- `Kompanero Tracking Setup.exe` (~200-300MB)
- Users can install like any Windows app

**macOS:**
- `Kompanero Tracking.dmg` (~200-300MB)
- Drag & drop to Applications folder

**Linux:**
- `Kompanero Tracking.AppImage` (~200-300MB)
- Make executable and run: `chmod +x *.AppImage && ./Kompanero*.AppImage`

---

## 🌐 Web vs Desktop

### Web Version (Render)
```bash
npm start
```
Deploys to Render, accessible via browser

### Desktop Version (Electron)
```bash
npm run electron
```
Runs locally, standalone app

**Both versions use the same code!** 🎉

---

## 💡 Tips

1. **Development:** Use `npm run electron-dev` to see console logs
2. **Testing:** Test tracking before building executables
3. **Icons:** Add custom icons in `public/` folder:
   - `icon.ico` for Windows
   - `icon.icns` for macOS
   - `icon.png` for Linux
4. **Auto-updates:** Consider adding `electron-updater` for automatic updates

---

## 🔐 Security Notes

- `.env` file is NOT included in builds (add to .gitignore)
- Users need to configure their own Shopify credentials
- Consider encrypting sensitive data in production builds

---

## 📝 Next Steps

1. ✅ Install dependencies: `npm install`
2. ✅ Test in development: `npm run electron`
3. ✅ Build for your platform: `npm run build-win` (or mac/linux)
4. ✅ Distribute the executable to users

Enjoy your desktop app! 🎉
