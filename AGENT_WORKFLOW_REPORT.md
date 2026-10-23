# Agent Workflow Report

Date: 2026-10-23  
Branch: `feature/property-management-improvements`

## Implemented

### Registration and role security

- Added an account-type selector to the existing Create Account form:
  - **Individual** — persisted role `individual`.
  - **Real Estate Agent** — persisted role `agent`.
- The selector is available only in registration mode and works with initial email/password or Google registration.
- Existing profiles keep their persisted role during Google sign-in, account linking, login and repeated profile synchronization.
- Public registration still rejects `admin`.
- Verified-email and active-profile gates remain authoritative before protected access.
- Agent registration queues the existing welcome event plus an idempotent agent-registration event for the agent and configured administrator.

### Agent listings

- Agents use the existing Add Property form and provide the registered legal owner's email.
- The server resolves the owner through Firebase Auth and the active Firestore profile. Browser-supplied owner UIDs are not trusted.
- The owner and submitting agent are stored separately:
  - `ownerUID` remains the legal owner.
  - `submittedByUID` and `submittingAgentUID` identify the agent.
- Agent listings start at `pending_review`.
- Agents can view and edit listing content for their own submissions and resubmit rejected/change-requested listings.
- Agent permissions do not extend to tenancy, ownership or unrelated property operations.
- Moderation decisions remain admin-only.
- Public listing responses no longer include owner UID/name and never include submitting-agent identity or contact information.

### Enquiries and negotiations

- Existing public enquiry CTAs continue to create admin-managed property enquiries.
- Agents receive enquiry contact details only after explicit administrator assignment through the existing broker inbox.
- Approved agent-supplied listings automatically associate their submitting agent with a negotiation, allowing authorized deal tracking without granting owner authority.
- Existing owner approval and customer final-acceptance requirements remain unchanged.
- Admin remains responsible for completing a deal.

### Commission ledger

- Added one commission record per completed negotiation.
- Only completed deals for agent-supplied properties are eligible.
- Admin can:
  - Record total agreed commission.
  - Allocate agent share as a percentage or fixed amount.
  - Edit an allocation with optimistic version checks.
  - Record partial or final payments.
- Calculations use integer paise. No percentage is hardcoded.
- PropBank share, paid amount, outstanding amount and payment status are derived consistently.
- Duplicate negotiation commission records are rejected.
- Allocation/payment history records actor UID, timestamp and exact paise values.
- Agents can view only commission records linked to their UID and cannot mutate them.
- Allocation and payment changes queue transactional email records for the agent and administrator; delivery failure does not reverse the committed ledger operation.
- No payment transfer or gateway integration was added.

### Dashboards

- Added **Commissions** to the existing Admin Portal.
- Added the scoped commission view to the existing Manage Property/agent workspace.
- Existing agent directory, moderation, assigned enquiries and negotiation interfaces were reused.

## Files changed for this workflow

- `src/features/auth/GoogleAuth.tsx`
- `src/features/auth/AuthAccount.module.css`
- `src/features/properties/AddPropertyForm.tsx`
- `src/features/properties/ManageProperty.tsx`
- `src/features/admin/AdminPortal.tsx`
- `src/features/admin/AdminAgentsTab.tsx`
- `src/features/commissions/CommissionWorkspace.tsx`
- `src/features/commissions/CommissionWorkspace.module.css`
- `src/app/api/commissions/route.ts`
- `src/app/api/commissions/[id]/route.ts`
- `src/lib/server/firestore.ts`
- `src/lib/server/services/users.ts`
- `src/lib/server/services/properties.ts`
- `src/lib/server/services/contracts.ts`
- `src/lib/server/services/negotiations.ts`
- `src/lib/server/services/commissions.ts`
- `tests/fixtures/native-server.cjs`
- `tests/listing-approval.test.cjs`
- `tests/agent-workflow.test.cjs`

## Verification

| Check | Result |
|---|---|
| `npm run typecheck` | **PASS** |
| Focused Node tests | **PASS — 56 passed, 0 failed, 0 skipped** |
| New agent workflow tests | **PASS — 3 passed, 0 failed, 0 skipped** |
| `git diff --check` for changed workflow files | **PASS** |
| Playwright/browser E2E | **NOT RUN** per instruction |
| Production build/full suite | **NOT RUN** per instruction |
| Real emails/Firebase data | **NOT USED** |

Focused coverage includes initial agent registration, admin rejection, Google/persisted-role preservation, verified-email enforcement, separate legal-owner resolution, pending visibility, agent edit boundaries, admin moderation, public privacy, negotiation association, owner/customer approval regressions, admin-managed enquiry isolation, exact commission calculations, duplicate prevention, role isolation, payment history, stale-write rejection and notification recipients.

## Remaining live verification

- Manually verify the registration selector and commission table layout at supported responsive widths.
- Confirm Firebase Google and email/password providers in the intended deployed Auth project.
- Confirm deployed Firestore rules deny direct browser access to `commissions`; all implemented access is through authenticated server routes. No local Firestore rules file was found to verify or deploy.
- Confirm deployment credentials can query the new `commissions` collection. The current queries use single-field `agentUID` filtering and do not require a custom composite index.
- Perform controlled email delivery testing only with separately approved test recipients.
- No deployment, production data mutation or real email was performed.

