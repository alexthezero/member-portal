# Member Portal

A responsive multi-user member portal using Supabase Authentication and GitHub Pages.

## Included

- Email/password registration
- Email confirmation support
- Login persistence
- Password reset flow
- Protected signed-in dashboard
- Logout
- Responsive mobile design

## Publish with GitHub Pages

1. Open this repository on GitHub.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select the `main` branch and `/ (root)` folder.
5. Click **Save**.

The expected site URL is:

`https://alexthezero.github.io/member-portal/`

## Supabase URL configuration

In Supabase, open **Authentication → URL Configuration** and set:

- Site URL: `https://alexthezero.github.io/member-portal/`
- Redirect URL: `https://alexthezero.github.io/member-portal/`

Keep the Supabase service-role/secret key private. The publishable key in `app.js` is intended for frontend use.
