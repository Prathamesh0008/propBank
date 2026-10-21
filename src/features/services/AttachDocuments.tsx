"use client";
import styles from "./DocumentWorkspace.module.css";

import { apiFetch } from '@/lib/api-client';

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

const AttachDocuments = () => {
  const { propertyId } = useParams();
  const location=useLocation();
  const reportType=new URLSearchParams(location.search).get("type")||"";
  const [metadata,setMetadata]=useState({financialYear:"",period:"",amount:"",receiptDate:""});
  const [loadError,setLoadError]=useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  const [user, setUser] = useState<User | null>(null);
  const [property, setProperty] = useState<any>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [viewingDocument, setViewingDocument] = useState<Document | null>(null);

  // Form state
  const [documentName, setDocumentName] = useState<string>("");
  const [documentType, setDocumentType] = useState<string>(reportType);
  const [fileUrl, setFileUrl] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [showAddForm, setShowAddForm] = useState<boolean>(false);

  const visibleDocuments=documents.filter(doc=>!reportType||doc.documentType===reportType);
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

    if (!file.type.startsWith('image/') && !file.type.includes('pdf')) {
      toast({
        title: "Invalid File",
        description: "Please upload an image or PDF file",
        variant: "destructive"
      });
      return;
    }

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

    if (!documentName.trim() || !documentType || !fileUrl) {
      toast({
        title: "Required Fields Missing",
        description: "Please provide document name, type, and file",
        variant: "destructive"
      });
      return;
    }

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

      const requestBody = {
        propertyId: propertyId || '',
        documentName: documentName.trim(),
        documentType: documentType,
        fileUrl: fileUrl,
        description: description.trim(),
        ...metadata,
      };

      const response = await apiFetch(`${API_BASE_URL}/documents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': user.uid,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();

        let errorMessage = `Server error: ${response.status} ${response.statusText}`;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorMessage;
        } catch {
          // If not JSON, use the text
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const responseText = await response.text();

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error(`Invalid JSON response: ${responseText.substring(0, 100)}`);
      }

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
        setDocumentType(reportType);
        setFileUrl("");
        setDescription("");
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
                  {reportType === "tds_report" ? "TDS Updation Report" : "Documents and receipts"}
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
                          {property?.userRole === "admin" && <div className="flex flex-wrap gap-2">{["verified","rejected","submitted"].map(status=><Button key={status} size="sm" variant="outline" onClick={async()=>{try{const comment=window.prompt("Report review comment");if(comment===null)return;const response=await apiFetch(`${API_BASE_URL}/documents/${doc.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status,comment})});if(!response.ok)throw new Error("Could not update report");setDocuments(current=>current.map(item=>item.id===doc.id?{...item,status,adminComment:comment}:item));}catch(error){setLoadError(error instanceof Error?error.message:"Update failed");}}}>{status}</Button>)}</div>}
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
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="documentType">Document Type *</Label>
                <Select value={documentType} onValueChange={setDocumentType}>
                  <SelectTrigger id="documentType">
                    <SelectValue placeholder="Select document type" />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {["tds_report","payment_receipt"].includes(documentType) && <div className="grid gap-3 sm:grid-cols-2">{Object.entries(metadata).map(([key,value])=><div key={key}><Label htmlFor={key}>{({financialYear:"Financial year",period:"Period",amount:"Reported amount",receiptDate:"Receipt date"} as Record<string,string>)[key]}</Label><Input id={key} type={key==="receiptDate"?"date":"text"} value={value} onChange={e=>setMetadata({...metadata,[key]:e.target.value})}/></div>)}</div>}
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
                      accept="image/*,application/pdf"
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  placeholder="Enter document description..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
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
                    setDocumentType("");
                    setFileUrl("");
                    setDescription("");
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
                {viewingDocument.contentType?.startsWith('image/') || viewingDocument.fileUrl.startsWith('data:image/') ? (
                  <img
                    src={viewingDocument.fileUrl}
                    alt={viewingDocument.documentName}
                    className="max-w-full h-auto rounded-md border"
                  />
                ) : viewingDocument.contentType==='application/pdf' || viewingDocument.fileUrl.includes('pdf') || viewingDocument.fileUrl.startsWith('data:application/pdf') ? (
                  <iframe
                     src={viewingDocument.fileUrl}
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
