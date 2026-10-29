"use client";

import { apiFetch } from '@/lib/api-client';

import { useState, useEffect, useRef } from "react";
import { useSearchParams, Link, useNavigate } from "@/lib/navigation";
import { Search, MapPin, BedDouble, Bath, Maximize, Loader2, ArrowUpRight, SlidersHorizontal, X, ArrowRight } from "lucide-react";
import styles from "./SearchResults.module.css";
import { propertyService, Property } from "@/services/propertyService";
import { useToast } from "@/hooks/use-toast";
import { auth } from "../../firebase";
import { API_BASE_URL } from "../../utils/config";
import {useDataRefresh} from '@/lib/data-refresh';

// Utility function to get placeholder image URL
const getPlaceholderImage = (propertyType?: string): string => {
  const type = propertyType?.toLowerCase() || 'property';
  
  if (type.includes('commercial')) {
    return 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400&h=300&fit=crop&crop=building';
  } else if (type.includes('residential')) {
    return 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=400&h=300&fit=crop&crop=house';
  } else if (type.includes('industrial')) {
    return 'https://images.unsplash.com/photo-1565084888279-aca607ecce0c?w=400&h=300&fit=crop&crop=warehouse';
  } else {
    return 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=400&h=300&fit=crop&crop=house';
  }
};

