"use client";
import styles from "./DocumentWorkspace.module.css";

import { apiFetch } from '@/lib/api-client';
import {useAuth} from '@/contexts/AuthContext';

import { useParams, useNavigate, useLocation } from "@/lib/navigation";
import { ArrowLeft, FileText, Loader2, Upload, X, Eye, Plus, Trash2 } from "lucide-react";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/ui/card";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select";
import { Textarea } from "@/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useRef } from "react";
import AmountInWords from '@/components/AmountInWords';
import {SUPPORTING_DOCUMENT_MIME_TYPES,SUPPORTING_DOCUMENT_TYPES,uploadSupportingDocument,type SupportingDocumentType} from '@/lib/supporting-documents';
import { auth } from "../../firebase";
import { User, onAuthStateChanged } from "firebase/auth";
import { API_BASE_URL } from "../../utils/config";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog";

interface Document {
  id: string;
  documentName: string;
  documentType: string;
  fileUrl: string;
  contentType?:string;
  description?: string;
  createdAt: string;
  userId?: string;
  status?: string;
  financialYear?: string;
  period?: string;
  amount?: string;
  receiptDate?: string;
  adminComment?: string;
  statusHistory?: {status:string;comment:string;at:string}[];
}

const DOCUMENT_TYPES = [
  "Agreement",
  "Receipt",
  "Invoice",
  "Certificate",
  "Other",
  "tds_report",
  "payment_receipt"
];
const SUPPORTING_TYPES=Object.keys(SUPPORTING_DOCUMENT_TYPES);

