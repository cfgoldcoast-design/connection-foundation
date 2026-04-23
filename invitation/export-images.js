const puppeteer = require('puppeteer');
const path = require('path');

const files = [
  { file: 'CF-post-instagram-facebook.html',  width: 1080, height: 1080 },
  { file: 'CF-story-indoor.html',             width: 1080, height: 1920 },
  { file: 'CF-story-outdoor.html',            width: 1080, height: 1920 },
  { file: 'CF-story-indoor-withinfo.html',    width: 1080, height: 1920 },
  { file: 'CF-story-outdoor-withinfo.html',   width: 1080, height: 1920 },
  { file: 'CF-whatsapp-facebook-group.html',  width: 1200, height: 628  },
  { file: 'CF-facebook-cover.html',           width: 1640, height: 624  },
];

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  for (const { file, width, height } of files) {
    const filePath = 'file:///' + path.resolve(__dirname, file).replace(/\\/g, '/');
    const outFile = file.replace('.html', '.png');

    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.goto(filePath, { waitUntil: 'networkidle0' });
    await page.screenshot({
      path: outFile,
      clip: { x: 0, y: 0, width, height }
    });

    console.log(`✓ ${outFile}`);
  }

  await browser.close();
  console.log('\nDone — all images exported.');
})();
