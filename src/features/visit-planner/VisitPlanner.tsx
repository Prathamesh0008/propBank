"use client";

import { useLocation } from '@/lib/navigation';
import { useState, useEffect } from "react";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { DatePicker } from "@/ui/date-picker";
import { Label } from "@/ui/label";
import { Textarea } from "@/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/ui/tabs";
import { Calendar, Clock, Bell, Plus, Trash2, MapPin, CheckCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { visitService, Visit, CreateVisitRequest } from "@/services/visitService";
import { auth } from "../../firebase";
import { User, onAuthStateChanged } from "firebase/auth";
import { TimePicker } from "@/ui/time-picker";


const VisitPlanner = () => {
  const location=useLocation();
  const linkedPropertyId=new URLSearchParams(location.search).get("propertyId")||"";
  const [visits, setVisits] = useState<Visit[]>([]);
  const [isAddingVisit, setIsAddingVisit] = useState(false);
  const [activeTab, setActiveTab] = useState('active');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    reminderType: 'email' as const,
    reminderTime: 15,
  });
  const { toast } = useToast();

  // Authentication and data loading
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        loadVisits();
      } else {
        setVisits([]);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const loadVisits = async () => {
    try {
      setLoading(true);
      const allVisits = await visitService.getVisitsByUser();
      setVisits(allVisits);
    } catch (error) {
      
      toast({
        title: "Error",
        description: "Failed to load visits. Please refresh the page.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.date || !formData.time) {
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
      const visitDateTime = new Date(`${formData.date}T${formData.time}`);
      
      const visitRequest: CreateVisitRequest = {
        title: formData.title,
        ...(linkedPropertyId?{propertyId:linkedPropertyId}:{}),
        description: formData.description,
        visitDate: visitDateTime.toISOString(),
        reminderType: formData.reminderType,
        reminderTime: formData.reminderTime,
      };

      await visitService.createVisit(visitRequest);
    
      setFormData({
        title: '',
        description: '',
        date: '',
        time: '',
        reminderType: 'email',
        reminderTime: 15,
      });
      setIsAddingVisit(false);
      
      await loadVisits();
      
      toast({
        title: "Visit Scheduled",
        description: "Property visit added to your planner with reminder set",
      });
    } catch (error) {
      
      toast({
        title: "Error",
        description: "Failed to schedule visit. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const deleteVisit = async (visitId: string) => {
    try {
      await visitService.deleteVisit(visitId);
      await loadVisits();
      toast({
        title: "Visit Deleted",
        description: "Visit removed from your planner",
      });
    } catch (error) {
      
      toast({
        title: "Error",
        description: "Failed to delete visit",
        variant: "destructive",
      });
    }
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

  const now = new Date();
  const activeVisits = visits.filter(visit => {
    const visitDate = new Date(visit.visitDate);
    return !visit.isCompleted && (!visit.status || visit.status === "scheduled");
  });
  
  const completedVisits = visits.filter(visit => {
    const visitDate = new Date(visit.visitDate);
    return visit.status!=="cancelled" && (visit.isCompleted || visit.status==="completed");
  });

  const getCurrentVisits = () => {
    return activeTab === 'active' ? activeVisits : activeTab==='cancelled'?visits.filter(v=>v.status==='cancelled'):completedVisits;
  };

  return (
    <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
      <>
        <title>Visit Planner — Propbank</title>
        <meta name="description" content="Schedule property visits, set reminders, and track your visit progress with Propbank Visit Planner." />
        <link rel="canonical" href="/visit-planner" />
      </>

      <div className="space-y-4 sm:space-y-8">
        <div className="text-center space-y-2 sm:space-y-4">
          <div className="flex items-center justify-center gap-2 sm:gap-3">
            <div className="flex h-8 w-8 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-gradient-primary">
              <Calendar className="h-4 w-4 sm:h-6 sm:w-6 text-primary-foreground" />
            </div>
            <h1 className="text-xl sm:text-3xl font-bold">Visit Planner</h1>
          </div>
          <p className="text-sm sm:text-base text-muted-foreground">Schedule property visits, set reminders, and track your progress</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-4 sm:gap-8">
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
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
                <div className="text-center py-8 sm:py-12">
                  <Loader2 className="h-12 w-12 sm:h-16 sm:w-16 mx-auto text-muted-foreground mb-3 sm:mb-4 animate-spin" />
                  <h3 className="text-base sm:text-lg font-semibold mb-1 sm:mb-2">Loading visits...</h3>
                  <p className="text-sm sm:text-base text-muted-foreground">Please wait while we fetch your visits</p>
                </div>
              ) 
              : getCurrentVisits().length === 0 ? (
                <div className="text-center py-8 sm:py-12">
                  {activeTab === 'active' ? (
                    <>
                      <MapPin className="h-12 w-12 sm:h-16 sm:w-16 mx-auto text-muted-foreground mb-3 sm:mb-4" />
                      <h3 className="text-base sm:text-lg font-semibold mb-1 sm:mb-2">No active visits scheduled</h3>
                      <p className="text-sm sm:text-base text-muted-foreground px-4">Schedule your upcoming property visits using the form below</p>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-12 w-12 sm:h-16 sm:w-16 mx-auto text-muted-foreground mb-3 sm:mb-4" />
                      <h3 className="text-base sm:text-lg font-semibold mb-1 sm:mb-2">No visits completed yet</h3>
                      <p className="text-sm sm:text-base text-muted-foreground px-4">Visits automatically move here after the scheduled time</p>
                    </>
                  )}
                </div>
                ) : 
                (
                <div className="grid gap-3 sm:gap-4">
                  {getCurrentVisits().sort((a, b) => 
                      activeTab === 'active' 
                        ? new Date(a.visitDate).getTime() - new Date(b.visitDate).getTime()
                        : new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime()
                    ).map((visit) => (
                      <Card key={visit.id} className={`transition-all ${
                        activeTab === 'visited' ? 'border-blue-200 bg-blue-50' : 'border-blue-200'}`}>
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
                                    <span className="text-xs sm:text-sm">{visit.reminderTime} min before via {visit.reminderType}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            {activeTab === 'active' && (
                              <Button variant="ghost" size="icon"  onClick={() => deleteVisit(visit.id)}
                                className="text-destructive hover:text-destructive h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0">
                                <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3 sm:space-y-4">
            <Button onClick={() => setIsAddingVisit(true)}  size="lg" className="gap-2 w-full text-sm sm:text-base">
              <Plus className="h-3 w-3 sm:h-4 sm:w-4" /> Schedule New Visit
            </Button>

            {isAddingVisit && (
              <Card>
                <CardHeader className="pb-3 sm:pb-6">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <MapPin className="h-4 w-4 sm:h-5 sm:w-5" />
                    Schedule Property Visit
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Plan your property visit and get notified before the appointment
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
                    <div className="space-y-1 sm:space-y-2">
                      <Label htmlFor="title" className="text-xs sm:text-sm">Visit Title *</Label>
                      <Input id="title" value={formData.title} className="text-sm" required
                        onChange={(e) => handleInputChange('title', e.target.value)}placeholder="E.g., Visit Apartment in Downtown"/>
                    </div>

                    <div className="space-y-1 sm:space-y-2">
                      <Label htmlFor="date" className="text-xs sm:text-sm">Visit Date *</Label>
                      <DatePicker value={formData.date} className="text-sm"
                        onChange={(value) => handleInputChange('date', value)} min={new Date().toISOString().split('T')[0]}
                      />
                    </div>

                    <TimePicker value={formData.time} onChange={(time) => handleInputChange('time', time)} required />

                    <div className="space-y-1 sm:space-y-2">
                      <Label htmlFor="reminderTime" className="text-xs sm:text-sm">Email Reminder</Label>
                      <Select value={formData.reminderTime.toString()} onValueChange={(value) => handleInputChange('reminderTime', parseInt(value))}>
                        <SelectTrigger className="text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5" className="text-sm">5 minutes before</SelectItem>
                          <SelectItem value="15" className="text-sm">15 minutes before</SelectItem>
                          <SelectItem value="30" className="text-sm">30 minutes before</SelectItem>
                          <SelectItem value="60" className="text-sm">1 hour before</SelectItem>
                          <SelectItem value="120" className="text-sm">2 hours before</SelectItem>
                          <SelectItem value="1440" className="text-sm">1 day before</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1 sm:space-y-2">
                      <Label htmlFor="description" className="text-xs sm:text-sm">Visit Details</Label>
                      <Textarea id="description" value={formData.description} rows={3} className="resize-none text-sm"
                        onChange={(e) => handleInputChange('description', e.target.value)} 
                        placeholder="Property address, contact person, special notes..."/>
                    </div>

                    <div className="flex flex-col gap-2 pt-3 sm:pt-4 border-t">
                      <Button type="submit" disabled={submitting}
                        className="flex items-center gap-2 w-full text-sm sm:text-base">
                        {submitting ? (
                          <><Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />Scheduling...</>
                        ) : 
                        (
                          <> <Calendar className="h-3 w-3 sm:h-4 sm:w-4" /> Schedule Visit </>
                        )}
                      </Button>

                      <Button type="button" variant="outline" onClick={() => setIsAddingVisit(false)} 
                        className="w-full text-sm sm:text-base">
                        Cancel
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

      </div>
    </main>
  );
};

export default VisitPlanner;
