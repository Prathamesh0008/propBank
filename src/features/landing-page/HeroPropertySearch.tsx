"use client";

import { useState } from "react";
import { Building2, MapPin, Search, Wallet } from "lucide-react";
import styles from "./HeroPropertySearch.module.css";

export interface HeroPropertySearchSelection {
  type: "buy" | "rent";
  location: string;
  category: string;
  condition: string;
  budget: number;
}

const purchaseBudgets = [1000000, 2000000, 3000000, 5000000, 7500000, 10000000, 20000000, 50000000, 100000000];
const rentalBudgets = [5000, 10000, 20000, 30000, 50000, 100000, 200000, 500000];
const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export function HeroPropertySearch({ onSearch, embedded = false }: { onSearch: (selection: HeroPropertySearchSelection) => void; embedded?: boolean }) {
  const [mode, setMode] = useState<"buy" | "rent" | "projects">("buy");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState("");
  const [budget, setBudget] = useState(0);
  const budgets = mode === "rent" ? rentalBudgets : purchaseBudgets;

  return (
    <section className={`${styles.section} ${embedded ? styles.embedded : ""}`} aria-label="Find a property">
      <div className={styles.shell}>
        <div className={styles.tabs} role="group" aria-label="Search listing type">
          {(["buy", "rent", "projects"] as const).map(tab => (
            <button key={tab} type="button" aria-pressed={mode === tab}
              className={mode === tab ? styles.activeTab : styles.tab}
              onClick={() => { setMode(tab); if ((mode === "rent") !== (tab === "rent")) setBudget(0); }}>
              {tab === "buy" ? "Buy" : tab === "rent" ? "Rent" : "Projects"}
            </button>
          ))}
        </div>
        <form data-demo-autofill="off" className={styles.panel} onSubmit={event => {
          event.preventDefault();
          onSearch({ type: mode === "rent" ? "rent" : "buy", location: location.trim(), category,
            condition: mode === "projects" ? "New Project" : "", budget });
        }}>
          <div className={styles.field}>
            <MapPin size={21} strokeWidth={1.5} aria-hidden="true" />
            <div><label htmlFor="hero-search-location">Location</label>
              <input id="hero-search-location" type="search" placeholder="City or locality" value={location}
                onChange={event => setLocation(event.target.value)} /></div>
          </div>
          <div className={styles.field}>
            <Building2 size={21} strokeWidth={1.5} aria-hidden="true" />
            <div><label htmlFor="hero-search-category">Property Type</label>
              <select id="hero-search-category" value={category} onChange={event => setCategory(event.target.value)}>
                <option value="">All property types</option><option value="residential">Residential</option>
                <option value="commercial">Commercial</option><option value="industrial">Industrial</option>
              </select></div>
          </div>
          <div className={styles.field}>
            <Wallet size={21} strokeWidth={1.5} aria-hidden="true" />
            <div><label htmlFor="hero-search-budget">Budget{mode === "rent" ? " / month" : ""}</label>
              <select id="hero-search-budget" value={budget} onChange={event => setBudget(Number(event.target.value))}>
                <option value={0}>Any budget</option>
                {budgets.map(value => <option key={value} value={value}>Up to {currency.format(value)}</option>)}
              </select></div>
          </div>
          <button type="submit" className={styles.submit}><Search size={19} strokeWidth={1.7} aria-hidden="true" />Search Properties</button>
        </form>
      </div>
    </section>
  );
}
