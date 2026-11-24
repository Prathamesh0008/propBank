const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('homepage uses the approved villa hero with working discovery actions',()=>{
 const hero=fs.readFileSync('src/features/landing-page/HeroSection.tsx','utf8');
 const landing=fs.readFileSync('src/features/landing-page/LandingPage.tsx','utf8');
 assert.match(hero,/aria-labelledby="homepage-hero-heading"/);assert.match(hero,/Find, Manage and/);assert.match(hero,/Grow Your Property/);
 assert.match(hero,/<HeroImageCarousel/);assert.equal(fs.existsSync('public/images/hero/villa-pool.webp'),true);
 assert.match(hero,/to="\/properties"/);assert.match(hero,/Explore Properties/);assert.match(hero,/to="#how-it-works-heading"/);assert.match(hero,/How It Works/);
 assert.doesNotMatch(hero,/GradientSpotlight|LeftHeroSection|RightHeroSection/);
 assert.match(landing,/onNavigate=\{navigate\}/);
});

test('approved homepage retains discovery, services and enquiry workflows without duplicate introduction',()=>{
 const landing=fs.readFileSync('src/features/landing-page/LandingPage.tsx','utf8');
 for(const section of ['AnnouncementBanner','HeroPropertySearch','PropertyManagementServices','PropertyManagementSections','SearchFilterSection','PropertiesSection','QuickInquirySection','PortfolioCallToAction'])assert.match(landing,new RegExp(`<${section}`));
 assert.doesNotMatch(landing,/<RealEstateIntroduction/);
});
