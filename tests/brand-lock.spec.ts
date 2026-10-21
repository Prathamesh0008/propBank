import {test,expect} from '@playwright/test';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';

test.beforeEach(async({page,request})=>{await request.get('http://127.0.0.1:18081/reset');await page.route('**/api/**',async route=>{const req=route.request();await route.fulfill({response:await page.request.fetch('http://127.0.0.1:18081'+new URL(req.url()).pathname+new URL(req.url()).search,{method:req.method(),headers:req.headers(),...(req.postDataBuffer()?{data:req.postDataBuffer()!}:{})})});});});
test.afterEach(async({page})=>{await page.unrouteAll({behavior:'wait'});});
for(const width of [1440,768,390])test(`locked homepage hero preserves exact pixels and geometry at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1000});const hydrated=page.waitForResponse(r=>r.url().endsWith('/api/media/session')&&r.request().method()==='DELETE');await page.goto('/');await hydrated;const hero=page.getByRole('region',{name:'Hero',exact:true});await expect(hero.getByRole('heading',{level:1})).toHaveText('Propbank acceptance');await page.evaluate(()=>document.fonts.ready);await expect.poll(()=>hero.locator('img').evaluateAll(images=>images.every(image=>(image as HTMLImageElement).complete&&(image as HTMLImageElement).naturalWidth>0))).toBe(true);await page.mouse.move(0,0);
 const geometry=await hero.evaluate(element=>{const rect=element.getBoundingClientRect(),style=getComputedStyle(element),heading=getComputedStyle(element.querySelector('h1')!);return {x:rect.x,y:rect.y,width:rect.width,height:rect.height,font:style.fontFamily,headingFont:heading.fontFamily,headingSize:heading.fontSize,headingColor:heading.color};});
 const directory='brand-batch-1/'+(process.env.BRAND_CAPTURE_BASELINE?'baseline':'after');mkdirSync(directory,{recursive:true});writeFileSync(`${directory}/hero-${width}.json`,JSON.stringify(geometry,null,2));
 if(!process.env.BRAND_CAPTURE_BASELINE)expect(geometry).toEqual(JSON.parse(readFileSync(`brand-batch-1/baseline/hero-${width}.json`,'utf8')));
 await page.screenshot({path:`${directory}/home-${width}.png`,fullPage:true,animations:'disabled'});
 const box=await hero.boundingBox();expect(box).toBeTruthy();expect(await page.screenshot({fullPage:true,clip:{...box!,height:Math.ceil(box!.height)},animations:'disabled'})).toMatchSnapshot(`hero-${width}.png`,{maxDiffPixels:0});
});
for(const width of [1440,390])test(`unlocked about content remains visually unchanged at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1000});const hydrated=page.waitForResponse(r=>r.url().endsWith('/api/media/session')&&r.request().method()==='DELETE');await page.goto('/about');await hydrated;await page.evaluate(()=>document.fonts.ready);const box=await page.locator('main').last().boundingBox();expect(box).toBeTruthy();expect(await page.screenshot({clip:box!,animations:'disabled'})).toMatchSnapshot(`about-content-${width}.png`,{maxDiffPixels:0});
});
