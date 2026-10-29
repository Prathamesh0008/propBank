export type VisitForm = {title: string; description: string; date: string; time: string; propertyId: string};
export type VisitFormErrors = Partial<Record<'title' | 'date' | 'time', string>>;

export function localDateValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function validateVisitForm(form: VisitForm, now = new Date()): VisitFormErrors {
  const errors: VisitFormErrors = {};
  if (!form.title.trim()) errors.title = 'Enter a visit title.';
  const day = new Date(`${form.date}T00:00:00`);
  if (!form.date) errors.date = 'Select a visit date.';
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date) || !Number.isFinite(day.getTime()) || localDateValue(day) !== form.date) errors.date = 'Select a valid visit date.';
  else if (form.date < localDateValue(now)) errors.date = 'Select today or a future date.';
  if (!form.time) errors.time = 'Select a visit time.';
  else if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(form.time)) errors.time = 'Select a valid visit time.';
  if (!errors.date && !errors.time) {
    const scheduled = new Date(`${form.date}T${form.time}`);
    if (!Number.isFinite(scheduled.getTime()) || scheduled.getHours() !== Number(form.time.slice(0, 2)) || scheduled.getMinutes() !== Number(form.time.slice(3))) errors.time = 'Select a valid visit time.';
    else if (scheduled.getTime() <= now.getTime()) errors.time = 'Select a future visit time.';
  }
  return errors;
}
