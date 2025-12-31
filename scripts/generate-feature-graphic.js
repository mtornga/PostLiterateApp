#!/usr/bin/env node

/**
 * Generate Play Store Feature Graphic (1024x500 PNG)
 *
 * Prerequisites:
 *   npm install puppeteer sharp
 *
 * Usage:
 *   node scripts/generate-feature-graphic.js
 */

const fs = require('fs');
const path = require('path');

console.log('🎨 Feature Graphic Generator for "Read This For Me"\n');

// Check if puppeteer is installed
let puppeteer;
try {
    puppeteer = require('puppeteer');
} catch (err) {
    console.log('❌ Puppeteer not installed.');
    console.log('\n📦 Install with: npm install --save-dev puppeteer');
    console.log('\n🌐 Alternative: Open AppScreenshots/feature-graphic.html in your browser');
    console.log('   Then use browser dev tools to screenshot the graphic:');
    console.log('   1. Right-click on the graphic');
    console.log('   2. Inspect element');
    console.log('   3. Right-click the div.feature-graphic in dev tools');
    console.log('   4. Choose "Capture node screenshot"\n');
    process.exit(1);
}

async function generateFeatureGraphic() {
    const htmlPath = path.join(__dirname, '../AppScreenshots/feature-graphic.html');
    const outputPath = path.join(__dirname, '../AppScreenshots/feature-graphic-1024x500.png');

    if (!fs.existsSync(htmlPath)) {
        console.error('❌ feature-graphic.html not found');
        process.exit(1);
    }

    console.log('🚀 Launching browser...');
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();

    await page.setViewport({ width: 1200, height: 700 });

    console.log('📄 Loading HTML...');
    await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });

    console.log('📸 Capturing screenshot...');
    const element = await page.$('.feature-graphic');

    if (!element) {
        console.error('❌ Could not find .feature-graphic element');
        await browser.close();
        process.exit(1);
    }

    await element.screenshot({
        path: outputPath,
        omitBackground: false,
    });

    await browser.close();

    console.log(`✅ Feature graphic saved to: ${outputPath}`);
    console.log('\n📏 Dimensions: 1024x500 PNG');
    console.log('📤 Ready for Google Play Console upload!\n');
}

generateFeatureGraphic().catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
