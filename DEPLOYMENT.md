# Deploying to Cloudflare Pages

This project is configured for deployment to Cloudflare Pages with automatic builds and deployments.

## Prerequisites

1. **Cloudflare Account**: You need a Cloudflare account
2. **GitHub Repository**: Your code should be in a GitHub repository
3. **Node.js 18+**: For local development and building

## Automatic Deployment (Recommended)

### 1. Set up Cloudflare Pages

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **Pages** → **Create a project**
3. Choose **Connect to Git**
4. Select your GitHub repository
5. Configure build settings:
   - **Build command**: `npm run build`
   - **Build output directory**: `out`
   - **Root directory**: `/` (leave empty)

### 2. Set up GitHub Secrets

In your GitHub repository, go to **Settings** → **Secrets and variables** → **Actions** and add:

- `CLOUDFLARE_API_TOKEN`: Your Cloudflare API token
- `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare account ID

#### Getting Cloudflare API Token:

1. Go to [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. Click **Create Token**
3. Use **Custom token** template
4. Add permissions:
   - **Zone**: **Zone:Read** (for all zones)
   - **Account**: **Account:Read** (for all accounts)
   - **User**: **User:Read** (for all users)
   - **Cloudflare Pages**: **Pages:Edit** (for all accounts)

#### Getting Account ID:

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Look at the right sidebar - your Account ID is displayed there

### 3. Deploy

1. Push your code to the `main` branch
2. GitHub Actions will automatically build and deploy to Cloudflare Pages
3. Your site will be available at `https://read-video.pages.dev` (or your custom domain)

## Manual Deployment

### 1. Build Locally

```bash
npm install
npm run build
```

### 2. Deploy with Wrangler

```bash
npm install -g wrangler
wrangler pages deploy out
```

## Custom Domain

1. In Cloudflare Pages, go to your project
2. Click **Custom domains**
3. Add your domain
4. Update DNS records as instructed

## Environment Variables

If you need environment variables:

1. In Cloudflare Pages, go to your project
2. Click **Settings** → **Environment variables**
3. Add your variables

## Troubleshooting

### Build Issues

- Ensure Node.js 18+ is used
- Check that all dependencies are in `package.json`
- Verify the build command works locally

### Deployment Issues

- Check GitHub Actions logs for build errors
- Verify Cloudflare API token has correct permissions
- Ensure account ID is correct

### Performance

- The site is statically generated for optimal performance
- Three.js assets are optimized during build
- Consider using Cloudflare's CDN for global distribution

## Local Testing

Test the production build locally:

```bash
npm run build
npx serve out
```

Visit `http://localhost:3000` to verify everything works correctly.
