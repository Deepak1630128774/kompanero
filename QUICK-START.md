# 🚀 Quick Start Guide

## Choose Your Version

### 🌐 Web Version (Render Deployment)
```bash
npm start
```
Access via browser at `http://localhost:3000`

---

### 🖥️ Desktop App (Electron)

#### **Option 1: Double-click (Windows)**
Just double-click: `START-ELECTRON.bat`

#### **Option 2: Command Line**
```bash
npm install
npm run electron
```

---

## 📦 First Time Setup

1. **Clone the repository**
```bash
git clone https://github.com/Deepak1630128774/kompanero.git
cd kompanero-tracking
```

2. **Install dependencies**
```bash
npm install
```

3. **Create `.env` file**
```env
SHOPIFY_STORE_URL=your-store.myshopify.com
SHOPIFY_ACCESS_TOKEN=your_access_token
SHOPIFY_API_VERSION=2024-01
```

4. **Run the app**
- **Web:** `npm start`
- **Desktop:** `npm run electron`

---

## 🏗️ Build Desktop Executable

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

## 📋 Available Commands

| Command | Description |
|---------|-------------|
| `npm start` | Run web server (for Render) |
| `npm run electron` | Run desktop app |
| `npm run electron-dev` | Run desktop app with DevTools |
| `npm run build-win` | Build Windows executable |
| `npm run build-mac` | Build macOS app |
| `npm run build-linux` | Build Linux AppImage |

---

## ✅ What Works

- ✅ DTDC tracking with Puppeteer
- ✅ BlueDart tracking with browser pool
- ✅ Delhivery tracking with browser pool
- ✅ Shopify order fetching with pagination
- ✅ CSV export
- ✅ Works on both web and desktop

---

## 🎯 Next Steps

1. Test the desktop app: `npm run electron`
2. If it works, build executable: `npm run build-win`
3. Share the `.exe` file with your team
4. They just need to:
   - Install the app
   - Create their own `.env` file
   - Run the app!

---

## 🆘 Need Help?

See `ELECTRON-README.md` for detailed documentation.

---

**Enjoy your desktop app!** 🎉
