"use client";

import { useNavigate, useSearchParams } from "@/lib/navigation";
import {useState} from "react";
import {Button} from "@/ui/button";
import PropertyTypeSelector from "./PropertyTypeSelector";

const SelectPropertyType = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [relationship,setRelationship]=useState<"owner"|"tenant"|null>(() => {
    const choice = params.get("as");
    return choice === "owner" || choice === "tenant" ? choice : null;
  });

  const handlePropertyTypeSelect = (propertyType: string) => {
    const adminOwnerUID=params.get('adminOwnerUID');
    navigate(`/add-property?type=${propertyType}&as=${relationship}${adminOwnerUID?`&adminOwnerUID=${encodeURIComponent(adminOwnerUID)}`:''}`);
  };

  return (
    <main>
      <>
        <title>Select Property Type — Add Property</title>
        <meta name="description" content="Choose between residential, commercial, or industrial property types to add your property listing." />
        <link rel="canonical" href="/select-property-type" />
      </>

      {!relationship?<section className="mx-auto max-w-3xl px-4 py-12"><h1 className="text-3xl font-bold mb-4">Add Property</h1><p className="text-muted-foreground mb-8">Are you adding a property you own or a home you rent?</p><div className="grid sm:grid-cols-2 gap-4"><Button size="lg" onClick={()=>setRelationship("owner")}>As an Owner</Button><Button size="lg" variant="outline" onClick={()=>setRelationship("tenant")}>As a Tenant</Button></div></section>:<><div className="mx-auto max-w-5xl px-4 pt-6"><Button variant="ghost" onClick={()=>setRelationship(null)}>Change owner / tenant choice</Button></div><PropertyTypeSelector
        onSelect={handlePropertyTypeSelect}
        title="What kind of property would you like to add today?"
        description="Choose the type of property you want to include in your portfolio."
      /></>}
    </main>
  );
};

export default SelectPropertyType;
