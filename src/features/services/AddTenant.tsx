"use client";
import {indianMobile} from '@/lib/indian-phone';
import styles from "./TenantWorkspace.module.css";

import { apiFetch } from '@/lib/api-client';
import {useQueryClient} from '@tanstack/react-query';

import { useParams, useNavigate, useLocation } from "@/lib/navigation";
import { Trash2, Plus, UserPlus, MapPin, FileText, User,  Loader2, ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card";
import { Input } from "@/ui/input";
import { DatePicker } from "@/ui/date-picker";
import { Label } from "@/ui/label";
import { Textarea } from "@/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select";
import { Checkbox } from "@/ui/checkbox";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { auth } from "../../firebase";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { API_BASE_URL } from "../../utils/config";
import { addMonths, format, subDays, parseISO } from "date-fns";
import AmountInWords from '@/components/AmountInWords';
import NextAgreementFields from '@/components/NextAgreementFields';
import {emptyNextAgreementDraft,validateNextAgreementDraft,type NextAgreementDraft} from '@/lib/next-agreement-draft';

interface SpouseData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  employmentStatus: string;
  employer: string;
  notes: string;
}

interface UserInfo {
  uid: string;
  name: string;
  email: string;
  photoURL: string;
  phoneNumber: string;
}

interface TenantData {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  emergencyContact: string;
  userUID?: string; // Map to platform user if found
  userInfo?: UserInfo | null; // Store user info for display
  isMarried: boolean;
  spouse: SpouseData | null;
  leaseStartDate: string;
  leaseEndDate: string;
  monthlyRent: string;
  securityDeposit: string;
  previousAddress: string;
  employmentStatus: string;
  employer: string;
  monthlyIncome: string;
  paymentDueDate: string;
  escalationPercentage: string;
  escalationAmount: string;
  noticePeriod: string;
  lockInPeriod: string;
  addNextAgreementManually: boolean;
  nextAgreementDraft: NextAgreementDraft;
  notes: string;
  searchError?: string; // Error message if user not found
  searchingUser?: boolean; // Loading state for user search
  searchTimeoutId?: NodeJS.Timeout; // Timeout ID for debounced search
  rentSchedule: {
    year: string;
    amount: string;
    fromDate: string;
    toDate: string;
    months?: string;
  }[];
}

