#!/usr/bin/env bash
# Render build script for Puppeteer

echo "Installing dependencies..."
npm install

echo "Installing Chrome for Puppeteer..."
npx puppeteer browsers install chrome

echo "Build completed successfully!"
