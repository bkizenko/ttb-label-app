# Vercel deployment diagnosis

If the deployed app does not reflect recent commits (e.g. old UI like the removed "breathing" animation still appears) even though the Vercel dashboard shows successful builds, use this checklist.

## 1. Branch

- In Vercel: **Project → Settings → Git**, confirm **Production Branch** is the one you push to for releases (usually `main`).
- If it is set to another branch (e.g. `refactor/component-architecture`), switch it to `main` and redeploy so production serves the correct code.

## 2. Build cache

- In Vercel: **Deployments → select latest deployment → View Build Logs**.
- Check whether the build is using a cached copy of the repo or build output. If so, the deploy may be reusing old artifacts.
- **Fix**: In **Project → Settings → General**, use **Redeploy** with **Clear cache and redeploy** (or the equivalent option in the Deployments tab). Then trigger a new deploy from the correct branch.

## 3. Next.js and CDN cache

- This repo’s `next.config.ts` does not set long-lived cache headers or custom revalidation. The root page is a client-rendered app, so stale HTML is less likely than with static ISR.
- If you still see stale content after fixing branch and clearing build cache, consider:
  - In **Vercel → Project → Settings → Functions** (or Edge), ensure no long cache for the app.
  - Optionally add a short `revalidate` for the homepage in the app route if you ever pre-render it (not required for the current SPA-style flow).

## Summary

1. Set **Production Branch** to `main` (or your release branch).
2. Run **Clear cache and redeploy** once.
3. Only if the issue persists, review Vercel’s edge/cache settings or add revalidation; no paid tier is required for these steps.
