"use client";
import {propertyPricing} from '@/lib/property-presentation';

import {formatPropertyAddress} from "@/lib/property-address";

import PropertyPurposeSummary from "@/features/properties/PropertyPurposeSummary";
import {readDiscoveryFilters, discoveryParams, filterDiscoveryProperties, sortDiscoveryProperties, type DiscoveryFilters} from "./discovery-filters";
import {purposeLabel} from "@/lib/property-purpose";

import { apiFetch } from '@/lib/api-client';
import {useQueryClient} from '@tanstack/react-query';

import { useState, useEffect, useRef, useMemo } from "react";
import { useSearchParams, Link, useNavigate } from "@/lib/navigation";
import { Search, MapPin, BedDouble, Bath, Maximize, Loader2, ArrowUpRight, SlidersHorizontal, X, ArrowRight } from "lucide-react";
import styles from "./SearchResults.module.css";
import { propertyService, Property } from "@/services/propertyService";
import { useToast } from "@/hooks/use-toast";
import { auth } from "../../firebase";
import { API_BASE_URL } from "../../utils/config";
import {useDataRefresh} from '@/lib/data-refresh';

const placeholderImage="data:image/svg+xml,"+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect width="640" height="400" fill="#f1ede4"/><path d="M260 230v-85h120v85m-140 0h160M280 165h20m20 0h20m-60 25h20m20 0h20" fill="none" stroke="#a3864f" stroke-width="5"/><text x="320" y="280" text-anchor="middle" fill="#586375" font-family="sans-serif" font-size="17">Photograph unavailable</text></svg>');
const priceFormatter=new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0});

