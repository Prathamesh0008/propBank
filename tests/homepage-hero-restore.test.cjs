const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('homepage uses the historical split hero with its original image and actions',()=>{
 const hero=fs.readFileSync('src/features/landing-page/HeroSection.tsx','utf8');
 const left=fs.readFileSync('src/features/landing-page/LeftHeroSection.tsx','utf8');
 const right=fs.readFileSync('src/features/landing-page/RightHeroSection.tsx','utf8');
 const landing=fs.readFileSync('src/features/landing-page/LandingPage.tsx','utf8');
 assert.match(hero,/GradientSpotlight/);assert.match(hero,/LeftHeroSection/);assert.match(hero,/RightHeroSection/);assert.match(hero,/grid lg:grid-cols-2/);
 assert.match(left,/\/assets\/hero-realestate\.jpg/);assert.equal(fs.existsSync('public/assets/hero-realestate.jpg'),true);
 assert.match(right,/onNavigate\("\/manage-property"\)/);assert.match(right,/onNavigate\("\/visit-planner"\)/);
 assert.match(landing,/onNavigate=\{navigate\}/);
});

test('restoring the hero leaves current surrounding homepage sections in place',()=>{
 const landing=fs.readFileSync('src/features/landing-page/LandingPage.tsx','utf8');
 for(const section of ['AnnouncementBanner','PropertyManagementSections','RealEstateIntroduction','SearchFilterSection','PropertiesSection','QuickInquirySection','PortfolioCallToAction'])assert.match(landing,new RegExp(`<${section}`));
});