const AttachDocuments = () => {
  const {fileAccess,retryFileAccess}=useAuth();
  const [previewFailed,setPreviewFailed]=useState(false),[previewRevision,setPreviewRevision]=useState(0);
  const { propertyId } = useParams();
  const location=useLocation();
  const reportType=new URLSearchParams(location.search).get("type")||"";
  const supportingMode=new URLSearchParams(location.search).get("supporting")==="1";
  const [metadata,setMetadata]=useState({financialYear:"",period:"",amount:"",receiptDate:""});
  const [fieldErrors,setFieldErrors]=useState<Record<string,string>>({});
  const [reviewDraft,setReviewDraft]=useState<Record<string,{status:string;comment:string}>>({});
  const [loadError,setLoadError]=useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  const [user, setUser] = useState<User | null>(null);
  const [property, setProperty] = useState<any>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [viewingDocument, setViewingDocument] = useState<Document | null>(null);
  useEffect(()=>setPreviewFailed(false),[viewingDocument?.id,fileAccess.revision]);

  // Form state
  const [documentName, setDocumentName] = useState<string>("");
  const [documentType, setDocumentType] = useState<string>(reportType||(supportingMode?'rental_agreement':''));
  const [fileUrl, setFileUrl] = useState<string>("");
  const [selectedFile,setSelectedFile]=useState<File|null>(null);
  const [documentRequestKey,setDocumentRequestKey]=useState(()=>crypto.randomUUID());
  const [description, setDescription] = useState<string>("");
  const [showAddForm, setShowAddForm] = useState<boolean>(false);

  const visibleDocuments=documents.filter(doc=>supportingMode?SUPPORTING_TYPES.includes(doc.documentType):!reportType||doc.documentType===reportType);
  const availableDocumentTypes=supportingMode?SUPPORTING_TYPES:DOCUMENT_TYPES;
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        toast({
          title: "Login Required",
          description: "Please login to manage documents",
          variant: "destructive"
        });
        navigate("/auth");
        return;
      }
    });
    return () => unsubscribe();
  }, [navigate, toast]);

  useEffect(() => {
    const fetchData = async () => {
      if (!propertyId) {
        setLoading(false);
        return;
      }

      try {
        // Fetch property
        const propertyResponse = await apiFetch(`${API_BASE_URL}/properties/${propertyId}`);
        if(!propertyResponse.ok)throw new Error("Could not load property. Check your access and try again.");
        if (propertyResponse.ok) {
          const propertyData = await propertyResponse.json();
          if (propertyData.success && propertyData.property) {
            setProperty(propertyData.property);
          }
        }

        // Fetch documents
        const documentsResponse = await apiFetch(`${API_BASE_URL}/documents/property/${propertyId}`);
        if(!documentsResponse.ok)throw new Error("Could not load documents. Check your access and try again.");
        if (documentsResponse.ok) {
          const documentsData = await documentsResponse.json();
          if (documentsData.success && documentsData.documents) {
            setDocuments(documentsData.documents);
          }
        }
      } catch (error) { setLoadError(error instanceof Error?error.message:"Could not load documents"); } finally {
        setLoading(false);
      }
    };

    if (propertyId && user) {
      fetchData();
    } else if (propertyId) {
      setLoading(false);
    }
  }, [propertyId, user]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file size (limit to 5MB to avoid connection issues)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast({
        title: "File Too Large",
        description: "Please upload a file smaller than 5MB",
        variant: "destructive"
      });
      return;
    }

    if (supportingMode&&!SUPPORTING_DOCUMENT_MIME_TYPES.includes(file.type as typeof SUPPORTING_DOCUMENT_MIME_TYPES[number])||!supportingMode&&!file.type.startsWith('image/')&&!file.type.includes('pdf')) {
      toast({
        title: "Invalid File",
        description: "Please upload an image or PDF file",
        variant: "destructive"
      });
      return;
    }

    if(supportingMode){setSelectedFile(file);setFileUrl('selected');return;}

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;

      setFileUrl(result);
    };
    reader.onerror = () => {
      toast({
        title: "File Read Error",
        description: "Failed to read the file. Please try again.",
        variant: "destructive"
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast({
        title: "Login Required",
        description: "Please login to upload documents",
        variant: "destructive"
      });
      navigate("/auth");
      return;
    }

    const nextErrors:Record<string,string>={};
    if(!documentName.trim())nextErrors.documentName='Enter a document name.';
    else if(documentName.trim().length>150)nextErrors.documentName='Document name must be 150 characters or fewer.';
    if(!documentType)nextErrors.documentType='Choose a document type.';
    if(!fileUrl)nextErrors.file='Choose an image or PDF.';
    if(description.length>1000)nextErrors.description='Description must be 1000 characters or fewer.';
    if(["tds_report","payment_receipt"].includes(documentType)&&metadata.amount&&(Number(metadata.amount)<0||!Number.isFinite(Number(metadata.amount))))nextErrors.amount='Enter a valid non-negative amount.';
    setFieldErrors(nextErrors);if(Object.keys(nextErrors).length)return;

    setSubmitting(true);
    try {
      // Check file size before sending (base64 is ~33% larger than original)
      const base64Size = fileUrl.length;
      const estimatedOriginalSize = base64Size * 0.75; // Approximate original size

      if (estimatedOriginalSize > 5 * 1024 * 1024) { // 5MB limit
        toast({
          title: "File Too Large",
          description: `File size is ${Math.round(estimatedOriginalSize / 1024 / 1024 * 10) / 10}MB. Please upload a file smaller than 5MB.`,
          variant: "destructive"
        });
        setSubmitting(false);
        return;
      }

      const applicableMetadata=["tds_report","payment_receipt"].includes(documentType)?metadata:{};
      const requestBody = {
        propertyId: propertyId || '',
        documentName: documentName.trim(),
        documentType: documentType,
        fileUrl: fileUrl,
        description: description.trim(),
        ...applicableMetadata,
      };

      const response = supportingMode&&selectedFile ? null : await apiFetch(`${API_BASE_URL}/documents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': user.uid,
        },
        body: JSON.stringify(requestBody),
      });

      if (response&&!response.ok) {
        const errorData=await response.json().catch(()=>null) as {message?:string}|null;
        const safeMessage=response.status===400?errorData?.message:response.status===403?'You do not have permission to upload documents for this property.':response.status===413?'The selected file is too large.':'The document could not be uploaded. Please try again.';
        throw new Error(safeMessage||'The document could not be uploaded.');
      }

      let data;
      if(supportingMode&&selectedFile)data={success:true,document:await uploadSupportingDocument(propertyId||'',selectedFile,documentType as SupportingDocumentType,documentRequestKey)};
      else {const responseText = await response!.text();try {data = JSON.parse(responseText);} catch {throw new Error('The document service returned an invalid response. Please try again.');}}

      if (data.success) {
        // Send a notification to the admin
        try {
          const notificationPayload = {
            type: 'document_upload',
            title: `New Document Uploaded: ${documentName.trim()}`,
            message: `User ${user.displayName || user.email || 'Unknown User'} has uploaded a document (${documentType}) for property: ${property?.title || propertyId}.`,
            propertyId: propertyId || '',
            userId: user.uid || '',
            userName: user.displayName || user.email || 'Unknown User',
            userEmail: user.email || '',
            serviceImage: data.document?.fileUrl || '', // Use the uploaded R2 URL from the response
            timestamp: new Date().toISOString(),
            isRead: false,
            priority: 'medium'
          };
          
          await apiFetch(`${API_BASE_URL}/admin/notifications`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(notificationPayload),
          });
        } catch (error) {
          console.error('Failed to send notification for document upload', error);
        }

        toast({
          title: "Document Uploaded",
          description: "Document has been uploaded successfully.",
        });
        // Reset form
        setDocumentName("");
        setDocumentType(reportType||(supportingMode?'rental_agreement':''));
        setFileUrl("");
        setSelectedFile(null);
        setDocumentRequestKey(crypto.randomUUID());
        setDescription("");
        setMetadata({financialYear:"",period:"",amount:"",receiptDate:""});
        setFieldErrors({});
        setShowAddForm(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        // Refresh documents list immediately
        try {
          const documentsResponse = await apiFetch(`${API_BASE_URL}/documents/property/${propertyId}`);
          if (documentsResponse.ok) {
            const documentsData = await documentsResponse.json();
            if (documentsData.success) {
              setDocuments(documentsData.documents || []);
            }
          }
        } catch (refreshError) {
          // Still show success since document was uploaded
        }
      } else {
        throw new Error(data.message || 'Failed to upload document');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to upload document. Please try again later.';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const updateReview=async(doc:Document)=>{
    const draft=reviewDraft[doc.id]||{status:doc.status||'submitted',comment:doc.adminComment||''};
    if(draft.comment.length>2000){setLoadError('Review comment must be 2000 characters or fewer.');return;}
    try{
      const response=await apiFetch(`${API_BASE_URL}/documents/${doc.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(draft)});
      if(!response.ok)throw new Error(response.status===403?'Administrator access is required.':'The document review could not be saved.');
      setDocuments(current=>current.map(item=>item.id===doc.id?{...item,status:draft.status,adminComment:draft.comment}:item));setLoadError('');
    }catch(error){setLoadError(error instanceof Error?error.message:'The document review could not be saved.');}
  };

  const handleDelete = async (documentId: string) => {
    if (!confirm("Are you sure you want to delete this document?")) {
      return;
    }

    try {
      const response = await apiFetch(`${API_BASE_URL}/documents/${documentId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Document Deleted",
          description: data.warning || "Document and stored file have been deleted successfully.",
        });
        // Refresh documents list
        const documentsResponse = await apiFetch(`${API_BASE_URL}/documents/property/${propertyId}`);
        if (documentsResponse.ok) {
          const documentsData = await documentsResponse.json();
          if (documentsData.success) {
            setDocuments(documentsData.documents || []);
          }
        }
      } else {
        throw new Error(data.message || 'Failed to delete document');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error?error.message:'Failed to delete document. Please try again later.',
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </div>
    );
  }

  return (
    <>
      <>
        <title>Attach Documents | PropBank</title>
      </>
      <div className={`container mx-auto px-4 py-8 max-w-5xl ${styles.workspace}`}>
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <Card className={styles.panel}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {reportType === "tds_report" ? "TDS Updation Report" : supportingMode ? "Property Supporting Documents" : "Documents and receipts"}
                </CardTitle>
                <CardDescription className="mt-2">
                  {property && `Property: ${property.title || property.id}`}
                </CardDescription>
              </div>
              <Button onClick={() => setShowAddForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Document
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadError && <p role="alert" className="text-destructive">{loadError}</p>}
            {reportType === "tds_report" && <p className="mb-4">TDS tracking records supplied amounts and documents. No tax computation is performed.</p>}
            {supportingMode && <p className="mb-4 text-sm text-muted-foreground">Upload rental evidence for administrator review. A document submission does not establish or transfer legal ownership.</p>}
            {visibleDocuments.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No documents attached yet</p>
                <Button onClick={() => setShowAddForm(true)} className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Document
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {visibleDocuments.map((doc) => (
                  <Card key={doc.id} className={styles.documentRow}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg">{doc.documentName}</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            Type: {doc.documentType}
                          </p>
                          <p className="text-sm">Status: {doc.status || "submitted"} · {doc.financialYear} {doc.period} {doc.amount && ` · Reported amount: ₹${doc.amount}`}</p>
                          {doc.adminComment && <p>Admin response: {doc.adminComment}</p>}
                          <details><summary>Status history</summary>{doc.statusHistory?.map((event,index)=><p key={index}>{event.status} · {new Date(event.at).toLocaleString()} {event.comment}</p>)}</details>
                          {property?.userRole === "admin" && <div className="mt-3 grid gap-2 sm:grid-cols-[12rem_1fr_auto]">
                            <Label className="sr-only" htmlFor={`review-status-${doc.id}`}>Review status</Label><select id={`review-status-${doc.id}`} className="h-10 rounded border px-2" value={reviewDraft[doc.id]?.status||doc.status||'submitted'} onChange={event=>setReviewDraft(current=>({...current,[doc.id]:{status:event.target.value,comment:current[doc.id]?.comment??doc.adminComment??''}}))}><option value="submitted">Submitted</option><option value="verified">Verified</option><option value="rejected">Rejected</option></select>
                            <Label className="sr-only" htmlFor={`review-comment-${doc.id}`}>Review comment</Label><Input id={`review-comment-${doc.id}`} maxLength={2000} placeholder="Review comment" value={reviewDraft[doc.id]?.comment??doc.adminComment??''} onChange={event=>setReviewDraft(current=>({...current,[doc.id]:{status:current[doc.id]?.status??doc.status??'submitted',comment:event.target.value}}))}/>
                            <Button size="sm" variant="outline" onClick={()=>void updateReview(doc)}>Save review</Button>
                          </div>}
                          {doc.description && (
                            <p className="text-sm mt-2">{doc.description}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-2">
                            Uploaded: {new Date(doc.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            aria-label={`Open ${doc.documentName}`}
                            onClick={() => setViewingDocument(doc)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            aria-label={`Delete ${doc.documentName}`}
                            disabled={user?.uid!==doc.userId && user?.uid!==property?.ownerUID && property?.userRole!=="admin"}
                            onClick={() => handleDelete(doc.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add Document Dialog */}
        <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
          <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Document</DialogTitle>
              <DialogDescription>
                Upload a document for this property
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="documentName">Document Name *</Label>
                <Input
                  id="documentName"
                  placeholder="Enter document name"
                  value={documentName}
                  onChange={(e) => setDocumentName(e.target.value)}
                  required
                  maxLength={150}
                />
                {fieldErrors.documentName&&<p role="alert" className="text-sm text-destructive">{fieldErrors.documentName}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="documentType">Document Type *</Label>
                <Select value={documentType} onValueChange={value=>{setDocumentType(value);setMetadata({financialYear:"",period:"",amount:"",receiptDate:""});setFieldErrors(previous=>({...previous,documentType:'',amount:''}));}}>
                  <SelectTrigger id="documentType">
                    <SelectValue placeholder="Select document type" />
                  </SelectTrigger>
                  <SelectContent>
                  {availableDocumentTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {SUPPORTING_DOCUMENT_TYPES[type as keyof typeof SUPPORTING_DOCUMENT_TYPES]||type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldErrors.documentType&&<p role="alert" className="text-sm text-destructive">{fieldErrors.documentType}</p>}
              </div>

              {["tds_report","payment_receipt"].includes(documentType) && <div className="grid gap-3 sm:grid-cols-2">{Object.entries(metadata).map(([key,value])=><div key={key}><Label htmlFor={key}>{({financialYear:"Financial year",period:"Reporting period",amount:"Reported amount (₹)",receiptDate:"Receipt date"} as Record<string,string>)[key]}</Label><Input id={key} type={key==="receiptDate"?"date":key==="amount"?"number":"text"} min={key==="amount"?0:undefined} step={key==="amount"?'0.01':undefined} maxLength={key==="amount"?undefined:80} value={value} onChange={e=>setMetadata({...metadata,[key]:e.target.value})}/>{key==='amount'&&<AmountInWords amount={value}/>} {fieldErrors[key]&&<p role="alert" className="text-sm text-destructive">{fieldErrors[key]}</p>}</div>)}</div>}
              <div className="space-y-2">
                <Label htmlFor="file">File *</Label>
                {fileUrl ? (
                  <div className="flex items-center gap-2 p-2 border rounded">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm flex-1">File selected</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setFileUrl("");
                        setSelectedFile(null);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = '';
                        }
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div>
                    <Input
                      type="file"
                      accept={supportingMode?"application/pdf,image/jpeg,image/png,image/webp":"image/*,application/pdf"}
                      onChange={handleFileUpload}
                      ref={fileInputRef}
                      className="hidden"
                      id="file"
                    />
                    <Label
                      htmlFor="file"
                      className="flex items-center gap-2 cursor-pointer border rounded p-2 hover:bg-gray-50"
                    >
                      <Upload className="h-4 w-4" />
                      <span className="text-sm">Upload File (Image or PDF)</span>
                    </Label>
                  </div>
                )}
                {fieldErrors.file&&<p role="alert" className="text-sm text-destructive">{fieldErrors.file}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  placeholder="Enter document description..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  maxLength={1000}
                />
                {fieldErrors.description&&<p role="alert" className="text-sm text-destructive">{fieldErrors.description}</p>}
              </div>

              <div className="flex gap-4">
                <Button
                  type="submit"
                  disabled={submitting || !documentName.trim() || !documentType || !fileUrl}
                  className="flex-1"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Document
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowAddForm(false);
                    setDocumentName("");
                    setDocumentType(reportType||(supportingMode?'rental_agreement':''));
                    setFileUrl("");
                    setSelectedFile(null);
                    setDescription("");
                    setMetadata({financialYear:"",period:"",amount:"",receiptDate:""});
                    setFieldErrors({});
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                  disabled={submitting}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* View Document Dialog */}
        <Dialog open={!!viewingDocument} onOpenChange={(open) => !open && setViewingDocument(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>{viewingDocument?.documentName}</DialogTitle>
              <DialogDescription>
                Type: {viewingDocument?.documentType}
              </DialogDescription>
            </DialogHeader>
            {viewingDocument && (
              <div className="mt-4">
                {viewingDocument.fileUrl.startsWith('/api/media/')&&fileAccess.phase!=='ready' ? (
                  <div role="status" className="space-y-3 p-6 text-sm"><p>{fileAccess.message||'Preparing secure file access...'}</p>{!['preparing','retrying'].includes(fileAccess.phase)&&<Button type="button" variant="outline" onClick={()=>void retryFileAccess()}>Retry secure file access</Button>}</div>
                ) : previewFailed ? (
                  <div role="alert" className="space-y-3 p-6 text-sm"><p>This file could not be opened. Check your connection or contact support if access was removed.</p><Button type="button" variant="outline" onClick={()=>{setPreviewFailed(false);setPreviewRevision(value=>value+1);}}>Retry preview</Button></div>
                ) : viewingDocument.contentType?.startsWith('image/') || viewingDocument.fileUrl.startsWith('data:image/') ? (
                  <img
                    key={`${viewingDocument.id}:${fileAccess.revision}:${previewRevision}`}
                    src={viewingDocument.fileUrl}
                    onError={()=>setPreviewFailed(true)}
                    alt={viewingDocument.documentName}
                    className="max-w-full h-auto rounded-md border"
                  />
                ) : viewingDocument.contentType==='application/pdf' || viewingDocument.fileUrl.includes('pdf') || viewingDocument.fileUrl.startsWith('data:application/pdf') ? (
                  <iframe
                     key={`${viewingDocument.id}:${fileAccess.revision}:${previewRevision}`}
                     src={viewingDocument.fileUrl}
                     onError={()=>setPreviewFailed(true)}
                     className="w-full h-[600px] border rounded"
                     title={viewingDocument.documentName}
                  />
                ) : (
                  <div className="p-8 text-center text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Preview not available for this file type</p>
                    <a
                      href={viewingDocument.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline mt-2 inline-block"
                    >
                      Download File
                    </a>
                  </div>
                )}
                {viewingDocument.description && (
                  <p className="mt-4 text-sm">{viewingDocument.description}</p>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
};

export default AttachDocuments;
