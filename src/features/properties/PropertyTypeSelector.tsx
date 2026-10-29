"use client";

import { ArrowUpRight, Building, Building2, Factory } from "lucide-react";
import styles from "./PropertyTypeSelector.module.css";

type PropertyType = "residential" | "commercial" | "industrial";

interface PropertyTypeSelectorProps {
  onSelect: (type: PropertyType) => void;
  title: string;
  description?: string;
}

const propertyTypes = [
  { id: "residential", title: "Residential", description: "Apartments, flats, houses and bungalows", icon: Building },
  { id: "commercial", title: "Commercial", description: "Offices, retail spaces, shops and showrooms", icon: Building2 },
  { id: "industrial", title: "Industrial", description: "Warehouses, factories, sheds and industrial plots", icon: Factory },
] as const;

const PropertyTypeSelector = ({ onSelect, title, description }: PropertyTypeSelectorProps) => (
  <div className={styles.wrapper}>
    <header className={styles.heading}>
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </header>
    <div className={styles.list}>
      {propertyTypes.map(({ id, title: name, description: detail, icon: Icon }) => (
        <button type="button" key={id} onClick={() => onSelect(id)} className={styles.option} aria-label={`Select ${name} property`}>
          <span className={styles.symbol}><Icon aria-hidden="true" size={27} strokeWidth={1.5} /></span>
          <span className={styles.copy}><strong>{name}</strong><span>{detail}</span></span>
          <ArrowUpRight className={styles.arrow} size={22} aria-hidden="true" />
        </button>
      ))}
    </div>
  </div>
);

export default PropertyTypeSelector;
