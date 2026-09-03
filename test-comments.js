const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

  await page.goto('http://localhost:3000/#comunidad', { waitUntil: 'networkidle2' });
  
  await new Promise(r => setTimeout(r, 2000));
  
  // click the first comment button
  await page.evaluate(() => {
    const btn = document.querySelector('.comment-btn');
    if (btn) btn.click();
    else console.log('No comment button found');
  });

  await new Promise(r => setTimeout(r, 2000));
  
  await browser.close();
})();
