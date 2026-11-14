# Admin login final fix — Digital Mitra Agency

Date: 5 November 2026 (Asia/Calcutta).

This was a local implementation and real-browser reproduction, not an audit-only exercise. No production access/deployment or Git staging/commit/push occurred.

## Actual root cause

The running LAN page reproduced a native GET form submission before React's onSubmit handler was attached. The server-rendered login form had no method/action attributes and its inputs/button were already interactive. The browser therefore used the default GET method and serialized named email/password fields into the URL. The normal async error/success code never ran in that path.

The reproduction used a deliberately invalid fixture password, and browser interception blocked the unsafe GET before sending it to the server. No real password was used or captured.

Separately, the running frontend configuration lacked DEV_ALLOWED_ORIGINS for 10.184.142.31. LAN HMR socket errors were reproduced. Adding the exact development hostname and reloading Next configuration restored HMR frames and hydration. This is separate from bcrypt, database lookup and authentication authorization.

The API client also lacked a request timeout, status-aware login error handling and validation of malformed successful responses. These gaps made failures less useful and could leave a pending submission indefinitely.

## Implementation

- Login uses an explicit POST action and stays disabled until hydration attaches the handler.
- Preparing secure sign-in and a no-JavaScript explanation replace silent non-interactivity.
- A synchronous submission ref plus disabled inputs/button prevent duplicate requests.
- Credentials are sent only as same-origin JSON POST, with CSRF and cookies preserved.
- The client has a 15-second default abort deadline, controlled connection errors, CSRF-response validation and rejection of malformed success responses.
- Login verifies expected account fields before setting the one-use success-display flag and navigating to /admin.
- Required text is now exact:
  - Email or password is incorrect.
  - Login successful! Welcome to Digital Mitra Agency.
  - Unable to connect to the server. Please try again.
- The official email is prefilled after reload. Passwords are intentionally cleared and never persisted by the application.
- Login ignores URL credentials and replaces legacy query/hash state with the clean /admin/login path after hydration. This does not erase previously recorded browser history or external logs.
- Recovery forms received the same POST/hydration/submission safeguards. Their saved-password confirmation and Go to Login action remain unchanged.
- Account-settings password forms also use explicit POST fallbacks and hydration guards. Without JavaScript the data-loaded Settings screen exposes no password forms.
- DEV_ALLOWED_ORIGINS=10.184.142.31 was added only to the ignored local frontend environment. The development allowlist is empty during a production build. No wildcard CORS, cookie weakening or trust-proxy change was made.

Branding, supplied existing logo assets, CMS features and existing database records were preserved.

## Actual local account and API

Read-only inspection verified the loopback database tech_solution_agency, one administrator, one official-email administrator at digitalmitra@786gmail.com and a bcrypt cost-12 hash.

No duplicate account was created, no email migration was necessary, and the real password/hash was not changed. Backend authentication code was not modified for this fix.

The actual running API received POST application/json through both frontend origins and returned HTTP 401 for the intentionally invalid password. The UI displayed the exact invalid-credential message. This confirms the real form handler, frontend proxy, CSRF exchange, backend route and invalid-credential response are connected.

The current real password is not available to the agent. It was not guessed, extracted from browser storage or replaced to manufacture a successful test. The earlier user confirmation of real password rotation/dashboard access remains historical user-confirmed evidence, not a new agent-executed valid login after this fix.

## Executed browser results

| Target/check | Result |
| --- | --- |
| localhost:3000 actual invalid login | JSON POST observed; HTTP 401; exact visible error; no credentials in URL |
| 10.184.142.31:3000 actual invalid login | JSON POST observed; HTTP 401; exact visible error; no credentials in URL |
| Both actual origins, simulated network failure | Exact visible connection message |
| Both actual origins, duplicate submit/loading | One intercepted request; loading state and disabled controls verified |
| Both actual origins, reload | Official email prefilled; password empty |
| Both actual origins, JS disabled/assets blocked | POST form, disabled password/button; no native GET credential leak |
| Both actual origins, HMR | Received WebSocket frames; no socket/runtime errors in regression |
| Actual localhost:3000 Forgot Password UI | HTTP 200; exact reset-link-sent notification after provider acceptance; real password unchanged |
| Isolated localhost/LAN valid login | Official-email fixture authenticated, dashboard opened, session survived refresh |
| Isolated reset flow | Link opened, new password saved, exact success displayed, Go to Login worked, old password rejected, new password opened dashboard |
| Existing CMS/browser checks | CRUD, uploads, settings, activity, publishing, navigation and logout passed |

A fresh real reset email was accepted through the actual localhost UI. Fresh inbox receipt was not independently observed in this task; earlier inbox receipt was confirmed by the user. Completing the real-account reset was deliberately not performed because it would replace the user's current password.

## Tests and build

- npm test: 37/37 backend tests and 12/12 frontend tests passed.
- npm run typecheck -w frontend -- --incremental false: passed.
- node scripts/final-audit.mjs: passed, including isolated authentication/reset/CMS browser checks and a production build.
- Focused AUDIT_CHECKS=modules rerun: passed, including account-password form POST/no-JavaScript regression.
- node scripts/admin-login-regression.mjs against the actual port-3000 localhost and LAN pages: passed.
- 31 public-route/SEO checks: passed.
- Production-mode local performance: desktop LCP 1004 ms, mobile LCP 524 ms, CLS 0; synthetic local results only.
- git diff --check and script syntax checks: passed.

The backend tests use isolated MongoDB. The full browser harness uses a separate disposable database and restores generated TypeScript configuration after teardown. Actual-server regression uses deliberately invalid login input and intercepted failure cases, not a guessed valid password. No existing database record was deleted.

## Exact files changed in this task

- frontend/src/components/Login.tsx
- frontend/src/components/LoginSuccessNotice.tsx
- frontend/src/components/PasswordRecovery.tsx
- frontend/src/components/AccountSettings.tsx
- frontend/src/lib/client-api.ts
- frontend/next.config.ts
- frontend/.env.local — ignored local file; exact LAN development allowlist only
- frontend/tests/client-api.test.ts — new
- scripts/admin-login-regression.mjs — new
- scripts/final-audit.mjs
- scripts/admin-modules-browser-check.mjs
- docs/ADMIN_LOGIN_FINAL_FIX.md — new

## Remaining verification limits

A new agent-executed successful login using the real account's current password remains unverified because that password is not available; it was not requested again. Actual invalid-login/network/hydration/HMR behavior was verified on the user's running localhost/LAN servers, and valid-login/reset/dashboard behavior was verified in isolated real browsers.

No hosting provider, production database or deployment has been selected or authorized. Previously documented production/banner/dependency follow-ups are unchanged by this focused login fix.

