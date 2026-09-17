# Phase 3 E2E Test Plan

The application now exposes the workflows required for end-to-end testing. Install Playwright in the development environment before running these tests:

```bash
npm i -D @playwright/test
npx playwright install
```

## Critical flows

1. Signup → dashboard → workspace creation.
2. Login → protected dashboard.
3. Create customer → customer appears in customer list.
4. Create insurance request → request appears in queue.
5. Manager assigns request → assigned agent receives notification.
6. Agent changes request status → assigned/manager notification is created.
7. Manager approves/rejects request → non-manager receives HTTP 403.
8. Add internal note → note appears on request.
9. Manager invites member → invitation token is created.
10. Invited user accepts invitation → membership is created.
11. Manager changes member role → audit log entry is created.
12. Reports reflect persisted request data.
13. Organization A cannot read Organization B request/customer data.
14. Logout → protected dashboard redirects to login.

## Security assertions

Every protected API test must assert the HTTP status and verify the server-side authorization decision. UI-only hiding is not considered authorization.
