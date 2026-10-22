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

              {isAdmin && (
                <fieldset className="space-y-2">
                  <legend className="mb-2 text-sm font-semibold">Who are you reviewing?</legend>
                  <div className="flex flex-wrap gap-3">
                    {(["owner", "tenant"] as const).map((target) => (
                      <label key={target} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium capitalize ${adminTarget === target ? "border-slate-500 bg-slate-100" : "border-slate-200"}`}>
                        <input type="radio" name="adminTarget" value={target} checked={adminTarget === target} onChange={() => setAdminTarget(target)} className="accent-slate-800" />
                        {target}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}

              <section className={`space-y-5 rounded-lg border p-4 sm:p-6 ${colors.panel}`}>
                <div className="flex items-center gap-3">
                  <span className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ${colors.icon}`}>
                    {isAdmin ? "C" : isOwner ? "B" : "A"}
                  </span>
                  <h2 className={`text-xl font-semibold ${colors.title}`}>
                    {isAdmin ? `Admin Reviewing ${adminTarget === "owner" ? "Owner" : "Tenant"}` : isOwner ? "Reviewing Tenant" : "Reviewing Owner"}
                  </h2>
                </div>
                <p className={`text-sm ${colors.muted}`}>
                  {isAdmin ? "Record your administrative assessment." : isOwner ? "Please share your experience with the tenant." : "Please share your experience with the property owner."}
                </p>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {currentQuestions.map(({ key, label, placeholder }, index) => (
                    <div key={key} className="space-y-2">
                      <Label htmlFor={`review-${key}`} className={`font-medium ${colors.title}`}>{index + 1}. {label}</Label>
                      <Textarea
                        id={`review-${key}`}
                        rows={3}
                        maxLength={2000}
                        placeholder={placeholder}
                        value={currentAnswers[key] || ""}
                        onChange={(event) => setCurrentAnswers((previous) => ({ ...previous, [key]: event.target.value }))}
                        className={`bg-white ${colors.input}`}
                      />
                    </div>
                  ))}
                </div>
                {isAdmin && (
                  <div className="space-y-2">
                    <Label htmlFor="admin-internal-note" className="font-medium text-slate-900">Internal Admin Note (optional)</Label>
                    <Textarea
                      id="admin-internal-note" rows={3} maxLength={4000}
                      placeholder="Internal information for authorized administrators only."
                      value={adminInternalNote} onChange={(event) => setAdminInternalNote(event.target.value)}
                      className="border-slate-300 bg-white"
                    />
                    <p className="text-xs text-slate-600">The backend must restrict this field to administrators and omit it from public review responses.</p>
                  </div>
                )}
              </section>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button type="submit" disabled={submitting} className="flex-1">
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Star className="mr-2 h-4 w-4" />}
                  {submitting ? "Submitting..." : "Submit Review"}
                </Button>
                <Button type="button" variant="outline" disabled={submitting} onClick={() => navigate(-1)}>Cancel</Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
      {user && propertyId && reviewerType && <ReviewHistory propertyId={String(propertyId)} />}
    </div>
  );
}
