"use client";

import React from "react";
import { Search, Filter } from "lucide-react";
import styles from "./SearchFilterSection.module.css";

interface SearchFilterSectionProps {
  searchType: string;
  setSearchType: (val: string) => void;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  selectedCategories: string[];
  handleCategoryToggle: (categoryId: string) => void;
  setSelectedCategories: (categories: string[]) => void;
  selectedProjectCondition: string;
  setSelectedProjectCondition: (val: string) => void;
  budgetRange: { min: number; max: number };
  setBudgetRange: (range: { min: number; max: number }) => void;
  clearFilters: () => void;
  handleSearch: () => void;
}

export const SearchFilterSection: React.FC<SearchFilterSectionProps> = ({
  searchType, setSearchType, searchQuery, setSearchQuery, selectedCategories,
  handleCategoryToggle, setSelectedCategories, selectedProjectCondition,
  setSelectedProjectCondition, budgetRange, setBudgetRange, clearFilters, handleSearch,
}) => {
  const hasFilters = Boolean(searchQuery.trim() || selectedCategories.length || selectedProjectCondition || budgetRange.min || budgetRange.max || (searchType !== "all"));
  const categoryOptions = [
    { value: "residential", label: "Residential" },
    { value: "commercial", label: "Commercial" },
    { value: "industrial", label: "Industrial" },
  ];
  const budgets = searchType === "rent"
    ? [{ value: 5000, label: "₹5,000" }, { value: 10000, label: "₹10,000" }, { value: 20000, label: "₹20,000" }, { value: 30000, label: "₹30,000" }, { value: 50000, label: "₹50,000" }, { value: 100000, label: "₹1 lakh" }, { value: 200000, label: "₹2 lakh" }, { value: 500000, label: "₹5 lakh" }]
    : [{ value: 1000000, label: "₹10 lakh" }, { value: 2000000, label: "₹20 lakh" }, { value: 3000000, label: "₹30 lakh" }, { value: 5000000, label: "₹50 lakh" }, { value: 7500000, label: "₹75 lakh" }, { value: 10000000, label: "₹1 crore" }, { value: 20000000, label: "₹2 crore" }, { value: 50000000, label: "₹5 crore" }, { value: 100000000, label: "₹10 crore" }];
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  return (
    <section id="find-property" className={styles.section} aria-labelledby="property-search-heading">
      <div className={styles.shell}>
        <div className={styles.intro}>
          <div><p className={styles.kicker}>Find your place</p><h2 id="property-search-heading">A home that <em>feels right.</em></h2></div>
          <p>Explore available spaces, compare what matters and enquire when you find a fit.</p>
        </div>
        <div className={styles.searchPanel}>
          <div className={styles.primarySearch}>
            <div className={styles.modeTabs} role="group" aria-label="Listing type">
              {[{value:"all",label:"All"},{value:"buy",label:"Buy"},{value:"rent",label:"Rent"}].map(item =>
                <button key={item.value} type="button" className={searchType === item.value ? styles.activeMode : styles.mode} aria-pressed={searchType === item.value} onClick={() => { setSearchType(item.value); setBudgetRange({min:0,max:0}); }}>{item.label}</button>
              )}
            </div>
            <div className={styles.searchInputWrap}>
              <Search aria-hidden="true" size={20}/>
              <label className={styles.srOnly} htmlFor="landing-search-location">Location, project or property</label>
              <input id="landing-search-location" type="search" value={searchQuery} onChange={(e)=>setSearchQuery(e.target.value)} onKeyDown={(e)=> {if(e.key==="Enter")handleSearch();}} placeholder="Search location, project or property" />
            </div>
            <button className={styles.searchButton} type="button" onClick={handleSearch}>Explore properties <Search size={18} aria-hidden="true"/></button>
          </div>
          <div className={styles.filterRow}>
            <div className={styles.categoryControls} aria-label="Property categories" role="group">
              <button type="button" aria-pressed={selectedCategories.length===0} className={selectedCategories.length===0?styles.selectedChip:styles.chip} onClick={()=>setSelectedCategories([])}>All spaces</button>
              {categoryOptions.map(category => <button type="button" key={category.value} aria-pressed={selectedCategories.includes(category.value)} className={selectedCategories.includes(category.value)?styles.selectedChip:styles.chip} onClick={()=>handleCategoryToggle(category.value)}>{category.label}</button>)}
            </div>
            <button type="button" className={styles.advancedToggle} aria-expanded={showAdvanced} aria-controls="landing-advanced-filters" onClick={()=>setShowAdvanced(x=>!x)}><Filter size={17} aria-hidden="true"/> More filters <span>{showAdvanced ? "−" : "+"}</span></button>
          </div>
          {showAdvanced && <div className={styles.advanced} id="landing-advanced-filters">
            <div className={styles.field}><label htmlFor="landing-condition">Project status</label><select id="landing-condition" value={selectedProjectCondition} onChange={(e)=>setSelectedProjectCondition(e.target.value)}><option value="">All projects</option><option value="New Project">New project</option><option value="Ready Project">Ready project</option><option value="Preleased">Preleased</option></select></div>
            <div className={styles.field}><label htmlFor="landing-budget-min">Minimum budget</label><select id="landing-budget-min" value={budgetRange.min} onChange={(e)=>setBudgetRange({...budgetRange,min:Number(e.target.value)})}><option value={0}>No minimum</option>{budgets.map(b=><option key={b.value} value={b.value}>{b.label}</option>)}</select></div>
            <div className={styles.field}><label htmlFor="landing-budget-max">Maximum budget</label><select id="landing-budget-max" value={budgetRange.max} onChange={(e)=>setBudgetRange({...budgetRange,max:Number(e.target.value)})}><option value={0}>No maximum</option>{budgets.map(b=><option key={b.value} value={b.value}>{b.label}</option>)}</select></div>
          </div>}
          {hasFilters && <div className={styles.activeFilters}><span>Filters selected</span><button type="button" onClick={clearFilters}>Clear all <span aria-hidden="true">×</span></button></div>}
        </div>
      </div>
    </section>
  );
};
