  const role = typeof claims.role === "string" ? claims.role.toLowerCase() : "";
  if (claims.admin === true || role === "admin") return "admin";
  if (property.ownerUID === uid) return "owner";

  const isTenant = property.tenantUID === uid || property.tenantUid === uid ||
    property.tenantId === uid || property.tenantUIDs?.includes(uid) ||
    property.tenants?.some((tenant) => tenant.uid === uid || tenant.userUID === uid);
  if (isTenant) return "tenant";

  // Never infer tenant privileges simply because a person is not the owner.
  return null;
};

export default function Review() {
  const { propertyId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [property, setProperty] = useState<Property | null>(null);
  const [reviewerType, setReviewerType] = useState<ReviewerType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [tenantPart, setTenantPart] = useState<ReviewAnswers>(() => makeEmpty(tenantQuestions));
  const [ownerPart, setOwnerPart] = useState<ReviewAnswers>(() => makeEmpty(ownerQuestions));
  const [adminPart, setAdminPart] = useState<ReviewAnswers>(() => makeEmpty(adminQuestions));
  const [adminTarget, setAdminTarget] = useState<AdminTarget>("owner");
  const [adminInternalNote, setAdminInternalNote] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
      if (!currentUser) navigate("/auth");
    });
    return unsubscribe;
  }, [navigate]);

  useEffect(() => {
    if (!authReady) return;
    if (!user) { setLoading(false); return; }
    if (!propertyId) { setError("Missing property ID."); setLoading(false); return; }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      setReviewerType(null);
      setProperty(null);
      try {
        const [token, response] = await Promise.all([
          user.getIdTokenResult(),
          apiFetch(`${API_BASE_URL}/properties/${String(propertyId)}`),
        ]);
        if (!response.ok) throw new Error("Could not load this property.");
        const data = await response.json();
        if (!data.success || !data.property) throw new Error(data.message || "Property not found.");
        const nextProperty: Property = data.property;
        const role = resolveRole(token.claims, nextProperty, user.uid);
        if (!cancelled) {
          setProperty(nextProperty);
          setReviewerType(role);
          if (!role) setError("You are not authorized to submit a review for this property.");
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load review details.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [authReady, propertyId, user]);

  const showError = useCallback((description: string) => {
    toast({ title: "Unable to Submit Review", description, variant: "destructive" });
  }, [toast]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || !propertyId || !reviewerType || submitting) return;

    const answers = reviewerType === "admin" ? adminPart : reviewerType === "owner" ? ownerPart : tenantPart;
    if (!Object.values(answers).some((answer) => answer.trim())) {
      showError("Please provide at least one review response.");
      return;
    }

    setSubmitting(true);
    try {
      // Owner/tenant submissions retain their original request fields.
      // Admin fields require corresponding support in POST /reviews and the review model.
      const body: Record<string, unknown> = {
        propertyId: String(propertyId), reviewerType,
        tenantPart: reviewerType === "tenant" ? tenantPart : makeEmpty(tenantQuestions),
        ownerPart: reviewerType === "owner" ? ownerPart : makeEmpty(ownerQuestions),
      };
      if (reviewerType === "admin") {
        body.adminPart = adminPart;
        body.reviewTarget = adminTarget;
        body.adminInternalNote = adminInternalNote.trim();
      }

      const response = await apiFetch(`${API_BASE_URL}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-ID": user.uid },
        body: JSON.stringify(body),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) throw new Error(result.message || "Failed to submit review.");

      toast({ title: "Review Submitted", description: "Your review has been submitted successfully." });
      navigate("/manage-property");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Please try again later.");
    } finally {
      setSubmitting(false);
    }
  };

  const currentQuestions = reviewerType === "admin" ? adminQuestions : reviewerType === "owner" ? ownerQuestions : tenantQuestions;
  const currentAnswers = reviewerType === "admin" ? adminPart : reviewerType === "owner" ? ownerPart : tenantPart;
  const setCurrentAnswers = reviewerType === "admin" ? setAdminPart : reviewerType === "owner" ? setOwnerPart : setTenantPart;
  const isOwner = reviewerType === "owner";
  const isAdmin = reviewerType === "admin";
  const accent = isOwner ? "orange" : isAdmin ? "slate" : "blue";
  const colors = {
    orange: { panel: "border-orange-100 bg-orange-50/30", title: "text-orange-900", muted: "text-orange-700", icon: "bg-orange-100 text-orange-700", input: "border-orange-200 focus-visible:ring-orange-500" },
    blue: { panel: "border-blue-100 bg-blue-50/30", title: "text-blue-900", muted: "text-blue-700", icon: "bg-blue-100 text-blue-700", input: "border-blue-200 focus-visible:ring-blue-500" },
    slate: { panel: "border-slate-200 bg-slate-50/60", title: "text-slate-900", muted: "text-slate-600", icon: "bg-slate-200 text-slate-700", input: "border-slate-300 focus-visible:ring-slate-500" },
  }[accent];

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <Button type="button" variant="ghost" onClick={() => navigate(-1)} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back
      </Button>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl"><Star className="h-5 w-5" /> Submit Review</CardTitle>
          <CardDescription>{property ? `Property: ${property.title || property.id || propertyId}` : "Property review"}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex min-h-64 items-center justify-center" role="status">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" /><span className="sr-only">Loading review form</span>
            </div>
          ) : error || !reviewerType ? (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error || "You are not authorized to review this property."}
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="space-y-2">
                <Label>Submitting review as</Label>
                <div className="w-full rounded-md border bg-gray-50 px-4 py-3 font-semibold capitalize text-gray-800 md:w-1/3">
                  {reviewerType}
                </div>
              </div>