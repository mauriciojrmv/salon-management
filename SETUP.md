# Setup Guide

## Prerequisites

- **Node.js**: 18.17 or later
- **npm** or **yarn**: Latest version
- **Firebase Account**: For database and authentication

## Step 1: Clone and Install

```bash
# Clone the repository
git clone <your-repo-url>
cd salon-management

# Install dependencies
npm install
```

## Step 2: Firebase Configuration

### Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Create a project"
3. Follow the setup wizard
4. Enable Firestore Database and Authentication

### Get Firebase Credentials

1. In Firebase Console, go to **Project Settings**
2. Scroll to "Your apps" section
3. Click on the web app or create a new one
4. Copy the configuration object

### Setup Environment Variables

Create `.env.local` file in the project root:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

## Step 3: Firestore Setup

### Create Collections

In Firebase Console, create the following Firestore collections:

1. **users**
2. **salons**
3. **sessions**
4. **services**
5. **products**
6. **appointments**
7. **payments**
8. **product_usage_history**

### Firestore Security Rules (Optional)

Add these security rules in Firebase Console:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read, write: if request.auth.uid == uid;
    }
    match /salons/{salonId} {
      allow read, write: if request.auth.uid in resource.data.staffIds;
    }
    match /sessions/{sessionId} {
      allow read, write: if request.auth.uid in resource.data.staffIds;
    }
    match /appointments/{appointmentId} {
      allow read, write: if request.auth.uid in resource.data.staffIds;
    }
    match /services/{serviceId} {
      allow read: if true;
      allow write: if request.auth.uid in get(/databases/$(database)/documents/salons/$(resource.data.salonId)).data.staffIds;
    }
    match /products/{productId} {
      allow read, write: if request.auth.uid in get(/databases/$(database)/documents/salons/$(resource.data.salonId)).data.staffIds;
    }
    match /payments/{paymentId} {
      allow read, write: if request.auth.uid in get(/databases/$(database)/documents/sessions/$(resource.data.sessionId)).data.staffIds;
    }
  }
}
```

## Step 4: Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Step 5: Create Your First Account

1. Click "Sign Up" on the login page
2. Fill in your details (name, email, password)
3. This creates your admin account
4. You're ready to start managing your salon!

## Optional: Enable Authentication Methods

In Firebase Console > Authentication > Sign-in providers:

- [x] Email/Password (already enabled)
- [ ] Google Sign-in (optional)
- [ ] Phone (optional)

## Troubleshooting

### Firebase Connection Issues

```
Error: FIREBASE_API_KEY not found
```

**Solution**: Ensure `.env.local` file has all Firebase credentials

### Module Not Found

```
Error: Cannot find module '@/types/models'
```

**Solution**: Run `npm install` again and restart dev server

### Port 3000 Already in Use

```bash
# Use a different port
npm run dev -- -p 3001
```

## Production Deployment

### Deploy to Vercel

```bash
npm install -g vercel
vercel
```

### Deploy to Other Platforms

1. Build the app: `npm run build`
2. Start production server: `npm start`
3. Deploy the `out` directory to your hosting

## Next Steps

1. **Add Services**: Go to Services page and create your service catalog
2. **Add Staff**: Create staff profiles with their skills and commission rates
3. **Setup Inventory**: Add your products and materials
4. **Configure Business Hours**: Set salon operating hours in settings
5. **Start Using**: Create sessions and appointments

## Documentation

- [Architecture Overview](./docs/architecture.md)
- [API Reference](./docs/api.md)
- [Database Schema](./docs/database.md)
- [Component Library](./docs/components.md)

## Support

For issues and questions:
1. Check the README.md
2. Review error messages in browser console
3. Check Firebase Console for service status
4. Open an issue on GitHub

Happy salons managing! 🎉
