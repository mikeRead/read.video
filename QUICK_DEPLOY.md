# Quick Deploy to Cloudflare Pages

## Option 1: Automatic Deployment (Recommended)

1. **Push your code to GitHub**
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Set up Cloudflare Pages**
   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
   - Navigate to **Pages** → **Create a project**
   - Choose **Connect to Git**
   - Select your GitHub repository
   - Build settings:
     - **Build command**: `npm run build`
     - **Build output directory**: `out`
   - Click **Save and Deploy**

3. **Your site will be live at**: `https://read-video.pages.dev`

## Option 2: Manual Deployment with Wrangler

1. **Install Wrangler CLI**
   ```bash
   npm install -g wrangler
   ```

2. **Login to Cloudflare**
   ```bash
   wrangler login
   ```

3. **Deploy**
   ```bash
   npm run deploy
   ```

## Option 3: GitHub Actions (Automatic)

1. **Set up GitHub Secrets**:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`

2. **Push to main branch** - automatic deployment will happen

## Build Locally First

Always test your build locally before deploying:

```bash
npm run build
npx serve out
```

Visit `http://localhost:3000` to verify everything works.

## Troubleshooting

- **Build fails**: Check the build output for errors
- **Deployment fails**: Verify your Cloudflare credentials
- **Site not working**: Check the Cloudflare Pages logs

## Next Steps

- Add custom domain in Cloudflare Pages settings
- Set up environment variables if needed
- Configure build caching for faster deployments