const AddTenant = () => {
  const queryClient = useQueryClient();
  const { propertyId } = useParams<{ propertyId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const readOnly = searchParams.get('mode') === 'view';
  const adminMode = searchParams.get('admin') === '1';
  const selectedTenantUID = searchParams.get('tenantUID') || '';
  const { toast } = useToast();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [propertyOwner,setPropertyOwner]=useState("");
  const [existingTenants, setExistingTenants] = useState<TenantData[]>([]);
  const [propertyTitle, setPropertyTitle] = useState<string>('');
  const [propertyRentSchedule, setPropertyRentSchedule] = useState<any[]>([]);
  const [propertyUpdatedAt,setPropertyUpdatedAt]=useState('');
  const [editingTenantId,setEditingTenantId]=useState('');
  const [tenancyRevision,setTenancyRevision]=useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const [tenants, setTenants] = useState<TenantData[]>([
    {
      id: '1',
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      emergencyContact: '',
      userUID: undefined,
      userInfo: null,
      isMarried: false,
      spouse: null,
      leaseStartDate: '',
      leaseEndDate: '',
      monthlyRent: '',
      securityDeposit: '',
      previousAddress: '',
      employmentStatus: '',
      employer: '',
      monthlyIncome: '',
      paymentDueDate: '',
      escalationPercentage: '',
      escalationAmount: '',
      noticePeriod: '',
      lockInPeriod: '',
      addNextAgreementManually: false,
      nextAgreementDraft: emptyNextAgreementDraft(),
      notes: '',
      searchError: undefined,
      searchingUser: false,
      rentSchedule: [{ year: "1st Year", amount: "", fromDate: "", toDate: "", months: "11" }]
    }
  ]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchPropertyData = async () => {
      if (!propertyId) return;

      try {
        const response = await apiFetch(`${API_BASE_URL}/properties/${propertyId}`);
        const data = await response.json();

        if (data.success) {
          const property = data.property;
          setPropertyTitle(property.title);
          setPropertyOwner(property.ownerUID);
          setTenancyRevision(Number(property.tenancyRevision||0));
          setPropertyUpdatedAt(String(property.updatedAt||''));
          if (property.rentSchedule) {
            setPropertyRentSchedule(property.rentSchedule);
          }

          if (property.tenants && property.tenants.length > 0) {
            const activeTenants=property.tenants.filter((tenant: any)=>tenant.isActive===true).map((tenant: any) => ({
              id: tenant.id,
              firstName: tenant.firstName,
              lastName: tenant.lastName,
              email: tenant.email,
              phone: tenant.phone,
              emergencyContact: tenant.emergencyContact,
              userUID: tenant.userUID,
              isMarried: tenant.isMarried || false,
              spouse: tenant.spouse || null,
              leaseStartDate: tenant.leaseStartDate || property.agreementStartDate || '',
              leaseEndDate: tenant.leaseEndDate || property.agreementEndDate || '',
              monthlyRent: tenant.monthlyRent || property.monthlyRent || '',
              securityDeposit: tenant.securityDeposit || property.securityDeposit || '',
              previousAddress: tenant.previousAddress,
              employmentStatus: tenant.employmentStatus,
              employer: tenant.employer || '',
              monthlyIncome: tenant.monthlyIncome || '',
              paymentDueDate: tenant.paymentDueDate || property.paymentDueDate || '',
              escalationPercentage: tenant.escalationPercentage || property.escalationPercentage || '',
              escalationAmount: tenant.escalationAmount || property.escalationAmount || '',
              noticePeriod: tenant.noticePeriod || property.noticePeriod || '',
              lockInPeriod: tenant.lockInPeriod || property.lockInPeriod || '',
              addNextAgreementManually: !!(tenant.nextAgreementDraft||property.nextAgreementDraft),
              nextAgreementDraft: tenant.nextAgreementDraft||property.nextAgreementDraft||emptyNextAgreementDraft(),
              notes: tenant.notes || '',
              rentSchedule: tenant.rentSchedule?.length ? tenant.rentSchedule : property.rentSchedule || []
            }));
            setExistingTenants(activeTenants);
            if(!adminMode&&!readOnly&&activeTenants.length===1&&activeTenants[0].id){
              setTenants([activeTenants[0]]);
              setEditingTenantId(activeTenants[0].id);
            }
          }
        }
      } catch (error) { /* Preserve existing best-effort behavior. */ }
    };

    fetchPropertyData();
  }, [propertyId]);

  useEffect(()=>{
    if(!adminMode||!selectedTenantUID)return;
    let active=true;
    void apiFetch(`${API_BASE_URL}/users/${encodeURIComponent(selectedTenantUID)}`).then(async response=>{const data=await response.json();if(!response.ok||!data.user)throw new Error(data.message||'Selected user could not be loaded');if(!active)return;const account=data.user,name=String(account.name||'').trim().split(/\s+/);setTenants(current=>[{...current[0],firstName:name[0]||'Tenant',lastName:name.slice(1).join(' ')||'User',email:account.email||'',phone:account.phoneNumber||'',userUID:account.uid,userInfo:{uid:account.uid,name:account.name||'',email:account.email||'',photoURL:account.photoURL||'',phoneNumber:account.phoneNumber||''}}]);}).catch(error=>{if(active)toast({title:'Unable to load tenant',description:error instanceof Error?error.message:'Selected user could not be loaded',variant:'destructive'});});
    return()=>{active=false;};
  },[adminMode,selectedTenantUID,toast]);

  // Contact validation never looks up another account or fills its private profile.
  const searchUserByPhone = async (tenantId: string, phoneNumber: string) => {
    setTenants(prev => prev.map(tenant => tenant.id === tenantId ? {
      ...tenant, userInfo: null, userUID: undefined, searchingUser: false,
      searchError: phoneNumber && !indianMobile(phoneNumber) ? 'Enter a valid Indian mobile number.' : undefined,
    } : tenant));
  };

  const handleInputChange = (tenantId: string, field: keyof TenantData, value: string) => {
    setTenants(prev => prev.map(tenant => {
      if (tenant.id === tenantId) {
        const updated = { ...tenant, [field]: value };

        if (field === 'email') {updated.userUID=undefined;updated.userInfo=null;}
        if (field === 'phone') {
          updated.userInfo = null;
          updated.userUID = undefined;
          updated.searchError = undefined;

          if (tenant.searchTimeoutId) {
            clearTimeout(tenant.searchTimeoutId);
          }

          const timeoutId = setTimeout(() => {
            searchUserByPhone(tenantId, value);
          }, 1000);

          updated.searchTimeoutId = timeoutId;
        }

        return updated;
      }
      return tenant;
    }));
  };

  const handleSpouseChange = (tenantId: string, field: keyof SpouseData, value: string) => {
    setTenants(prev => prev.map(tenant => {
      if (tenant.id === tenantId) {
        const updatedSpouse = tenant.spouse || {
          firstName: '',
          lastName: '',
          email: '',
          phone: '',
          employmentStatus: '',
          employer: '',
          notes: ''
        };
        return {
          ...tenant,
          spouse: {
            ...updatedSpouse,
            [field]: value
          }
        };
      }
      return tenant;
    }));
  };

  const handleMaritalStatusChange = (tenantId: string, isMarried: boolean) => {
    setTenants(prev => prev.map(tenant => {
      if (tenant.id === tenantId) {
        return {
          ...tenant,
          isMarried,
          spouse: isMarried ? (tenant.spouse || {
            firstName: '',
            lastName: '',
            email: '',
            phone: '',
            employmentStatus: '',
            employer: '',
            notes: ''
          }) : null
        };
      }
      return tenant;
    }));
  };

  const getOrdinalSuffix = (i: number) => {
    const j = i % 10,
      k = i % 100;
    if (j === 1 && k !== 11) {
      return "st";
    }
    if (j === 2 && k !== 12) {
      return "nd";
    }
    if (j === 3 && k !== 13) {
      return "rd";
    }
    return "th";
  };

  const handleRentScheduleChange = (tenantId: string, index: number, field: string, value: string) => {
    setTenants(prev => prev.map(tenant => {
      if (tenant.id === tenantId) {
        const newSchedule = [...(tenant.rentSchedule || [])];
        if (!newSchedule[index]) return tenant;
        
        const updatedItem = { ...newSchedule[index], [field]: value };
        
        // Auto-calculate toDate if fromDate or months changes
        if ((field === 'fromDate' || field === 'months') && updatedItem.fromDate && updatedItem.months) {
          try {
            const startDate = parseISO(updatedItem.fromDate);
            const months = parseInt(updatedItem.months, 10);
            if (!isNaN(months) && months > 0) {
              const endDate = subDays(addMonths(startDate, months), 1);
              updatedItem.toDate = format(endDate, 'yyyy-MM-dd');
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
        
        newSchedule[index] = updatedItem;
        return { ...tenant, rentSchedule: newSchedule };
      }
      return tenant;
    }));
  };

  const addRentScheduleYear = (tenantId: string) => {
    setTenants(prev => prev.map(tenant => {
      if (tenant.id === tenantId) {
        const currentSchedule = tenant.rentSchedule || [];
        const nextYear = currentSchedule.length + 1;
        return {
          ...tenant,
          rentSchedule: [
            ...currentSchedule,
            { year: `${nextYear}${getOrdinalSuffix(nextYear)} Year`, months: "11", amount: "", fromDate: "", toDate: "" }
          ]
        };
      }
      return tenant;
    }));
  };

  const removeRentScheduleYear = (tenantId: string, index: number) => {
    setTenants(prev => prev.map(tenant => {
      if (tenant.id === tenantId) {
        const newSchedule = (tenant.rentSchedule || []).filter((_, i) => i !== index);
        return { ...tenant, rentSchedule: newSchedule };
      }
      return tenant;
    }));
  };

  const addTenant = () => {
    const newTenant: TenantData = {
      id: Date.now().toString(),
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      emergencyContact: '',
      userUID: undefined,
      userInfo: null,
      isMarried: false,
      spouse: null,
      leaseStartDate: '',
      leaseEndDate: '',
      monthlyRent: '',
      securityDeposit: '',
      previousAddress: '',
      employmentStatus: '',
      employer: '',
      monthlyIncome: '',
      paymentDueDate: '',
      escalationPercentage: '',
      escalationAmount: '',
      noticePeriod: '',
      lockInPeriod: '',
      addNextAgreementManually: false,
      nextAgreementDraft: emptyNextAgreementDraft(),
      notes: '',
      searchError: undefined,
      searchingUser: false,
      rentSchedule: [{ year: "1st Year", months: "11", amount: "", fromDate: "", toDate: "" }]
    };
    setTenants(prev => [...prev, newTenant]);
  };

  const removeTenant = (tenantId: string) => {
    if (tenants.length === 1) {
      toast({
        title: "Error",
        description: "You must have at least one tenant",
        variant: "destructive"
      });
      return;
    }
    setTenants(prev => prev.filter(tenant => tenant.id !== tenantId));
  };

  const validateTenant = (tenant: TenantData) => {
    return tenant.firstName && tenant.lastName && tenant.email && !!indianMobile(tenant.phone);
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;

    const invalidTenants = tenants.filter(tenant => !validateTenant(tenant));
    if (invalidTenants.length > 0) {
      toast({
        title: "Error",
        description: "Please fill in all required fields (Name, Email, Phone) for all tenants",
        variant: "destructive"
      });
      return;
    }

    const tenantsStillSearching = tenants.filter(tenant => tenant.searchingUser);
    if (tenantsStillSearching.length > 0) {
      toast({
        title: "Please Wait",
        description: "Please wait for user search to complete before submitting",
        variant: "destructive"
      });
      return;
    }

    const tenantsWithMissingSpouseInfo = tenants.filter(tenant => {
      if (tenant.isMarried && tenant.spouse) {
        return !tenant.spouse.firstName || !tenant.spouse.lastName || !tenant.spouse.phone;
      }
      return false;
    });

    if (tenantsWithMissingSpouseInfo.length > 0) {
      toast({
        title: "Error",
        description: "Please fill in spouse details (First Name, Last Name, Phone) for married tenants",
        variant: "destructive"
      });
      return;
    }
    const invalidNextAgreement=tenants.map(tenant=>tenant.addNextAgreementManually?validateNextAgreementDraft(tenant.nextAgreementDraft,tenant.leaseEndDate):'').find(Boolean);
    if(invalidNextAgreement){toast({title:'Check next agreement details',description:invalidNextAgreement,variant:'destructive'});return;}

    setIsSubmitting(true);
    try {
      const propertyResponse = await apiFetch(`${API_BASE_URL}/properties/${propertyId}`);
      const propertyData = await propertyResponse.json();

      if (!propertyData.success) {
        throw new Error("Failed to get property data");
      }

      const property = propertyData.property;

      const newTenantInfos = tenants.map(({ id, userInfo, searchError, searchingUser, searchTimeoutId, ...tenant }) => ({
        id: editingTenantId&&tenants.length===1 ? editingTenantId : Date.now().toString() + Math.random().toString(36).substr(2, 9),
        firstName: tenant.firstName,
        lastName: tenant.lastName,
        email: tenant.email,
        phone: tenant.phone,
        emergencyContact: tenant.emergencyContact,
        userUID: tenant.userUID,
        isMarried: tenant.isMarried,
        spouse: tenant.isMarried && tenant.spouse ? tenant.spouse : null,
        leaseStartDate: tenant.leaseStartDate,
        leaseEndDate: tenant.leaseEndDate,
        monthlyRent: tenant.monthlyRent,
        securityDeposit: tenant.securityDeposit,
        previousAddress: tenant.previousAddress,
        employmentStatus: tenant.employmentStatus,
        employer: tenant.employer,
        monthlyIncome: tenant.monthlyIncome,
        paymentDueDate: tenant.paymentDueDate,
        escalationPercentage: tenant.escalationPercentage,
        escalationAmount: tenant.escalationAmount,
        noticePeriod: tenant.noticePeriod,
        lockInPeriod: tenant.lockInPeriod,
        nextAgreementDraft: tenant.addNextAgreementManually ? tenant.nextAgreementDraft : null,
        notes: tenant.notes,
        rentSchedule: tenant.rentSchedule,
        isActive: true
      }));

      if(adminMode&&(newTenantInfos.length!==1||!newTenantInfos[0].userUID))throw new Error('Select one registered tenant before saving');
      const editingExisting=!adminMode&&!!editingTenantId&&newTenantInfos.length===1;
      const editableTenant={...(newTenantInfos[0]||{})};
      delete editableTenant.id;
      delete editableTenant.userUID;
      const headers={'Content-Type':'application/json'};
      const response = adminMode
        ? await apiFetch(`${API_BASE_URL}/admin/properties/${propertyId}/tenancy`,{method:'POST',headers,body:JSON.stringify({
          action:existingTenants.length?'replace':'assign',
          expectedRevision:tenancyRevision,
          tenant:newTenantInfos[0]
        })})
        : editingExisting
        ? await apiFetch(`${API_BASE_URL}/tenants/${encodeURIComponent(editingTenantId)}`,{method:'PUT',headers,body:JSON.stringify({
          ...editableTenant,
          expectedPropertyUpdatedAt:propertyUpdatedAt
        })})
        : await apiFetch(`${API_BASE_URL}/tenants`,{method:'POST',headers,body:JSON.stringify({
          propertyId: propertyId,
          ownerUID: property.ownerUID,
          tenants: newTenantInfos
        })});

      const data = await response.json();

      if (data.success) {
        await Promise.all(['relationshipLinks','userProperties','productHub','property','allProperties'].map(key=>queryClient.invalidateQueries({queryKey:[key]})));
        setIsSubmitting(false);
        setIsSuccess(true);
        toast({
          title: "Success",
          description: adminMode ? 'Tenancy saved. The property owner must authorize the invitation in Pending Connections.' : editingExisting ? 'Tenant and agreement details updated.' : 'Tenancy saved. The tenant must accept the connection before the property appears in their account.'
        });

        setTimeout(() => {
          navigate(adminMode?"/admin":"/manage-property");
        }, 1500);
      } else {
        setIsSubmitting(false);
        toast({
          title: "Error",
          description: data.message || "Failed to add tenants",
          variant: "destructive"
        });
      }

    } catch (error) {
      setIsSubmitting(false);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save tenant details. Please try again.",
        variant: "destructive"
      });
    }
  };

  const removeExistingTenant=async(tenantId:string)=>{
    if(!adminMode||isSubmitting)return;
    setIsSubmitting(true);
    try{const response=await apiFetch(`${API_BASE_URL}/admin/properties/${propertyId}/tenancy`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'remove',expectedRevision:tenancyRevision,tenantId})});const data=await response.json();if(!response.ok)throw new Error(data.message||'Tenant could not be removed');setExistingTenants([]);setTenancyRevision(Number(data.tenancyRevision));toast({title:'Tenant removed',description:'The previous tenancy remains in relationship history.'});}
    catch(error){toast({title:'Unable to remove tenant',description:error instanceof Error?error.message:'Please refresh and try again.',variant:'destructive'});}
    finally{setIsSubmitting(false);}
  };

  return (
    <main className={`container mx-auto py-8 px-4 pb-20 ${styles.workspace}`}>
      <>
        <title>{readOnly || existingTenants.length > 0 ? 'Tenant Details' : 'Add Tenant'} — Property Management</title>
        <meta name="description" content={readOnly || existingTenants.length > 0 ? "View tenant details for rental property" : "Add tenant details for rental property"} />
      </>

      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Button variant="ghost" onClick={() => navigate("/manage-property")} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Manage Properties
          </Button>

          <div className="flex items-center gap-4 mb-4">
            <div className={styles.symbol}>
              <UserPlus className="h-8 w-8 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">
                {readOnly || existingTenants.length > 0 ? 'Tenant Details' : 'Add Tenants'}
              </h1>
              <p className="text-lg text-muted-foreground">
                {propertyTitle ? `${propertyTitle} - ` : ''}Property ID: {propertyId}
              </p>
            </div>
          </div>
        </div>

        {existingTenants.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <User className="h-5 w-5" />
              <h2 className="text-2xl font-bold">Current Tenants ({existingTenants.length})</h2>
            </div>

            {!readOnly && (
              <div className="mb-4 p-4 border border-orange-200 bg-orange-50 rounded-lg">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <span className="text-orange-600">🏠</span>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-orange-800">
                      {adminMode?'Saving the selected registered user will replace the current active tenancy and preserve its history.':'This property is currently occupied. You cannot add or edit tenants while the property has active tenants.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-4">
              {existingTenants.map((tenant, index) => (
                <Card key={tenant.id} className="border-2 border-blue-200 bg-blue-50/50">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">
                        {tenant.firstName} {tenant.lastName}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <span className="text-sm bg-green-100 text-green-800 px-2 py-1 rounded-full">
                          {tenant.userUID ? 'Active Tenant - Account connected' : 'Active tenancy - Connection pending'}
                        </span>
                        {adminMode&&<Button type="button" variant="outline" size="sm" disabled={isSubmitting} onClick={()=>void removeExistingTenant(tenant.id)}>Remove tenant</Button>}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <h3 className="text-md font-semibold text-gray-700 mb-3 border-b pb-1">Personal Information</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Email</label>
                          <p>{tenant.email}</p>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Phone</label>
                          <p>{tenant.phone}</p>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Tenant Name</label>
                          <p>{tenant.firstName} {tenant.lastName}</p>
                        </div>
                      </div>
                    </div>

                    {tenant.emergencyContact && (
                      <div>
                        <h3 className="text-md font-semibold text-gray-700 mb-3 border-b pb-1">Emergency Contact</h3>
                        <div className="text-sm">
                          <label className="text-xs font-medium text-muted-foreground">Contact Number/Details</label>
                          <p>{tenant.emergencyContact}</p>
                        </div>
                      </div>
                    )}

                    {tenant.isMarried && tenant.spouse && (
                      <div>
                        <h3 className="text-md font-semibold text-gray-700 mb-3 border-b pb-1">Spouse Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <label className="text-xs font-medium text-muted-foreground">Spouse Name</label>
                            <p>{tenant.spouse.firstName} {tenant.spouse.lastName}</p>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-muted-foreground">Spouse Email</label>
                            <p>{tenant.spouse.email || 'N/A'}</p>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-muted-foreground">Spouse Phone</label>
                            <p>{tenant.spouse.phone}</p>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-muted-foreground">Spouse Employment</label>
                            <p className="capitalize">{tenant.spouse.employmentStatus || 'N/A'}</p>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-muted-foreground">Spouse Employer</label>
                            <p>{tenant.spouse.employer || 'N/A'}</p>
                          </div>
                          <div className="md:col-span-3">
                            <label className="text-xs font-medium text-muted-foreground">Spouse Notes</label>
                            <p>{tenant.spouse.notes || 'N/A'}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div>
                      <h3 className="text-md font-semibold text-gray-700 mb-3 border-b pb-1">Lease Information</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Lease Start</label>
                          <p>{tenant.leaseStartDate ? new Date(tenant.leaseStartDate).toLocaleDateString() : 'N/A'}</p>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Lease End</label>
                          <p>{tenant.leaseEndDate ? new Date(tenant.leaseEndDate).toLocaleDateString() : 'N/A'}</p>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Monthly Rent</label>
                          <p className="font-semibold">₹{Number(tenant.monthlyRent).toLocaleString()}</p>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Security Deposit</label>
                          <p>{tenant.securityDeposit ? `₹${Number(tenant.securityDeposit).toLocaleString()}` : 'N/A'}</p>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Payment Due Date</label>
                          <p>{tenant.paymentDueDate ? `Day ${tenant.paymentDueDate} of month` : 'N/A'}</p>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Notice Period</label>
                          <p>{tenant.noticePeriod || 'N/A'}</p>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Lock-in Period</label>
                          <p>{tenant.lockInPeriod ? `${tenant.lockInPeriod} Months` : 'N/A'}</p>
                        </div>
                        {((tenant.rentSchedule && tenant.rentSchedule.length > 0) || (propertyRentSchedule && propertyRentSchedule.length > 0)) && (
                          <div className="md:col-span-3 mt-2">
                            <label className="text-xs font-medium text-muted-foreground mb-1 block">Rent Schedule</label>
                            <div className="border rounded-md overflow-hidden w-full md:w-2/3">
                              <table className="w-full text-sm">
                                <thead className="bg-gray-100">
                                  <tr>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Year</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Months</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Amount</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">From</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">To</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                  {(tenant.rentSchedule?.length > 0 ? tenant.rentSchedule : propertyRentSchedule).map((item, i) => (
                                    <tr key={i} className="bg-white">
                                      <td className="px-3 py-2">{item.year}</td>
                                      <td className="px-3 py-2">{item.months || '11'}</td>
                                      <td className="px-3 py-2">₹{Number(item.amount).toLocaleString()}</td>
                                      <td className="px-3 py-2">{item.fromDate ? new Date(item.fromDate).toLocaleDateString() : '-'}</td>
                                      <td className="px-3 py-2">{item.toDate ? new Date(item.toDate).toLocaleDateString() : '-'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-md font-semibold text-gray-700 mb-3 border-b pb-1">Background Information</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div className="md:col-span-3">
                          <label className="text-xs font-medium text-muted-foreground">Previous Address</label>
                          <p>{tenant.previousAddress || 'N/A'}</p>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Employment Status</label>
                          <p className="capitalize">{tenant.employmentStatus || 'N/A'}</p>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Employer/Company</label>
                          <p>{tenant.employer || 'N/A'}</p>
                        </div>
                        <div className="md:col-span-3">
                          <label className="text-xs font-medium text-muted-foreground">Additional Notes</label>
                          <p>{tenant.notes || 'N/A'}</p>
                        </div>
                      </div>
                    </div>

                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {!readOnly && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">
                  {adminMode&&existingTenants.length>0?'Replacement tenant':existingTenants.length > 0 ? 'Add New Tenants' : 'Tenant Information'}
                </h2>
                <p className="text-muted-foreground">
                  {existingTenants.length > 0
                    ? adminMode?'Enter the replacement tenant and rental details.':'Add additional tenants to this property'
                    : 'Enter tenant details for this property'
                  }
                </p>
              </div>
              {!adminMode&&<Button onClick={addTenant} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                {existingTenants.length > 0 ? 'Add Another Tenant' : 'Add New Tenant'}
              </Button>}
            </div>

            {tenants.map((tenant, index) => (
              <Card key={tenant.id} className="border-2">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Tenant {index + 1}
                    </CardTitle>
                    <CardDescription>
                      Enter tenant details below
                    </CardDescription>
                  </div>
                  {tenants.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeTenant(tenant.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Personal Information
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor={`firstName - ${tenant.id} `}>First Name *</Label>
                        <Input
                          id={`firstName - ${tenant.id} `}
                          value={tenant.firstName}
                          onChange={(e) => handleInputChange(tenant.id, 'firstName', e.target.value)}
                          placeholder="Enter first name"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`lastName - ${tenant.id} `}>Last Name *</Label>
                        <Input
                          id={`lastName - ${tenant.id} `}
                          value={tenant.lastName}
                          onChange={(e) => handleInputChange(tenant.id, 'lastName', e.target.value)}
                          placeholder="Enter last name"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`email - ${tenant.id} `}>Email *</Label>
                        <Input
                          id={`email - ${tenant.id} `}
                          type="email"
                          value={tenant.email}
                          onChange={(e) => handleInputChange(tenant.id, 'email', e.target.value)}
                          placeholder="tenant@example.com"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`phone - ${tenant.id} `}>Phone *</Label>
                        <p className="text-xs text-muted-foreground">This number is saved as contact information. Account discovery uses the tenant&apos;s verified email, followed by tenant confirmation.</p>
                        <div className="relative">
                          <Input
                            id={`phone - ${tenant.id} `}
                            value={tenant.phone}
                            onChange={(e) => handleInputChange(tenant.id, 'phone', e.target.value)}
                            placeholder="+9193 XXXXXX"
                            className={tenant.searchError ? "border-red-500" : tenant.userInfo ? "border-green-500" : ""}
                          />
                          {tenant.searchingUser && (
                            <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                          )}
                          {!tenant.searchingUser && tenant.userInfo && (
                            <CheckCircle2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-green-500" />
                          )}
                          {!tenant.searchingUser && tenant.searchError && (
                            <XCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-red-500" />
                          )}
                        </div>
                        {tenant.userInfo && !tenant.searchingUser && (
                          <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                            <div className="flex items-center gap-3">
                              {tenant.userInfo.photoURL && (
                                <img
                                  src={tenant.userInfo.photoURL}
                                  alt={tenant.userInfo.name}
                                  className="w-10 h-10 rounded-full object-cover"
                                />
                              )}
                              <div className="flex-1">
                                <p className="text-sm font-medium text-green-900">{tenant.userInfo.name}</p>
                                <p className="text-xs text-green-700">{tenant.userInfo.email}</p>
                                <p className="text-xs text-green-600 mt-1">✓ Verified platform user</p>
                              </div>
                            </div>
                          </div>
                        )}
                        {tenant.searchError && !tenant.searchingUser && (
                          <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-sm text-red-900">{tenant.searchError}</p>
                          </div>
                        )}
                      </div>
                      <div className="md:col-span-2">
                        <Label htmlFor={`emergencyContact - ${tenant.id} `}>Emergency Contact</Label>
                        <Input
                          id={`emergencyContact - ${tenant.id} `}
                          value={tenant.emergencyContact}
                          onChange={(e) => handleInputChange(tenant.id, 'emergencyContact', e.target.value)}
                          placeholder="Emergency contact name and phone"
                        />
                      </div>

                      <div className="md:col-span-2 flex items-center space-x-2 pt-2">
                        <Checkbox
                          id={`isMarried - ${tenant.id} `}
                          checked={tenant.isMarried}
                          onCheckedChange={(checked) => handleMaritalStatusChange(tenant.id, checked as boolean)}
                        />
                        <Label
                          htmlFor={`isMarried - ${tenant.id} `}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          Is the tenant married?
                        </Label>
                      </div>
                    </div>
                  </div>

                  {tenant.isMarried && (
                    <div className="border rounded-lg p-4 bg-blue-50/50">
                      <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Spouse Information
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor={`spouseFirstName - ${tenant.id} `}>Spouse First Name *</Label>
                          <Input
                            id={`spouseFirstName - ${tenant.id} `}
                            value={tenant.spouse?.firstName || ''}
                            onChange={(e) => handleSpouseChange(tenant.id, 'firstName', e.target.value)}
                            placeholder="Enter spouse first name"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`spouseLastName - ${tenant.id} `}>Spouse Last Name *</Label>
                          <Input
                            id={`spouseLastName - ${tenant.id} `}
                            value={tenant.spouse?.lastName || ''}
                            onChange={(e) => handleSpouseChange(tenant.id, 'lastName', e.target.value)}
                            placeholder="Enter spouse last name"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`spouseEmail - ${tenant.id} `}>Spouse Email</Label>
                          <Input
                            id={`spouseEmail - ${tenant.id} `}
                            type="email"
                            value={tenant.spouse?.email || ''}
                            onChange={(e) => handleSpouseChange(tenant.id, 'email', e.target.value)}
                            placeholder="spouse@example.com"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`spousePhone - ${tenant.id} `}>Spouse Phone *</Label>
                          <Input
                            id={`spousePhone - ${tenant.id} `}
                            value={tenant.spouse?.phone || ''}
                            onChange={(e) => handleSpouseChange(tenant.id, 'phone', e.target.value)}
                            placeholder="+9193 XXXXXX"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`spouseEmploymentStatus - ${tenant.id} `}>Spouse Employment Status</Label>
                          <Select
                            value={tenant.spouse?.employmentStatus || ''}
                            onValueChange={(value) => handleSpouseChange(tenant.id, 'employmentStatus', value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="employed">Employed</SelectItem>
                              <SelectItem value="self-employed">Self-Employed</SelectItem>
                              <SelectItem value="unemployed">Unemployed</SelectItem>
                              <SelectItem value="student">Student</SelectItem>
                              <SelectItem value="retired">Retired</SelectItem>
                              <SelectItem value="homemaker">Homemaker</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor={`spouseEmployer - ${tenant.id} `}>Spouse Employer/Company</Label>
                          <Input
                            id={`spouseEmployer - ${tenant.id} `}
                            value={tenant.spouse?.employer || ''}
                            onChange={(e) => handleSpouseChange(tenant.id, 'employer', e.target.value)}
                            placeholder="Company name"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <Label htmlFor={`spouseNotes - ${tenant.id} `}>Spouse Additional Notes</Label>
                          <Textarea
                            id={`spouseNotes - ${tenant.id} `}
                            value={tenant.spouse?.notes || ''}
                            onChange={(e) => handleSpouseChange(tenant.id, 'notes', e.target.value)}
                            placeholder="Any additional notes about the spouse"
                            rows={2}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Lease Information
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor={`monthlyRent - ${tenant.id} `}>Monthly Rent</Label>
                        <Input
                          id={`monthlyRent - ${tenant.id} `}
                          value={tenant.monthlyRent}
                          onChange={(e) => handleInputChange(tenant.id, 'monthlyRent', e.target.value)}
                          placeholder="2500"
                        />
                        <AmountInWords amount={tenant.monthlyRent}/>
                      </div>
                      <div>
                        <Label htmlFor={`securityDeposit - ${tenant.id} `}>Security Deposit</Label>
                        <Input
                          id={`securityDeposit - ${tenant.id} `}
                          value={tenant.securityDeposit}
                          onChange={(e) => handleInputChange(tenant.id, 'securityDeposit', e.target.value)}
                          placeholder="5000"
                        />
                        <AmountInWords amount={tenant.securityDeposit}/>
                      </div>

                      <div className="md:col-span-2 mt-2 space-y-4 pt-4 border-t">
                        <div className="flex items-center justify-between">
                          <Label className="text-base font-semibold">Monthly Rent Schedule</Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => addRentScheduleYear(tenant.id)}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Year
                          </Button>
                        </div>

                        <div className="space-y-4">
                          {(tenant.rentSchedule || []).map((item, index) => (
                            <div key={index} className="flex flex-col md:flex-row gap-5 p-5 border border-slate-200 rounded-xl bg-slate-50/50 shadow-sm items-end relative transition-all hover:shadow-md hover:border-slate-300">
                              <div className="w-full md:w-[120px] shrink-0">
                                <Label className="text-xs font-medium text-slate-500 mb-1.5 block">Year</Label>
                                <Input
                                  value={item.year}
                                  onChange={(e) => handleRentScheduleChange(tenant.id, index, 'year', e.target.value)}
                                  className="bg-white shadow-sm"
                                />
                              </div>
                              <div className="w-full md:w-[90px] shrink-0">
                                <Label className="text-xs font-medium text-slate-500 mb-1.5 block">Months</Label>
                                <Input
                                  type="number"
                                  value={item.months || ""}
                                  onChange={(e) => handleRentScheduleChange(tenant.id, index, 'months', e.target.value)}
                                  placeholder="11"
                                  className="bg-white shadow-sm"
                                />
                              </div>
                              <div className="w-full md:w-[140px] shrink-0">
                                <Label className="text-xs font-medium text-slate-500 mb-1.5 block">Amount (₹)</Label>
                                <Input
                                  value={item.amount}
                                  onChange={(e) => handleRentScheduleChange(tenant.id, index, 'amount', e.target.value)}
                                  placeholder="Amount"
                                  className="bg-white shadow-sm"
                                />
                                <AmountInWords amount={item.amount}/>
                              </div>
                              <div className="w-full md:flex-1 min-w-[150px]">
                                <Label className="text-xs font-medium text-slate-500 mb-1.5 block">From</Label>
                                <div className="w-full">
                                  <DatePicker
                                    value={item.fromDate}
                                    onChange={(value) => handleRentScheduleChange(tenant.id, index, 'fromDate', value)}
                                    className="bg-white shadow-sm w-full"
                                  />
                                </div>
                              </div>
                              <div className="w-full md:flex-1 min-w-[150px]">
                                <Label className="text-xs font-medium text-slate-500 mb-1.5 block">To</Label>
                                <div className="w-full">
                                  <DatePicker
                                    value={item.toDate}
                                    onChange={(value) => handleRentScheduleChange(tenant.id, index, 'toDate', value)}
                                    className="bg-white shadow-sm w-full"
                                  />
                                </div>
                              </div>

                              {(tenant.rentSchedule || []).length > 1 && (
                                <div className="shrink-0 flex items-center justify-center pb-[2px]">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeRentScheduleYear(tenant.id, index)}
                                    className="text-red-500 hover:text-red-600 hover:bg-red-50 h-10 w-10 rounded-full transition-colors"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <Label htmlFor={`paymentDueDate - ${tenant.id} `}>Payment Due Date (Day of Month)</Label>
                        <Input
                          id={`paymentDueDate - ${tenant.id} `}
                          type="number"
                          min="1"
                          max="31"
                          value={tenant.paymentDueDate}
                          onChange={(e) => handleInputChange(tenant.id, 'paymentDueDate', e.target.value)}
                          placeholder="e.g., 5 (for 5th of each month)"
                        />
                      </div>
                      <div className="md:col-span-2 mt-2 border-t pt-4"><h5 className="font-medium">Agreement Details</h5></div>
                      <div>
                        <Label htmlFor={`leaseStartDate - ${tenant.id} `}>Agreement Start Date</Label>
                        <DatePicker value={tenant.leaseStartDate} onChange={(value) => handleInputChange(tenant.id, 'leaseStartDate', value)}/>
                      </div>
                      <div>
                        <Label htmlFor={`leaseEndDate - ${tenant.id} `}>Agreement End Date</Label>
                        <DatePicker value={tenant.leaseEndDate} onChange={(value) => handleInputChange(tenant.id, 'leaseEndDate', value)}/>
                      </div>
                      <div>
                        <Label htmlFor={`noticePeriod - ${tenant.id} `}>Notice Period / Early Termination Notice *</Label>
                        <Select
                          value={tenant.noticePeriod || ""}
                          onValueChange={(value) => handleInputChange(tenant.id, 'noticePeriod', value)}
                        >
                          <SelectTrigger id={`noticePeriod - ${tenant.id} `} className="mt-1.5">
                            <SelectValue placeholder="Select Notice Period" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1 Month">1 Month</SelectItem>
                            <SelectItem value="2 Months">2 Months</SelectItem>
                            <SelectItem value="3 Months">3 Months</SelectItem>
                            <SelectItem value="4 Months">4 Months</SelectItem>
                            <SelectItem value="5 Months">5 Months</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor={`lockInPeriod - ${tenant.id} `}>Lock-in Period (in Months)</Label>
                        <Input
                          id={`lockInPeriod - ${tenant.id} `}
                          type="number"
                          value={tenant.lockInPeriod}
                          onChange={(e) => handleInputChange(tenant.id, 'lockInPeriod', e.target.value)}
                          placeholder="Specify lock-in period in months"
                          className="mt-1.5"
                        />
                      </div>
                      <NextAgreementFields idPrefix={`tenant-${tenant.id}-next-agreement`} enabled={tenant.addNextAgreementManually} currentAgreementEndDate={tenant.leaseEndDate} value={tenant.nextAgreementDraft} onEnabledChange={enabled=>setTenants(current=>current.map(item=>item.id===tenant.id?{...item,addNextAgreementManually:enabled}:item))} onChange={draft=>setTenants(current=>current.map(item=>item.id===tenant.id?{...item,nextAgreementDraft:draft}:item))}/>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Background Information
                    </h4>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor={`previousAddress - ${tenant.id} `}>Previous Address</Label>
                        <Textarea
                          id={`previousAddress - ${tenant.id} `}
                          value={tenant.previousAddress}
                          onChange={(e) => handleInputChange(tenant.id, 'previousAddress', e.target.value)}
                          placeholder="Enter previous address"
                          rows={2}
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor={`employmentStatus - ${tenant.id} `}>Employment Status</Label>
                          <Select value={tenant.employmentStatus} onValueChange={(value) => handleInputChange(tenant.id, 'employmentStatus', value)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="employed">Employed</SelectItem>
                              <SelectItem value="self-employed">Self-Employed</SelectItem>
                              <SelectItem value="unemployed">Unemployed</SelectItem>
                              <SelectItem value="student">Student</SelectItem>
                              <SelectItem value="retired">Retired</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label htmlFor={`employer - ${tenant.id} `}>Employer/Company</Label>
                          <Input id={`employer - ${tenant.id} `} value={tenant.employer} placeholder="Company name"
                            onChange={(e) => handleInputChange(tenant.id, 'employer', e.target.value)} />
                        </div>

                      </div>

                      <div>
                        <Label htmlFor={`notes - ${tenant.id} `}>Additional Notes</Label>
                        <Textarea id={`notes - ${tenant.id} `} value={tenant.notes} rows={3} placeholder="Any additional notes about the tenant"
                          onChange={(e) => handleInputChange(tenant.id, 'notes', e.target.value)} />
                      </div>

                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            <div className="flex justify-end">
              <Button 
                onClick={handleSubmit} 
                disabled={isSubmitting || isSuccess} 
                size="lg" 
                className={`px-8 transition-all ${isSuccess ? 'bg-green-600 text-white opacity-100 hover:bg-green-700 disabled:opacity-100' : ''}`}
              >
                {isSuccess ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Saved
                  </>
                ) : isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    {adminMode?(existingTenants.length?'Replace Tenant':'Assign Tenant'):editingTenantId?'Save Tenant Details':`Add Tenant${tenants.length > 1 ? 's' : ''}`}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </main >
  );
};

export default AddTenant;
