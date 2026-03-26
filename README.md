# GP_EIS_MathPlay

GP EIS Online Learning app for Level A, Level B, and Level C lesson activities.

## Project Structure

- `index.html`
  Main app entry point for student, teacher, and parent access.

- `levels/`
  Lesson activity pages for Level A, Level B, and Level C from Week 1 to Week 4.

- `shared/js/`
  Shared app logic for navigation, tracing, mic-click flow, progress tracking, and auth sync.

- `teacher/`, `parent/`, `admin/`
  Portal and dashboard pages for different user roles.

- `netlify/functions/`
  Serverless functions used for secure student login and cloud-backed auth flows.

## Important Deployment Rule

Do not publish this app with simple drag-and-drop Netlify Drop if you need:

- Netlify Functions
- Firebase-backed login
- cross-device teacher, parent, and student access

Use a normal Netlify site deployment with build support and environment variables.

## Files Used For Deployment

- [netlify.toml](./netlify.toml)
- [package.json](./package.json)
- [firestore.rules](./firestore.rules)
- [.env.example](./.env.example)

## If You Already Configured Some Settings Manually

Do not repeat everything blindly. Verify these exact items:

### Netlify

1. The site is deployed as a normal Netlify project, not Netlify Drop.
2. The project root is the publish root.
3. Netlify reads [netlify.toml](./netlify.toml).
4. Netlify Functions are enabled and the `student-login` function appears in the Functions list.
5. Environment variables are saved in the site configuration.

### Firebase

1. Email/Password Authentication is enabled.
2. Firestore Database is active in the same Firebase project used by the app config.
3. Firestore rules have been published from [firestore.rules](./firestore.rules).
4. The Firebase project matches the frontend config in `shared/js/auth-sync-shared.js`.

If you already did these manually, just confirm they match the current codebase.

## Netlify Configuration

Current [netlify.toml](./netlify.toml):

```toml
[build]
  publish = "."

[functions]
  directory = "netlify/functions"
  node_bundler = "esbuild"
```

## Environment Variables

Use [.env.example](./.env.example) as the source.

Preferred option:

- `FIREBASE_SERVICE_ACCOUNT_JSON`

Alternative split variables:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

## Firebase Requirements

Make sure the Firebase project has:

1. `Authentication -> Sign-in method -> Email/Password` enabled
2. Firestore rules published from [firestore.rules](./firestore.rules)

## Local Install

Install dependencies with:

```powershell
npm install
```

## Deploy Flow

1. Install dependencies.
2. Confirm Netlify environment variables are set.
3. Confirm Firebase Authentication is enabled.
4. Publish Firestore rules.
5. Deploy the site through a proper Netlify project deployment.

## Required Runtime Checks After Deploy

Test these in the live deployed URL:

1. Teacher signup
2. Teacher logout
3. Teacher login again
4. Generate student IDs and PINs
5. Student login immediately with the generated credentials
6. Parent signup
7. Parent login
8. Open Month -> Week -> Lesson
9. Complete a lesson and confirm results reach [ProgressReport.html](./ProgressReport.html)

## Known Production Dependency

Teacher, parent, and secure student cloud login depend on:

- Firebase Authentication being reachable
- Firestore being reachable
- Netlify Functions being deployed
- Netlify environment variables being correct

If those runtime services are unavailable, local fallback can still work on the same device, but cross-device login will not.