const SearchResults = () => {
  const queryClient=useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const initial=readDiscoveryFilters(new URLSearchParams(searchParams.toString()));
  const [filters,setFilters]=useState<DiscoveryFilters>(initial);
  const [error,setError]=useState('');
  const [failedAppend,setFailedAppend]=useState(false);
  const {toast}=useToast();const navigate=useNavigate();
  const [sendingEnquiry,setSendingEnquiry]=useState<string|null>(null);
  const enquiryInFlight=useRef(false);
  const [showFilters,setShowFilters]=useState(false);
  const [cursors,setCursors]=useState<Record<string,string|null>>({});
  const lastSearchKey=useRef('');
  const searchGeneration=useRef(0);const appliedSearch=useRef<DiscoveryFilters>(initial);
  const locationKey=searchParams.toString();
  const performSearch=async(selection:DiscoveryFilters,append=false)=>{
    const generation=++searchGeneration.current;if(!append){appliedSearch.current=selection;lastSearchKey.current='';setProperties([]);setCursors({});}setLoading(true);setError('');setFailedAppend(append);
    const kinds=selection.kinds.length?selection.kinds:[selection.type];const pending=kinds.filter(kind=>!append||!!cursors[kind]);
    try{
      const pages=await Promise.all(pending.map(kind=>queryClient.fetchQuery({queryKey:['publicProperties','search',selection.query,kind,selection.condition,selection.categories.join(','),append?cursors[kind]||'':''],queryFn:()=>propertyService.searchPropertyPage(selection.query,kind,selection.condition,append?cursors[kind]||'':'',selection.categories),staleTime:60_000,retry:false})));
      if(generation!==searchGeneration.current)return;appliedSearch.current=selection;lastSearchKey.current=discoveryParams({...selection,sort:'recommended'}).toString();
      const results=filterDiscoveryProperties(pages.flatMap(page=>page.properties||[]),selection);
      setProperties(previous=>[...new Map([...(append?previous:[]),...results].map(property=>[property.id,property])).values()]);
      setCursors(previous=>Object.fromEntries(kinds.map(kind=>[kind,pending.includes(kind)?pages[pending.indexOf(kind)].nextCursor||null:previous[kind]||null])));
    }catch{if(generation===searchGeneration.current){setError('Properties could not be loaded. Please try again.');if(!append){setProperties([]);setCursors({});}}}finally{if(generation===searchGeneration.current)setLoading(false);}
  };
  useEffect(()=>{const selection=readDiscoveryFilters(new URLSearchParams(locationKey));setFilters(selection);const key=discoveryParams({...selection,sort:'recommended'}).toString();if(key===lastSearchKey.current){appliedSearch.current=selection;return;}void performSearch(selection);return()=>{searchGeneration.current++;};
  // URL navigation owns applied searches; draft edits must not issue requests.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[locationKey]);
  useDataRefresh(['properties'],()=>{void performSearch(appliedSearch.current);});
  const applyFilters=(selection=filters)=>{
    if(selection.min&&selection.max&&selection.min>selection.max){toast({title:'Check your budget',description:'Maximum budget must be at least the minimum budget.',variant:'destructive'});return;}
    const params=discoveryParams(selection);if(params.toString()===locationKey)void performSearch(selection);else setSearchParams(params);
  };
  const handleSearch=(event:React.FormEvent)=>{event.preventDefault();applyFilters();};
  const handleTypeChange=(type:'buy'|'rent')=>{const selection={...filters,type,kinds:[],min:0,max:0};setFilters(selection);applyFilters(selection);};
  const clearFilters=()=>{const selection=readDiscoveryFilters(new URLSearchParams({type:filters.type}));setFilters(selection);applyFilters(selection);};
  const updateFilter=<K extends keyof DiscoveryFilters>(key:K,value:DiscoveryFilters[K])=>setFilters(previous=>({...previous,[key]:value}));
  const searchType=filters.type,searchQuery=filters.query,selectedCategories=filters.categories,selectedListingTypes=filters.kinds,selectedProjectCondition=filters.condition;
  const hasMore=Object.values(cursors).some(Boolean);
  const visibleProperties=useMemo(()=>sortDiscoveryProperties(properties,filters.sort),[properties,filters.sort]);
  const filterCount=selectedCategories.length+selectedListingTypes.length+Number(Boolean(selectedProjectCondition))+Number(Boolean(filters.min||filters.max));

  const handleEnquireProperty = async (property: Property) => {
    if(enquiryInFlight.current)return;
    const currentUser = auth.currentUser;
    if (!currentUser) {
      toast({
        title: "Login Required",
        description: "Please login to enquire about properties.",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    enquiryInFlight.current=true;
    setSendingEnquiry(property.id);
    try {
      // Prepare notification payload with all required fields
      const notificationPayload = {
        type: 'property_enquiry',
        title: 'Property Enquiry Request',
        message: `User ${currentUser.displayName || currentUser.email || 'Unknown User'} is interested in property: ${property.title || property.id}`,
        propertyId: property.id || '',
        ownerId: property.ownerUID || '',
        ownerName: property.ownerName || 'Unknown Owner',
        ownerPhone: property.ownerPhone || property.primaryNo || '',
        ownerEmail: property.ownerEmail || '',
        // User details (person who enquired) - currently logged in user
        userId: currentUser.uid || '',
        userName: currentUser.displayName || currentUser.email || 'Unknown User',
        userEmail: currentUser.email || '',
        userPhone: currentUser.phoneNumber || '',
        // Property details
        propertyTitle: property.title || '',
        propertyAddress: property.address || property.city || 'Not specified',
        propertyListingType: property.listingType || 'rent',
        // Tenant info if available
        tenantName: property.tenants && property.tenants.length > 0 ? `${property.tenants[0].firstName} ${property.tenants[0].lastName}` : '',
        tenantEmail: property.tenants && property.tenants.length > 0 ? property.tenants[0].email : '',
        tenantPhone: property.tenants && property.tenants.length > 0 ? property.tenants[0].phone : '',
        // Buyers info if available
        buyers: property.buyers && property.buyers.length > 0 ? JSON.stringify(property.buyers) : '',
        timestamp: new Date().toISOString(),
        isRead: false,
        priority: 'high'
      };

      const notificationResponse = await apiFetch(`${API_BASE_URL}/admin/notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(notificationPayload),
      });

      const notificationData = await notificationResponse.json();

      if (notificationData.success) {
        toast({
          title: "Enquiry submitted",
          description: "Our team will review it.",
        });
      } else {
        throw new Error(notificationData.message || 'Failed to send enquiry');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send enquiry. Please try again later.",
        variant: "destructive",
      });
    } finally {
      enquiryInFlight.current=false;
      setSendingEnquiry(null);
    }
  };

  const formatPrice=(property:Property)=>{const price=propertyPricing(property);return price.amount===null?'Price not recorded':priceFormatter.format(price.amount)+(price.monthly?' / month':'');};
  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.pageHeader}>
          <div>
            <p className={styles.eyebrow}>EXPLORE PROPERTIES</p>
            <h1>Find your <em>next space.</em></h1>
            <p className={styles.headerDescription}>Discover properties to buy or rent, with effortless search and filtering.</p>
          </div>

        </header>

        <section className={styles.searchSection} aria-label="Property search">
            <div className={styles.modeSwitch} role="group" aria-label="Property transaction">
              <button type="button" className={searchType === 'buy' ? styles.modeActive : styles.mode} aria-pressed={searchType === 'buy'} onClick={() => handleTypeChange('buy')}>Buy</button>
              <button type="button" className={searchType === 'rent' ? styles.modeActive : styles.mode} aria-pressed={searchType === 'rent'} onClick={() => handleTypeChange('rent')}>Rent</button>
            </div>
          <form data-demo-autofill="off" onSubmit={handleSearch} className={styles.searchForm}>
            <label className={styles.searchField}>
              <Search size={20} aria-hidden="true" />
              <div><span className={styles.fieldLabel}>Location</span>
              <input aria-label="Search property location, type or features" value={searchQuery} onChange={(e) => updateFilter('query',e.target.value)} placeholder="City, locality or property name" /></div>
            </label>
            <label className={styles.selectField}>Property Type<select aria-label="Property category" value={selectedCategories.length===1?selectedCategories[0]:''} onChange={event=>updateFilter('categories',event.target.value?[event.target.value]:[])}><option value="">{selectedCategories.length>1?'Multiple categories':'All categories'}</option>{['residential','commercial','industrial'].map(category=><option key={category} value={category}>{category[0].toUpperCase()+category.slice(1)}</option>)}</select></label>
            <label className={styles.selectField}>{searchType==='rent'?'Rent up to / month':'Budget up to'}<input aria-label="Maximum budget" type="number" min="0" step="1" placeholder="Any budget (INR)" value={filters.max||''} onChange={event=>updateFilter('max',Math.max(0,Number(event.target.value)||0))}/></label>
            <button className={styles.submit} type="submit" disabled={loading}>{loading ? <Loader2 size={18} className={styles.spinner} /> : <Search size={18} />} <span>{loading ? 'Searching' : 'Search Properties'}</span></button>
          </form>
          <div className={styles.toolbar}>
            <button type="button" className={styles.filterToggle} onClick={() => setShowFilters(v => !v)} aria-expanded={showFilters} aria-controls="search-advanced-filters"><SlidersHorizontal size={17} /> {showFilters ? 'Hide filters' : 'More filters'}{filterCount ? ` (${filterCount})` : ''}</button>
            <span className={styles.toolbarTip}>Filters apply when you search. Results are loaded in pages.</span>
            {(filterCount > 0 || Boolean(searchQuery.trim())) && <button type="button" className={styles.clear} onClick={clearFilters}><X size={14} /> Clear filters</button>}
          </div>
          {showFilters && <div id="search-advanced-filters" className={styles.filters}>
            <label>Project condition
              <select value={selectedProjectCondition} onChange={(e) => { const condition=e.target.value; updateFilter('condition',condition); }}>
                <option value="">All conditions</option><option value="New Project">New project</option><option value="Ready Project">Ready project</option><option value="Preleased">Pre-Leased investments</option>
              </select>
            </label>
            <fieldset className={styles.filterGroup}><legend>Property category</legend><div className={styles.filterOptions}>{['Residential', 'Commercial', 'Industrial'].map(category => <label key={category} className={styles.checkOption}><input type="checkbox" checked={selectedCategories.includes(category.toLowerCase())} onChange={e => updateFilter('categories',e.target.checked ? [...selectedCategories,category.toLowerCase()] : selectedCategories.filter(x => x !== category.toLowerCase()))} /> {category}</label>)}</div></fieldset>
            <fieldset className={styles.filterGroup}><legend>Listing purpose</legend><div className={styles.filterOptions}>{['buy','rent'].map(type => <label key={type} className={styles.checkOption}><input type="checkbox" checked={selectedListingTypes.includes(type as 'buy'|'rent')} onChange={e => updateFilter('kinds',e.target.checked ? [...selectedListingTypes,type as 'buy'|'rent'] : selectedListingTypes.filter(x => x !== type))} /> {type === 'buy' ? 'For sale' : 'For rent'}</label>)}</div></fieldset>
            <label>Minimum budget (INR)<input type="number" min="0" step="1" value={filters.min||''} onChange={event=>updateFilter('min',Math.max(0,Number(event.target.value)||0))} placeholder="No minimum" /></label><button className={styles.applyFilters} type="button" onClick={() => applyFilters()}>Apply filters <ArrowRight size={16}/></button>
          </div>}
        </section>

        <section className={styles.resultsSection} aria-label="Property results" aria-live="polite">
          <div className={styles.resultsHeading}>
            <div><p className={styles.eyebrow}>THE COLLECTION</p><h2>{appliedSearch.current.kinds.length>1?'Properties to buy or rent':(appliedSearch.current.kinds[0]||appliedSearch.current.type)==='rent'?'Properties to rent':'Properties for sale'}</h2><p>{loading?'Finding available spaces...':`${properties.length} ${properties.length===1?'property':'properties'} loaded`}{appliedSearch.current.query?` for "${appliedSearch.current.query}"`:''}</p></div>
            <label className={styles.sortControl}>Sort loaded results<select disabled={loading} value={filters.sort} onChange={event=>{const selection={...appliedSearch.current,sort:event.target.value};setFilters(selection);setSearchParams(discoveryParams(selection),{replace:true});}}><option value="recommended">Default order</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></select></label>
          </div>
          {error&&<div className={styles.errorState} role="alert"><p>{error}</p><button type="button" disabled={loading} onClick={()=>void performSearch(appliedSearch.current,failedAppend)}>Retry {failedAppend?'loading more':'search'}</button></div>}
          {loading && !properties.length ? <div className={styles.emptyState}><Loader2 className={styles.spinner} size={32}/><h3>Finding your next space</h3><p>Checking available properties…</p></div> : !error && visibleProperties.length === 0 ? <div className={styles.emptyState}><Search size={36}/><h3>{Object.values(cursors).some(Boolean)?'No matches in the scanned pages yet':'No matching properties yet'}</h3><p>{Object.values(cursors).some(Boolean)?'Continue searching the remaining property pages.':'Try another location or remove your filters to discover more properties.'}</p><button type="button" onClick={clearFilters}>Clear search and filters <ArrowRight size={16}/></button></div> :
          <div className={styles.resultsGrid}>{visibleProperties.map(property => <article key={property.id} className={styles.property}>
            <Link to={`/property/${property.id}`} className={styles.propertyImageLink} aria-label={`View ${property.title || 'property'} details`}>
              <img src={property.images?.[0] || placeholderImage} alt={property.title ? `${property.title} property` : 'Property photograph'} loading="lazy" onError={e => { const img=e.currentTarget; if(img.src!==placeholderImage)img.src=placeholderImage; }} />
              <span className={styles.imageTag}>{purposeLabel(property.listingType)}</span>
              <span className={styles.imageArrow}><ArrowUpRight size={20}/></span>
            </Link>
            <div className={styles.propertyBody}>

              <h3><Link to={`/property/${property.id}`}>{property.title || 'Explore property'}</Link></h3>
              <p className={styles.address}><MapPin size={15} />{formatPropertyAddress(property) || 'Location available on enquiry'}</p>
              <div className={styles.propertyTop}><span>{property.propertyType || 'Property'}{property.configuration ? ` · ${property.configuration}` : ''}</span><span className={styles.price}>{formatPrice(property)}</span></div>
              <div className={styles.features}>
                {property.bedrooms > 0 && <span><BedDouble size={15}/>{property.bedrooms} beds</span>}
                {property.bathrooms > 0 && <span><Bath size={15}/>{property.bathrooms} baths</span>}
                {property.squareFeet > 0 && <span><Maximize size={15}/>{property.squareFeet} sq ft</span>}
              </div>
              {property.listingType==='pre_leased'&&property.investment&&<details className={styles.investment}><summary>Investment summary</summary><PropertyPurposeSummary property={property}/></details>}
              <div className={styles.propertyActions}><button type="button" disabled={sendingEnquiry !== null} onClick={() => void handleEnquireProperty(property)}>{sendingEnquiry === property.id ? 'Sending enquiry…' : 'Enquire'} <ArrowUpRight size={16}/></button><Link to={`/property/${property.id}`}>View Property <ArrowRight size={16}/></Link></div>
            </div>
          </article>)}</div>}
          {hasMore&&<div className={styles.pagination}><p>More property pages are available. Categories apply to every server page; budget filters and sorting cover loaded results.</p><button type="button" disabled={loading} onClick={()=>void performSearch(appliedSearch.current,true)}>{loading?'Loading...':'Load More Properties'}<ArrowRight size={16}/></button></div>}

        </section>
      </div>
    </div>
  );
};

export default SearchResults;
