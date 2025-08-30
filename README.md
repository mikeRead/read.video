# READ.VIDEO Landing Page

A modern, interactive space-themed landing page built with Next.js, Three.js, and TypeScript.

## Features

- **Countdown Animation**: READ.VIDE[3,2,1,O] countdown with blinking period
- **Dynamic Space Scene**: Randomly generated stars, planets, and rings using Three.js
- **Camera Movement**: Smooth camera rotation and movement through space
- **Typing Effect**: Email address typing animation with click-to-copy functionality
- **Random Messages**: Fun random messages after email copy
- **Responsive Design**: Works on all device sizes

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **3D Graphics**: Three.js for space scene rendering
- **Styling**: Tailwind CSS for responsive design
- **Language**: TypeScript for type safety
- **Deployment**: Optimized for Cloudflare Pages

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Export static files
npm run export
```

## Deployment

### Cloudflare Pages

1. **Build the project**:
   ```bash
   npm run build
   ```

2. **Deploy to Cloudflare Pages**:
   - Connect your Git repository
   - Set build command: `npm run build`
   - Set output directory: `out`
   - Deploy

### AWS S3 (Alternative)

1. **Build and export**:
   ```bash
   npm run build
   npm run export
   ```

2. **Upload to S3**:
   - Create S3 bucket with public read access
   - Enable static website hosting
   - Upload contents of `out` folder

## Project Structure

```
src/
├── app/
│   ├── page.tsx          # Main landing page
│   ├── layout.tsx        # Root layout
│   └── globals.css       # Global styles
└── components/
    ├── Countdown.tsx     # Countdown component
    └── TypingText.tsx    # Typing text component
```

## Customization

- **Stars**: Modify star count in `SpaceScene` component
- **Planets**: Adjust planet generation parameters
- **Colors**: Change color schemes in CSS and Three.js materials
- **Timing**: Adjust animation speeds and delays
- **Messages**: Add/remove random messages in `TypingText` component

## Performance

- Optimized Three.js rendering
- Efficient star and planet generation
- Smooth animations with requestAnimationFrame
- Responsive design with Tailwind CSS

## Browser Support

- Modern browsers with WebGL support
- Mobile devices with touch interaction
- Progressive enhancement for older browsers
