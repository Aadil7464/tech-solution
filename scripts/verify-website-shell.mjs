import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
page.setDefaultTimeout(15000);page.setDefaultNavigationTimeout(20000);const results=[];
try{
await fs.mkdir('.test-data/shell',{recursive:true});
for(const width of [1440,900,390,320]){
console.log('Checking width',width);await page.setViewportSize({width,height:1000});
await page.goto('http://localhost:3000',{waitUntil:'networkidle'});
assert.equal(await page.locator('.growth-banner').count(),1);
assert.equal(await page.locator('.growth-banner video').count(),0);
await page.locator('.agency-footer').scrollIntoViewIfNeeded();
const info=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,columns:getComputedStyle(document.querySelector('.agency-footer-grid')).gridTemplateColumns.split(' ').length,logo:document.querySelector('.header-logo img').getAttribute('src'),footerLogo:document.querySelector('.agency-footer-logo img').getAttribute('src'),ctaHeight:document.querySelector('.growth-banner').getBoundingClientRect().height,gap:Math.round(document.querySelector('.agency-footer').getBoundingClientRect().top-document.querySelector('.growth-banner').getBoundingClientRect().bottom)}));
assert.equal(info.overflow,false);assert.equal(info.columns,width>1100?4:width>550?2:1);assert.equal(info.gap,0);
await page.screenshot({path:'.test-data/shell/footer-'+width+'.png'});
await page.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';scrollTo(0,0);});await page.waitForTimeout(300);
if(width<=800){const menu=page.locator('.menu-toggle');await menu.click();await page.getByRole('navigation',{name:'Main navigation'}).getByRole('link',{name:'Contact',exact:true}).waitFor();assert.equal(await menu.getAttribute('aria-expanded'),'true');await page.screenshot({path:'.test-data/shell/header-'+width+'.png'});await page.getByRole('navigation',{name:'Main navigation'}).getByRole('link',{name:'Contact',exact:true}).click();await page.waitForURL('**/contact');assert.equal(await page.locator('.growth-banner').count(),1);}else await page.screenshot({path:'.test-data/shell/header-'+width+'.png'});
results.push({width,...info});
}
await page.goto('http://localhost:3000');
const links=await page.locator('.agency-header a,.agency-footer a,.growth-banner a').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')));
const routes=[...new Set(links.filter(h=>h.startsWith('/')))];
const checked=[];for(const route of routes){const response=await page.request.get('http://localhost:3000'+route);assert.equal(response.status(),200,route);checked.push({route,status:response.status()});}
const phones=links.filter(h=>h.startsWith('tel:'));assert.deepEqual(phones,['tel:+917464891312','tel:+918941024813','tel:+916397554750']);
assert.ok(links.includes('mailto:digitalmitra786@gmail.com'));
assert.deepEqual(errors,[]);
await fs.writeFile('.test-data/shell/verification.json',JSON.stringify({results,checked,phones,errors},null,2));console.log(JSON.stringify({results,checked,phones,errors}));
}finally{await browser.close();}

