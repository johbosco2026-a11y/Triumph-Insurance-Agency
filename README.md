# Triumph Insurance Agency

This repository contains the production web bundle for Triumph Insurance Agency, prepared for deployment from GitHub through Vercel.

The site is a client-rendered single-page application. Vercel serves the local HTML, CSS, JavaScript, manifest, and hero image, while `vercel.json` keeps the existing quote, account, claims, and document API/storage paths reachable through the original backend during this hosting transition. A future backend migration should replace those proxy rewrites with first-party Vercel-compatible server endpoints and storage.

## Deployment

The production branch is `main`. Vercel should be connected to `johbosco2026-a11y/Triumph-Insurance-Agency` with the project root at `/` and no build command required. The final deployment URL should be used for the canonical URL and any custom domain configuration.

## Important application disclosure

Quote requests are reviewed by Triumph before an applicable insurer quotation is provided. The website does not present an instant premium or bind a policy automatically.
