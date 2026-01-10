# SwipeStreet

Mobile app that transforms institutional research into tweet-sized learning cards.

## Architecture

```
swipestreet/
├── backend/          # FastAPI server
├── content/          # Card generation pipeline
├── data/             # Raw Bernstein research data
└── mobile/           # React Native iOS app (Expo)
```

## Quick Start

### 1. Generate Cards

```bash
cd content
pip install -r requirements.txt
python card_generator.py
```

This creates `content/cards/cards.json` with ~167 learning cards.

### 2. Start Backend

```bash
cd backend
pip install -r requirements.txt
python main.py
```

API runs at `http://localhost:8000`

### 3. Run Mobile App

```bash
cd mobile
npm install
npx expo start
```

Press `i` for iOS simulator or scan QR with Expo Go.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/register` | POST | Register device |
| `/api/feed` | GET | Get card feed |
| `/api/feed/categories` | GET | List categories |
| `/api/progress` | POST | Mark card seen/saved |
| `/api/saved` | GET | Get saved cards |
| `/api/sync/cards` | GET | Sync all cards for offline |
| `/api/subscription/status` | GET | Check subscription |

## Card Types

- **insight** - Key analytical insight
- **prediction** - Forward-looking statement
- **contrarian** - Against-consensus view
- **number** - Key statistic or metric
- **thesis** - Investment thesis summary

## Categories

- AI/Technology
- Automotive
- China
- Clean Energy
- Electric Vehicles
- Energy/Oil
- Europe
- Food/Beverage
- Healthcare/Pharma
- Luxury/Consumer

## Offline Mode

Cards are automatically cached for offline learning. The app works fully offline after initial sync.

## Subscription (RevenueCat)

1. Create RevenueCat account
2. Add iOS/Android app
3. Create "pro" entitlement
4. Add API keys to `mobile/src/services/subscription.ts`

## Building for iOS

```bash
cd mobile
npx expo prebuild
npx expo run:ios
```

Or use EAS Build:

```bash
eas build --platform ios
```

## Data Source

Content sourced from Bernstein Research Blackbooks covering:
- 1000+ research reports
- 17 themes
- 10+ years of data

## License

Private - All rights reserved
