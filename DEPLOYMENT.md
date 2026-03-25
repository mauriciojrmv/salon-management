# Deployment Guide

## Overview

This guide covers deploying the Salon Management System to production.

## Pre-Deployment Checklist

- [ ] All environment variables configured
- [ ] Firebase project set up and tested
- [ ] Security rules implemented
- [ ] Database indexed for performance
- [ ] Tests passing locally
- [ ] No console errors or warnings

## Deployment Platforms

### 1. Vercel (Recommended)

Vercel is optimized for Next.js and offers seamless deployment.

#### Setup

```bash
npm install -g vercel
vercel login
vercel
```

#### Configure Environment Variables

1. After initial deployment, go to Vercel Dashboard
2. Select your project
3. Go to Settings > Environment Variables
4. Add all `.env.local` variables:
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`

#### Deploy

```bash
# Deploy to production
vercel --prod
```

### 2. Self-Hosted (VPS/Dedicated Server)

#### Requirements

- Node.js 18+
- npm or yarn
- Process manager (PM2 recommended)
- Reverse proxy (nginx recommended)

#### Deployment Steps

```bash
# 1. SSH into your server
ssh user@your-server.com

# 2. Clone repository
git clone <repo-url>
cd salon-management

# 3. Install dependencies
npm install --production

# 4. Build application
npm run build

# 5. Install PM2 globally
npm install -g pm2

# 6. Create PM2 ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'salon-management',
    script: 'npm start',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
EOF

# 7. Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

#### Nginx Configuration

Create `/etc/nginx/sites-available/salon-management`:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    # SSL certificates
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # Proxy to Next.js
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/salon-management /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 3. Docker Deployment

Create `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  salon-app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_FIREBASE_API_KEY=${NEXT_PUBLIC_FIREBASE_API_KEY}
      - NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}
      - NEXT_PUBLIC_FIREBASE_PROJECT_ID=${NEXT_PUBLIC_FIREBASE_PROJECT_ID}
      - NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=${NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}
      - NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=${NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID}
      - NEXT_PUBLIC_FIREBASE_APP_ID=${NEXT_PUBLIC_FIREBASE_APP_ID}
    restart: always
```

Deploy with Docker:

```bash
docker-compose up -d
```

## Performance Optimization

### Enable Caching Headers

```bash
# In next.config.js
async headers() {
  return [
    {
      source: '/static/:path*',
      headers: [
        { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }
      ]
    }
  ]
}
```

### Database Indexing

In Firebase Console > Firestore > Indexes, create indexes for:
- `sessions` on `salonId` and `date`
- `appointments` on `salonId` and `appointmentDate`
- `products` on `salonId` and `isActive`

### CDN Setup

For Vercel: Automatic CDN included
For self-hosted: Use Cloudflare or similar CDN

## Monitoring

### Error Tracking

```bash
npm install @sentry/nextjs
```

Configure in `next.config.js`:

```javascript
const withSentryConfig = require("@sentry/nextjs")(nextConfig, {
  org: "your-org",
  project: "salon-management",
});

module.exports = withSentryConfig(nextConfig);
```

### Analytics

Add Google Analytics in `app/layout.tsx`:

```typescript
import Script from 'next/script';

export default function RootLayout({ children }) {
  return (
    <html>
      <head>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=GA_ID"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'GA_ID');
          `}
        </Script>
      </head>
      <body>{children}</body>
    </html>
  );
}
```

## Security Checklist

- [ ] HTTPS enabled
- [ ] Firebase security rules configured
- [ ] Environment variables secured
- [ ] Rate limiting enabled
- [ ] CORS properly configured
- [ ] Input validation on all forms
- [ ] Regular backups scheduled
- [ ] Monitor error logs

## Scaling

For high traffic:

1. **Database**: Firebase auto-scales
2. **API**: Add database indexes
3. **Frontend**: Enable caching, use CDN
4. **Monitoring**: Set up alerts for quota usage

## Rollback

Vercel:
```bash
vercel rollback
```

Self-hosted with PM2:
```bash
cd salon-management
git revert <commit-hash>
npm run build
pm2 restart all
```

## Support & Issues

- Monitor Firebase quota usage
- Check deployment logs
- Review application performance metrics
- Set up uptime monitoring

---

*Happy deploying! 🚀*