const SearchResults = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [searchType, setSearchType] = useState<'buy' | 'rent'>(
    (searchParams.get('type') as 'buy' | 'rent') || 'buy'
  );
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    searchParams.get('categories')?.split(',').filter(Boolean) || []
  );
  const [selectedListingTypes, setSelectedListingTypes] = useState<string[]>(
    searchParams.get('types')?.split(',').filter(Boolean) || []
  );
  const [selectedProjectCondition, setSelectedProjectCondition] = useState<string>(
    searchParams.get('projectCondition') || ''
  );
  const { toast } = useToast();
  const navigate = useNavigate();
  const [sendingEnquiry, setSendingEnquiry] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState("recommended");
  const searchGeneration=useRef(0);

  // Load search results with filters
  const performSearch = async (overrides: {type?: 'buy' | 'rent'; condition?: string; query?: string} = {}) => {
    const generation=++searchGeneration.current;
    const type = overrides.type ?? searchType;
    const condition = overrides.condition ?? selectedProjectCondition;
    const query = overrides.query ?? searchQuery;
    try {
      setLoading(true);
      
      // Use the first selected listing type if available, otherwise use searchType
      let listingType: 'buy' | 'rent' | undefined = type;
      if (selectedListingTypes.length > 0) {
        listingType = selectedListingTypes[0] as 'buy' | 'rent';
      }
      
      let results = await propertyService.searchProperties(
        query,
        listingType,
        condition
      );
      
      // Client-side filtering by multiple listing types if needed
      if (selectedListingTypes.length > 1) {
        // If multiple listing types are selected, we need to search for each and combine
        const allResults = await Promise.all(
          selectedListingTypes.map(type => 
            propertyService.searchProperties(query, type as 'buy' | 'rent', condition)
          )
        );
        
        // Combine and deduplicate results
        const combinedResults = allResults.flat();
        const uniqueResults = combinedResults.filter((property, index, self) =>
          index === self.findIndex(p => p.id === property.id)
        );
        
        results = uniqueResults;
      }
      
      // Client-side filtering by categories if needed
      if (selectedCategories.length > 0) {
        results = results.filter(property =>
          selectedCategories.some(category =>
            property.propertyType?.toLowerCase().includes(category.toLowerCase())
          )
        );
      }

      if(generation!==searchGeneration.current)return;
      setProperties(results);
      
      // Update URL params
      const newParams = new URLSearchParams();
      if (query.trim()) newParams.append('q', query.trim());
      if (type) newParams.append('type', type);
      if (selectedCategories.length > 0) newParams.append('categories', selectedCategories.join(','));
      if (selectedListingTypes.length > 0) newParams.append('types', selectedListingTypes.join(','));
      if (condition) newParams.append('projectCondition', condition);
      setSearchParams(newParams);
      
    } catch (error) {
      if(generation!==searchGeneration.current)return;
      
      toast({
        title: "Search Error",
        description: "Failed to search properties. Please try again.",
        variant: "destructive",
      });
      setProperties([]);
    } finally {
      if(generation===searchGeneration.current)setLoading(false);
    }
  };
  useDataRefresh(['properties'],()=>{void performSearch();});

  // Initial search on component mount
  useEffect(() => {
    performSearch();
  }, []); // Only run on mount

  // Handle search form submission
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch();
  };

  const handleTypeChange = (newType: 'buy' | 'rent') => {
    setSearchType(newType);
    // Auto-search when type changes
    void performSearch({type: newType});
  };

  const handleEnquireProperty = async (property: Property) => {
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
          title: "Enquiry Sent",
          description: "Your enquiry has been sent to the admin. They will contact you soon.",
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
      setSendingEnquiry(null);
    }
  };

  const formatPrice = (property: Property): string => {
    const isRent = property.listingType === 'rent' || searchType === 'rent';
    const priceVal = property.price > 0
      ? property.price
      : isRent && property.monthlyRent
      ? parseInt(property.monthlyRent)
      : !isRent && property.sellingPrice
      ? parseInt(property.sellingPrice)
      : 0;

    if (priceVal === 0) return 'Price on request';

    return `₹${priceVal.toLocaleString('en-IN')}${isRent ? '/month' : ''}`;
  };

  const getNumericPrice = (property: Property) => {
    const candidate = property.price > 0 ? property.price : Number(property.listingType === 'rent' ? property.monthlyRent : property.sellingPrice);
    return Number.isFinite(candidate) ? candidate : 0;
  };

  const visibleProperties = [...properties].sort((a, b) => {
    if (sortBy === 'price-low') return getNumericPrice(a) - getNumericPrice(b);
    if (sortBy === 'price-high') return getNumericPrice(b) - getNumericPrice(a);
    return 0;
  });
  const filterCount = selectedCategories.length + selectedListingTypes.length + Number(Boolean(selectedProjectCondition));
  const clearFilters = () => {
    setSelectedCategories([]);
    setSelectedListingTypes([]);
    setSelectedProjectCondition('');
    setSearchQuery('');
    setSearchParams(new URLSearchParams({type: searchType}));
    // Reset from the server instead of reusing the previously filtered result set.
    void propertyService.searchProperties('', searchType, '').then(setProperties).catch(() => {
      toast({title: 'Could not reset filters', description: 'Try searching again.', variant: 'destructive'});
    });
  };

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.pageHeader}>
          <div>
            <p className={styles.eyebrow}>PROPBANK / PROPERTY DISCOVERY</p>
            <h1>Find your <em>next space.</em></h1>
            <p className={styles.headerDescription}>Thoughtful spaces for the way you live and work. Explore available properties with clarity and confidence.</p>
          </div>
          <div className={styles.headerSide}><span>Explore spaces</span><ArrowUpRight size={22} aria-hidden="true" /></div>
        </header>

        <section className={styles.searchSection} aria-label="Property search">
          <form onSubmit={handleSearch} className={styles.searchForm}>
            <div className={styles.modeSwitch} role="group" aria-label="Property transaction">
              <button type="button" className={searchType === 'buy' ? styles.modeActive : styles.mode} aria-pressed={searchType === 'buy'} onClick={() => handleTypeChange('buy')}>Buy</button>
              <button type="button" className={searchType === 'rent' ? styles.modeActive : styles.mode} aria-pressed={searchType === 'rent'} onClick={() => handleTypeChange('rent')}>Rent</button>
            </div>
            <label className={styles.searchField}>
              <Search size={20} aria-hidden="true" />
              <span className={styles.srOnly}>Search property location, type or features</span>
              <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="City, locality, building or property type" />
            </label>
            <button className={styles.submit} type="submit" disabled={loading}>{loading ? <Loader2 size={18} className={styles.spinner} /> : <Search size={18} />} <span>{loading ? 'Searching' : 'Search properties'}</span></button>
          </form>
          <div className={styles.toolbar}>
            <button type="button" className={styles.filterToggle} onClick={() => setShowFilters(v => !v)} aria-expanded={showFilters} aria-controls="search-advanced-filters"><SlidersHorizontal size={17} /> {showFilters ? 'Hide filters' : 'More filters'}{filterCount ? ` (${filterCount})` : ''}</button>
            <span className={styles.toolbarTip}>Search by location, project status and property category</span>
            {filterCount > 0 && <button type="button" className={styles.clear} onClick={clearFilters}><X size={14} /> Clear filters</button>}
          </div>
          {showFilters && <div id="search-advanced-filters" className={styles.filters}>
            <label>Project condition
              <select value={selectedProjectCondition} onChange={(e) => { const condition=e.target.value; setSelectedProjectCondition(condition); void performSearch({condition}); }}>
                <option value="">All conditions</option><option value="New Project">New project</option><option value="Ready Project">Ready project</option><option value="Preleased">Preleased</option>
              </select>
            </label>
            <fieldset className={styles.filterGroup}><legend>Property category</legend><div className={styles.filterOptions}>{['Residential', 'Commercial', 'Industrial'].map(category => <label key={category} className={styles.checkOption}><input type="checkbox" checked={selectedCategories.includes(category)} onChange={e => setSelectedCategories(current => e.target.checked ? [...current,category] : current.filter(x => x !== category))} /> {category}</label>)}</div></fieldset>
            <fieldset className={styles.filterGroup}><legend>Listing purpose</legend><div className={styles.filterOptions}>{['buy','rent'].map(type => <label key={type} className={styles.checkOption}><input type="checkbox" checked={selectedListingTypes.includes(type)} onChange={e => setSelectedListingTypes(current => e.target.checked ? [...current,type] : current.filter(x => x !== type))} /> {type === 'buy' ? 'For sale' : 'For rent'}</label>)}</div></fieldset>
            <button className={styles.applyFilters} type="button" onClick={() => void performSearch()}>Apply filters <ArrowRight size={16}/></button>
          </div>}
        </section>

        <section className={styles.resultsSection} aria-label="Property results" aria-live="polite">
          <div className={styles.resultsHeading}>
            <div><p className={styles.eyebrow}>THE COLLECTION</p><h2>{searchType === 'rent' ? 'Properties to rent' : 'Properties for sale'}</h2><p>{loading ? 'Finding available spaces…' : `${properties.length} ${properties.length === 1 ? 'property' : 'properties'} found`}{searchQuery.trim() ? ` for “${searchQuery.trim()}”` : ''}</p></div>
            <label className={styles.sortControl}>Sort by <select value={sortBy} onChange={e => setSortBy(e.target.value)}><option value="recommended">Recommended</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></select></label>
          </div>
          {loading ? <div className={styles.emptyState}><Loader2 className={styles.spinner} size={32}/><h3>Finding your next space</h3><p>Checking available properties…</p></div> : visibleProperties.length === 0 ? <div className={styles.emptyState}><Search size={36}/><h3>No matching properties yet</h3><p>Try another location or remove your filters to discover more properties.</p><button type="button" onClick={clearFilters}>Clear search and filters <ArrowRight size={16}/></button></div> :
          <div className={styles.resultsGrid}>{visibleProperties.map(property => <article key={property.id} className={styles.property}>
            <Link to={`/property/${property.id}`} className={styles.propertyImageLink} aria-label={`View ${property.title || 'property'} details`}>
              <img src={property.images?.[0] || getPlaceholderImage(property.propertyType)} alt={property.title ? `${property.title} property` : 'Property photograph'} loading="lazy" onError={e => { const img=e.currentTarget; const fallback=getPlaceholderImage(property.propertyType); if (!img.src.includes(fallback)) img.src=fallback; }} />
              <span className={styles.imageTag}>{property.listingType === 'rent' ? 'FOR RENT' : 'FOR SALE'}</span>
              <span className={styles.imageArrow}><ArrowUpRight size={20}/></span>
            </Link>
            <div className={styles.propertyBody}>
              <div className={styles.propertyTop}><span>{property.propertyType || 'Property'}{property.configuration ? ` · ${property.configuration}` : ''}</span><span className={styles.price}>{formatPrice(property)}</span></div>
              <h3><Link to={`/property/${property.id}`}>{property.title || 'Explore property'}</Link></h3>
              <p className={styles.address}><MapPin size={15} />{property.address || property.city || 'Location available on enquiry'}</p>
              <div className={styles.features}>
                {property.bedrooms > 0 && <span><BedDouble size={15}/>{property.bedrooms} beds</span>}
                {property.bathrooms > 0 && <span><Bath size={15}/>{property.bathrooms} baths</span>}
                {property.squareFeet > 0 && <span><Maximize size={15}/>{property.squareFeet} sq ft</span>}
              </div>
              <div className={styles.propertyActions}><button type="button" disabled={sendingEnquiry === property.id} onClick={() => void handleEnquireProperty(property)}>{sendingEnquiry === property.id ? 'Sending enquiry…' : 'Enquire about this property'} <ArrowUpRight size={16}/></button><Link to={`/property/${property.id}`}>Details <ArrowRight size={16}/></Link></div>
            </div>
          </article>)}</div>}
        </section>
      </div>
    </main>
  );
};

export default SearchResults;
