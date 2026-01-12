# SwipeStreet

Bite-sized investing lessons delivered through a swipe-based mobile app.

## Architecture

```
swipestreet/
├── backend/          # Express.js API server
├── mobile/           # React Native (Expo) iOS/Android app
└── .github/          # CI/CD workflows
```

## Quick Start

### 1. Start Backend

```bash
cd backend
npm install
cp .env.example .env  # Configure environment variables
npm run dev
```

API runs at `http://localhost:3001`

Required environment variables:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_KEY` - Supabase service role key
- `ANTHROPIC_API_KEY` - Claude API key for chat
- `STRIPE_SECRET_KEY` - Stripe secret key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret
- `JWT_SECRET` - Secret for JWT tokens

### 2. Run Mobile App

```bash
cd mobile
npm install
npx expo start
```

Press `i` for iOS simulator, `a` for Android emulator, or scan QR with Expo Go.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/register` | POST | Register device |
| `/api/auth/me` | GET | Get user profile |
| `/api/cards/feed` | GET | Get personalized card feed |
| `/api/cards/meta/categories` | GET | List categories |
| `/api/cards/action` | POST | Record card action (seen/saved/liked/disliked) |
| `/api/cards/user/saved` | GET | Get saved cards |
| `/api/cards/sync/all` | GET | Sync all cards for offline |
| `/api/chat/message` | POST | Chat with AI tutor |
| `/api/subscription/status` | GET | Check subscription |
| `/api/subscription/checkout` | POST | Create Stripe checkout |
| `/api/admin/*` | Various | Admin panel endpoints |

## Features

- **Swipe-based learning**: Swipe right for positive signal, left for "show less like this"
- **AI Chat Tutor**: Ask follow-up questions about any card
- **Personalized Feed**: TikTok-style recommendation based on your preferences
- **Analyst Profile**: Filter content by industries and geographies you cover
- **Offline Mode**: Cards cached for offline learning
- **Subscription**: Monthly/yearly plans via Stripe

## Card Types

- **lesson** - Educational content
- **insight** - Key analytical insight
- **pattern** - Market pattern or trend
- **number** - Key statistic or metric
- **thesis** - Investment thesis summary

## Building for Production

### Backend Deployment

Deploy to Railway, Render, or any Node.js hosting:

```bash
cd backend
npm run build  # if using TypeScript
npm start
```

### Mobile App

```bash
cd mobile

# Preview build (internal testing)
eas build --profile preview --platform all

# Production build (app stores)
eas build --profile production --platform all

# Submit to stores
eas submit --platform all
```

### App Store Configuration

**iOS:**
1. Create app in App Store Connect
2. Update `eas.json` with Apple credentials
3. Run `eas submit -p ios`

**Android:**
1. Create app in Google Play Console
2. Generate service account key as `google-play-key.json`
3. Run `eas submit -p android`

## Admin Panel

Access the admin panel at `http://localhost:3001/admin` to:
- View dashboard stats
- Manage content cards
- View users and subscriptions

## License

Private - All rights reserved
