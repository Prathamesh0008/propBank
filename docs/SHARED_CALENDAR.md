# Shared PropBank calendar

`src/ui/date-picker.tsx` provides `DatePicker`, the native-Input compatibility adapter `CalendarInput`, and `DateRangePicker`. `src/ui/date-time-picker.tsx` composes date selection with the existing scheduling TimePicker. All use `src/ui/calendar.tsx`, the existing react-day-picker 8 keyboard/date-grid behavior, Radix popover focus/dismissal/portal handling, and scoped `calendar.module.css` brand styling. No dependencies added.

## API and date contracts

- Default display: DD-MM-YYYY. Default date value/API/FormData: YYYY-MM-DD.
- Month selection displays MM-YYYY and preserves YYYY-MM.
- `value`/`onChange` are controlled; `defaultValue` is uncontrolled. Named fields submit a hidden canonical value, not formatted display text. The Input adapter retains existing event-shaped callbacks and refs; invalid manual text sets native custom validity rather than emitting a malformed value.
- `min`, `max` are inclusive canonical dates; `disabledDate` accepts a predicate. Existing feature-level constraints and server validation remain authoritative. `required`, disabled, readOnly, labels, descriptions and errors pass through. Calculated agreement dates remain read-only.
- `displayFormat` and `valueFormat` accept date-fns date-only patterns. Native field adapters always retain their existing canonical formats. No automatic timestamp conversion or database format migration occurs.
- Today uses Asia/Kolkata by default; `timeZone` can supply a property-specific IANA zone. `calendar-date.ts` parses date-only components locally and uses no UTC string parsing. Existing visit instant conversion and HH:mm slot rules are unchanged.
- Range fields constrain each other while respecting outer bounds. Partial filter ranges are allowed; completed ranges must be ordered, and the admin feature retains its submission ordering check.
- Date/time composition emits `{date,time}` without inventing a time or converting an instant. The scheduling feature owns timezone conversion and allowed slots.

## Integration inventory

Existing DatePicker consumers automatically receive the new appearance and behavior: Add Property, Edit Property, Add Tenant (agreement and rent schedule), Property Details notice dates, Visit Planner scheduling/rescheduling, and General Inquiry preferred dates.

The shared `Input` adapter covers all remaining dynamic date/month fields: Pre-Leased Sale lease dates and tenant occupancy, Tenant Property intake, Next Agreement calculated dates, Agreement Workflow renewals, Property Hub ledger month and rent due date, and Attach Documents receipt dates. This avoids separate date implementations hidden behind dynamic `type` expressions.

Admin Visits uses DateRangePicker with canonical named From/To fields. Admin Email Deliveries uses DatePicker for its created-date filter. Admin-assisted property forms reuse the same property components.

## Deliberate exceptions

- The native `time` input within the existing specialized TimePicker remains for custom HH:mm entry alongside existing business-slot buttons. It is not a competing date calendar.
- Read-only formatted date text, relative timestamps, numeric payment-due-day/duration controls and calendar icons are unchanged.
- No remaining browser-native date/month/datetime-local picker is rendered by the audited controls; source-level `Input type="date"`/`month` declarations are handled centrally.

## Verification scope

Targeted tests cover strict typing, canonical FormData markup and callback values, date/month rendering, calendar month/year controls, constraints, range ordering, keyboard open/close and focus-return handlers, leap years/month ends and multiple timezone contexts. Existing rent/renewal rules, investment active-lease validation and selected visit creation/rescheduling tests remain in the verification pass.

No Playwright, production access, deployment, schema changes or API/business validation changes. Real-browser touch behavior, visual positioning in every modal and screen-reader interaction remain manual acceptance checks.
