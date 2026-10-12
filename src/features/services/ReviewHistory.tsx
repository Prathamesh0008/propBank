"use client";
import {useQuery} from '@tanstack/react-query';
import {useAuth} from '@/contexts/AuthContext';
import {workflowRequest} from '@/lib/client-workflows';
import {Card,CardHeader,CardTitle,CardContent} from '@/ui/card';
interface ReviewRecord {id:string;reviewerType:string;userName?:string;createdAt:string;tenantPart?:Record<string,string>;ownerPart?:Record<string,string>}
export default function ReviewHistory({propertyId}:{propertyId:string}) {
  const {user}=useAuth();const query=useQuery({queryKey:['reviews',propertyId,user?.uid],enabled:!!user&&!!propertyId,queryFn:()=>workflowRequest<{reviews:ReviewRecord[]}>(`reviews?propertyId=${encodeURIComponent(propertyId)}`)});
  return <Card className="mt-6"><CardHeader><CardTitle>Review history</CardTitle></CardHeader><CardContent className="space-y-4">{query.isLoading&&<p>Loading reviews…</p>}{query.error&&<p role="alert">{query.error.message}</p>}{!query.isLoading&&!query.error&&!query.data?.reviews?.length&&<p>No reviews yet.</p>}{query.data?.reviews?.map(review=><article key={review.id} className="border rounded p-4 break-words"><h3>{review.reviewerType==='tenant'?'Tenant reviewing owner':'Owner reviewing tenant'} · {new Date(review.createdAt).toLocaleDateString('en-IN')}</h3><dl>{Object.entries(review.reviewerType==='tenant'?review.tenantPart||{}:review.ownerPart||{}).filter(([,value])=>value).map(([key,value])=><div key={key}><dt className="inline capitalize">{key.replace(/([A-Z])/g,' $1')}: </dt><dd className="inline">{value}</dd></div>)}</dl></article>)}</CardContent></Card>;
}
