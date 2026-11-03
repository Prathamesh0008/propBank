"use client";

import { useLocation } from '@/lib/navigation';
import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { DatePicker } from "@/ui/date-picker";
import { Label } from "@/ui/label";
import { Textarea } from "@/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/ui/tabs";
import { Calendar, Clock, Bell, Plus, MapPin, CheckCircle, Loader2, RefreshCw, Pencil, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { visitService, Visit, CreateVisitRequest } from "@/services/visitService";
import { propertyService, type Property } from "@/services/propertyService";
import { TimePicker } from "@/ui/time-picker";
import styles from "./VisitPlanner.module.css";
import {useAuth} from '@/contexts/AuthContext';
import { indiaCalendarDate, indiaDateTimeParts, indiaLocalDateTime } from '@/lib/form-validation';
import {useDataRefresh} from '@/lib/data-refresh';


const VisitPlanner = () => {
  const location=useLocation();
  const linkedPropertyId=new URLSearchParams(location.search).get("propertyId")||"";
  const [visits, setVisits] = useState<Visit[]>([]);
  const [isAddingVisit, setIsAddingVisit] = useState(false);
  const [activeTab, setActiveTab] = useState('active');
  const [loading, setLoading] = useState(true);
  const [loadError,setLoadError]=useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingVisit,setEditingVisit]=useState<Visit|null>(null);
  const [changingVisit,setChangingVisit]=useState('');
  const [properties,setProperties]=useState<Property[]>([]);
  const [propertySearch,setPropertySearch]=useState('');
  const [propertiesLoading,setPropertiesLoading]=useState(false);
  const [propertiesError,setPropertiesError]=useState('');
  const requestRef=useRef<AbortController|null>(null);
  const requestGeneration=useRef(0);
  const {user,loading:authLoading}=useAuth();
  const [formData, setFormData] = useState<{
    title:string;description:string;date:string;time:string;propertyId:string;
  }>({
    title: '',
    description: '',
    date: '',
    time: '',
    propertyId:linkedPropertyId,
  });
  const { toast } = useToast();

  const loadVisits = useCallback(async () => {
    const generation=++requestGeneration.current;
    requestRef.current?.abort();
    const controller=new AbortController();requestRef.current=controller;
    try {
      setLoading(true);
      setLoadError('');
      const allVisits = await visitService.getVisitsByUser(undefined,undefined,controller.signal);
      if(generation!==requestGeneration.current)return;
      setVisits(allVisits);
    } catch (error) {
      if(controller.signal.aborted||generation!==requestGeneration.current)return;
      const message=error instanceof Error?error.message:'Failed to load visits';
      setLoadError(message);
      toast({
        title: "Visits unavailable",
        description: message,
        variant: "destructive",
      });
    } finally {
      if(generation===requestGeneration.current)setLoading(false);
    }
  },[toast]);
  useDataRefresh(['visits'],()=>{if(user)void loadVisits();});
  useDataRefresh(['properties'],()=>{void propertyService.getAllProperties().then(setProperties).catch(()=>{});});

  useEffect(()=>{
    if(authLoading)return;
    if(user)void loadVisits();
    else {requestRef.current?.abort();setVisits([]);setLoadError('Sign in with a verified account to view visits.');setLoading(false);}
    return ()=>requestRef.current?.abort();
  },[authLoading,user,loadVisits]);

  useEffect(()=>{
    let active=true;
    setPropertiesLoading(true);setPropertiesError('');
    propertyService.getAllProperties().then(rows=>{if(active)setProperties(rows);}).catch(()=>{if(active)setPropertiesError('Properties could not be loaded. You can still schedule a general visit.');}).finally(()=>{if(active)setPropertiesLoading(false);});
    return()=>{active=false;};
  },[]);

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.date || !formData.time) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (!user) {
      toast({
        title: "Error",
        description: "Please sign in to schedule visits",
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmitting(true);
      
      // Combine date and time into ISO string
      const visitDateTime = indiaLocalDateTime(formData.date,formData.time);
      if(!visitDateTime||visitDateTime.getTime()<=Date.now()){
        toast({title:'Choose a future time',description:'Visits must be scheduled for a future date and time.',variant:'destructive'});return;
      }
      
      const visitRequest: CreateVisitRequest = {
        title: formData.title.trim(),
        ...(formData.propertyId?{propertyId:formData.propertyId}:{}),
        description: formData.description.trim(),
        visitDate: visitDateTime.toISOString(),
        reminderType: 'email',
        reminderTime: 30,
      };

      const saved=editingVisit
        ?await visitService.updateVisit(editingVisit.id,{title:visitRequest.title,description:visitRequest.description,visitDate:visitRequest.visitDate,expectedVersion:editingVisit.managementVersion||0,status:'scheduled',isCompleted:false})
        :await visitService.createVisit(visitRequest);
      setVisits(current=>editingVisit?current.map(visit=>visit.id===saved.id?saved:visit):[...current,saved]);
    
      setFormData({
        title: '',
        description: '',
        date: '',
        time: '',
        propertyId:'',
      });
      setIsAddingVisit(false);
      setEditingVisit(null);
      
      toast({
        title: editingVisit?"Visit Rescheduled":"Visit Scheduled",
        description: editingVisit?"The visit schedule was updated":"Your visit was scheduled with an automatic 30-minute reminder.",
      });
    } catch (error) {
      toast({
        title: editingVisit?"Reschedule failed":"Scheduling failed",
        description: error instanceof Error?error.message:editingVisit?"The visit could not be rescheduled.":"The visit could not be scheduled.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const changeStatus=async(visit:Visit,status:'cancelled'|'completed')=>{
    try {
      setChangingVisit(visit.id);
      const updated=await visitService.updateVisit(visit.id,{status,isCompleted:status==='completed',expectedVersion:visit.managementVersion||0});
      setVisits(current=>current.map(row=>row.id===updated.id?updated:row));
      toast({
        title: status==='cancelled'?"Visit Cancelled":"Visit Completed",
        description: status==='cancelled'?"The visit remains in your cancelled history.":"The visit is now listed as visited.",
      });
    } catch (error) {
      toast({
        title: "Visit update failed",
        description: error instanceof Error?error.message:'The visit could not be updated.',
        variant: "destructive",
      });
    }finally{setChangingVisit('');}
  };

  const beginReschedule=(visit:Visit)=>{
    const local=indiaDateTimeParts(visit.visitDate);
    setEditingVisit(visit);setFormData({title:visit.title,description:visit.description||'',date:local.date,time:local.time,propertyId:visit.propertyId||''});setIsAddingVisit(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const activeVisits = visits.filter(visit => {
    return !visit.isCompleted && (!visit.status || visit.status === "scheduled");
  });
  
  const completedVisits = visits.filter(visit => {
    return visit.status!=="cancelled" && (visit.isCompleted || visit.status==="completed");
  });

  const getCurrentVisits = () => {
    return activeTab === 'active' ? activeVisits : activeTab==='cancelled'?visits.filter(v=>v.status==='cancelled'):completedVisits;
  };

  return (
    <main className={styles.page}>
      <>
        <title>Visit Planner — Propbank</title>
        <meta name="description" content="Schedule property visits, set reminders, and track your visit progress with Propbank Visit Planner." />
        <link rel="canonical" href="/visit-planner" />
      </>

      <div className={styles.shell}>
        <div className={styles.intro}>
          <div className="flex items-center justify-center gap-2 sm:gap-3">
            <div className="flex h-8 w-8 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-gradient-primary">
              <Calendar className="h-4 w-4 sm:h-6 sm:w-6 text-primary-foreground" />
            </div>
            <h1 className="text-xl sm:text-3xl font-bold">Visit Planner</h1>
          </div>
          <p className="text-sm sm:text-base text-muted-foreground">Schedule property visits, set reminders, and track your progress</p>
        </div>

        <div className={styles.workspace}>
          <div className={styles.results}>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="active" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                  <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Active Visit Planning</span>
                  <span className="sm:hidden">Active</span>
                  ({activeVisits.length})
                </TabsTrigger>
                <TabsTrigger value="visited" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                  <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Visited Planning</span>
                  <span className="sm:hidden">Visited</span>
                  ({completedVisits.length})
                </TabsTrigger>
                <TabsTrigger value="cancelled">Cancelled ({visits.filter(v=>v.status==="cancelled").length})</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="space-y-3 sm:space-y-4">
              {loading ? (
                <div className={styles.emptyState}>
                  <Loader2 className="h-12 w-12 sm:h-16 sm:w-16 mx-auto text-muted-foreground mb-3 sm:mb-4 animate-spin" />
                  <h3 className="text-base sm:text-lg font-semibold mb-1 sm:mb-2">Loading visits...</h3>
                  <p className="text-sm sm:text-base text-muted-foreground">Please wait while we fetch your visits</p>
                </div>
              ) 
              : loadError ? (
                <div className={styles.errorState} role="alert">
                  <XCircle aria-hidden="true" />
                  <h3>Visits could not be loaded</h3>
                  <p>{loadError}</p>
                  {user&&<Button type="button" variant="outline" onClick={()=>void loadVisits()}><RefreshCw aria-hidden="true" /> Retry</Button>}
                </div>
              ) : getCurrentVisits().length === 0 ? (
                <div className={styles.emptyState}>
                  {activeTab === 'active' ? (
                    <>
                      <MapPin className="h-12 w-12 sm:h-16 sm:w-16 mx-auto text-muted-foreground mb-3 sm:mb-4" />
                      <h3 className="text-base sm:text-lg font-semibold mb-1 sm:mb-2">No active visits scheduled</h3>
                      <p className="text-sm sm:text-base text-muted-foreground px-4">Arrange your next visit using the scheduling panel.</p>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-12 w-12 sm:h-16 sm:w-16 mx-auto text-muted-foreground mb-3 sm:mb-4" />
                      <h3 className="text-base sm:text-lg font-semibold mb-1 sm:mb-2">No visits in this section</h3>
                      <p className="text-sm sm:text-base text-muted-foreground px-4">Completed visits will appear here once their status is updated.</p>
                    </>
                  )}
                </div>
                ) : 
                (
                <div className={styles.visitList}>
                  {getCurrentVisits().sort((a, b) => 
                      activeTab === 'active' 
                        ? new Date(a.visitDate).getTime() - new Date(b.visitDate).getTime()
                        : new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime()
                    ).map((visit) => (
                      <Card key={visit.id} className={styles.visitRecord}>
                        <CardContent className="p-3 sm:p-6">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 space-y-2">
                              <div className="flex items-start sm:items-center gap-2 sm:gap-3 flex-wrap">
                                <div className={`flex h-4 w-4 items-center justify-center rounded-full shadow-sm flex-shrink-0 mt-0.5 sm:mt-0 ${
                                  activeTab === 'visited' ? 'bg-blue-600' : 'bg-primary-600'}`}>
                                  {activeTab === 'visited' ? 
                                  (
                                    <CheckCircle className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-white" />
                                  ) : 
                                  (
                                    <MapPin className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-primary-foreground" />
                                  )}
                                </div>
                                <h3 className="text-sm sm:text-lg font-semibold leading-tight flex-1">{visit.title}</h3>
                                <div className="flex items-center gap-1 text-muted-foreground flex-shrink-0">
                                  {activeTab === 'visited' ? 
                                  (
                                    <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4" />
                                  ) : 
                                  (
                                    <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
                                  )}
                                  <span className="text-xs sm:text-sm font-medium">
                                    {activeTab === 'visited' ? 'Completed' : activeTab==='cancelled'?'Cancelled':'Scheduled'}
                                  </span>
                                </div>
                              </div>
                              {visit.description && (
                                <p className="ml-6 sm:ml-7 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                                  {visit.description}
                                </p>
                              )}
                              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 ml-6 sm:ml-7 text-xs sm:text-sm text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
                                  <span className="text-xs sm:text-sm">{formatDate(visit.visitDate)}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
                                  <span className="text-xs sm:text-sm">{formatTime(visit.visitDate)}</span>
                                </div>
                                {activeTab === 'active' && (
                                  <div className="flex items-center gap-1">
                                    <Bell className="h-3 w-3 sm:h-4 sm:w-4" />
                                    <span className="text-xs sm:text-sm">30 min before via email</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            {activeTab === 'active' && <div className={styles.recordActions}>
                              <Button variant="outline" size="sm" disabled={changingVisit===visit.id} onClick={()=>beginReschedule(visit)}><Pencil aria-hidden="true" /> Reschedule</Button>
                              <Button variant="outline" size="sm" disabled={changingVisit===visit.id} onClick={()=>void changeStatus(visit,'completed')}><CheckCircle aria-hidden="true" /> Visited</Button>
                              <Button variant="ghost" size="sm" disabled={changingVisit===visit.id} onClick={()=>void changeStatus(visit,'cancelled')} className="text-destructive hover:text-destructive"><XCircle aria-hidden="true" /> Cancel</Button>
                            </div>}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              )}
            </div>
          </div>

          <aside className={styles.scheduler}>
            <Button onClick={() => {setEditingVisit(null);setIsAddingVisit(true);}}  size="lg" className="gap-2 w-full text-sm sm:text-base">
              <Plus className="h-3 w-3 sm:h-4 sm:w-4" /> Schedule New Visit
            </Button>

            {isAddingVisit && (
              <Card>
                <CardHeader className="pb-3 sm:pb-6">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <MapPin className="h-4 w-4 sm:h-5 sm:w-5" />
                    {editingVisit?'Reschedule Visit':'Plan a Visit or Reminder'}
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Link a listed property for a viewing, or leave it unselected for a general reminder.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
                    <div className="space-y-1 sm:space-y-2">
                      <Label htmlFor="title" className="text-xs sm:text-sm">Visit Title *</Label>
                      <Input id="title" value={formData.title} className="text-sm" required maxLength={120}
                        onChange={(e) => handleInputChange('title', e.target.value)}placeholder="E.g., Visit Apartment in Downtown"/>
                    </div>

                    <div className={styles.propertySelector}>
                      <Label htmlFor="propertySearch" className="text-xs sm:text-sm">Property (optional)</Label>
                      <Input id="propertySearch" value={propertySearch} className="text-sm" disabled={!!editingVisit}
                        onChange={(event)=>setPropertySearch(event.target.value)} placeholder="Search by property name, location or type" />
                      <select aria-label="Select an optional property" value={formData.propertyId}
                        onChange={(event)=>handleInputChange('propertyId',event.target.value)} disabled={propertiesLoading||!!editingVisit}>
                        <option value="">General visit — no property selected</option>
                        {properties.filter(property=>`${property.title} ${property.location||property.address||''} ${property.propertyType||''}`.toLowerCase().includes(propertySearch.trim().toLowerCase())).map(property=><option key={property.id} value={property.id}>{property.title} · {property.location||property.address||'Location unavailable'}{property.propertyType?` · ${property.propertyType}`:''}</option>)}
                      </select>
                      {propertiesLoading&&<p className={styles.fieldHelp}>Loading eligible properties…</p>}
                      {propertiesError&&<p className={styles.fieldNotice}>{propertiesError}</p>}
                      {!propertiesLoading&&!propertiesError&&properties.length===0&&<p className={styles.fieldHelp}>No eligible properties are currently listed. You can schedule a general visit.</p>}
                      {editingVisit&&<p className={styles.fieldHelp}>The linked property stays unchanged when a visit is rescheduled.</p>}
                      {editingVisit&&<p className={styles.fieldHelp}>To prevent a schedule update being applied to the wrong listing, create a new visit if the property changes.</p>}
                    </div>

                    <div className="space-y-1 sm:space-y-2">
                      <Label htmlFor="date" className="text-xs sm:text-sm">Visit Date *</Label>
                      <DatePicker value={formData.date} className="text-sm"
                        onChange={(value) => handleInputChange('date', value)} min={indiaCalendarDate()}
                      />
                    </div>

                    <TimePicker value={formData.time} onChange={(time) => handleInputChange('time', time)} required />

                    <div className="space-y-1 sm:space-y-2">
                      <Label htmlFor="description" className="text-xs sm:text-sm">Visit Details</Label>
                      <Textarea id="description" value={formData.description} rows={3} className="resize-none text-sm" maxLength={1000}
                        onChange={(e) => handleInputChange('description', e.target.value)} 
                        placeholder="Property address, contact person, special notes..."/>
                    </div>

                    <p className={styles.reminderHelp}><Bell aria-hidden="true" /> Confirmation: an email reminder is scheduled 30 minutes beforehand. A property selection represents a property visit; no selection creates a general visit reminder.</p>

                    <div className="flex flex-col gap-2 pt-3 sm:pt-4 border-t">
                      <Button type="submit" disabled={submitting}
                        className="flex items-center gap-2 w-full text-sm sm:text-base">
                        {submitting ? (
                          <><Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />{editingVisit?'Updating...':'Scheduling...'}</>
                        ) : 
                        (
                          <> <Calendar className="h-3 w-3 sm:h-4 sm:w-4" /> {editingVisit?'Update Visit':'Schedule Visit'} </>
                        )}
                      </Button>

                      <Button type="button" variant="outline" onClick={() => {setIsAddingVisit(false);setEditingVisit(null);}}
                        className="w-full text-sm sm:text-base">
                        Cancel
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}
          </aside>
        </div>

      </div>
    </main>
  );
};

export default VisitPlanner;
