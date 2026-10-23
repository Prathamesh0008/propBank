"use client";

import { useNavigate, useSearchParams } from "@/lib/navigation";
import { useState } from "react";
import { ArrowLeft, ArrowRight, KeyRound, Building2 } from "lucide-react";
import PropertyTypeSelector from "./PropertyTypeSelector";
import styles from "./SelectPropertyType.module.css";

const SelectPropertyType = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [relationship, setRelationship] = useState<"owner" | "tenant" | null>(() => {
    const choice = params.get("as");
    return choice === "owner" || choice === "tenant" ? choice : null;
  });

  const handlePropertyTypeSelect = (propertyType: string) => {
    const next = new URLSearchParams({type:propertyType,as:relationship||'owner'});
    const adminOwnerUID=params.get('adminOwnerUID');
    if(adminOwnerUID)next.set('adminOwnerUID',adminOwnerUID);
    navigate(`/add-property?${next.toString()}`);
  };

  return (
    <main className={styles.page}>
      {!relationship ? (
        <section className={styles.inner} aria-labelledby="add-property-heading">
          <p className={styles.kicker}>Your property workspace</p>
          <h1 id="add-property-heading" className={styles.heading}>First, tell us your connection to the property.</h1>
          <p className={styles.intro}>We'll tailor the next steps to the information you need to share.</p>
          <div className={styles.choices}>
            <button type="button" className={styles.choice} onClick={() => setRelationship("owner")}>
              <Building2 aria-hidden="true" className={styles.icon} />
              <span className={styles.choiceText}><strong>I'm the owner</strong><span>Add a property you own or manage.</span></span>
              <ArrowRight aria-hidden="true" className={styles.arrow} />
            </button>
            <button type="button" className={styles.choice} onClick={() => setRelationship("tenant")}>
              <KeyRound aria-hidden="true" className={styles.icon} />
              <span className={styles.choiceText}><strong>I'm a tenant</strong><span>Record the home or space you're renting.</span></span>
              <ArrowRight aria-hidden="true" className={styles.arrow} />
            </button>
          </div>
          <p className={styles.note}>Property ownership and tenant records follow different verification steps.</p>
        </section>
      ) : (
        <section className={styles.inner} aria-label="Select the property category">
          <button type="button" className={styles.back} onClick={() => setRelationship(null)}>
            <ArrowLeft size={16} aria-hidden="true" /> Change owner / tenant choice
          </button>
          <p className={styles.kicker}>Adding as {relationship === "owner" ? "an owner" : "a tenant"}</p>
          <PropertyTypeSelector
            onSelect={handlePropertyTypeSelect}
            title="What type of property is this?"
            description="Choose the category that best describes the property to continue."
          />
        </section>
      )}
    </main>
  );
};

export default SelectPropertyType;
