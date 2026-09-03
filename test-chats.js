const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

  // Login first
  await page.goto('http://localhost:3000/#login', { waitUntil: 'networkidle2' });
  await page.type('input[type="email"]', 'demo@patamatch.com');
  await page.type('input[type="password"]', 'demo123');
  await page.click('button[type="submit"]');
  
  await new Promise(r => setTimeout(r, 2000));
  
  // Go to chats
  await page.goto('http://localhost:3000/#chats', { waitUntil: 'networkidle2' });
  
  await new Promise(r => setTimeout(r, 2000));
  
  await browser.close();
})();
