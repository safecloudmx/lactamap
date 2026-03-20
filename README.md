# LactaMap

Full-stack lactation room finder application. Find and contribute to a community-driven map of nursing/lactation spaces.

## Tech Stack

- **Backend**: Node.js + Express.js + Prisma ORM + PostgreSQL
- **Frontend**: React Native (Expo 54) with web support
- **Storage**: AWS S3 (secure, private bucket with signed URLs)
- **Auth**: JWT tokens with role-based access control (VISITOR, CONTRIBUTOR, ADMIN, ELITE)

## Prerequisites

- Node.js LTS (v18+)
- PostgreSQL 12+
- AWS Account (S3 bucket for image storage)

## Setup

### 1. Backend

Navigate to `backend/` and run:

```bash
npm install
npx prisma generate
```

Create a `.env` file with the following variables:

```env
DATABASE_URL=postgresql://user:password@host:port/db_lactamap?sslmode=require
JWT_SECRET=your_jwt_secret_here
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_REGION=us-east-1
S3_BUCKET=lactamap-images-844646862120-us-east-1-an
```

To run the development server:

```bash
npm run dev
```

Server will be available at `http://localhost:3000/api/v1`

### 2. Frontend

Navigate to `frontend/` and run:

```bash
npm install --legacy-peer-deps
```

To start the development server (iOS/Android):

```bash
npm start
```

To run in web browser:

```bash
npm run web
```

Web app will be available at `http://localhost:8081`

## Features

### User Features

- **Authentication**: Sign up, login, and role-based access control
- **User Profile**: Edit profile with profile photo upload to S3
- **Lactario Discovery**: Map view with location-based filtering and search
- **Photo Carousel**: View multiple images with fullscreen lightbox and swipe navigation
- **Reviews & Ratings**: Leave 1-5 star reviews with optional comments
- **Leaderboard**: Compete and earn points through contributions
- **Badges**: Unlock achievement badges (EXPLORER for photos, etc.)
- **Baby Tracking** (Local): Track nursing sessions and baby info (device-only storage)

### Lactario Features

- **Create Lactarios**: Contribute new lactation/nursing rooms to the community
- **Detailed Info**: Address, amenities, access type (Women/Men/Unisex), status (Open/Closed)
- **Image Gallery**: Upload multiple high-quality images (WebP, 1200×800)
- **Amenities**: Track bathroom access, changing table, hygiene supplies
- **Owner Management**: Edit or delete your own lactarios
- **Admin Controls**: Admins can moderate and delete any content

### Technical Features

- **AWS S3 Integration**: Secure image storage with private bucket
- **Pre-signed URLs**: Time-limited S3 URLs (6 hours) prevent direct URL exposure
- **Image Optimization**: Sharp-based resizing and WebP compression
- **Rate Limiting**: Auth endpoints rate-limited (20 req/15 min)
- **CORS Security**: Restricted to known origins
- **Database Normalization**: Review data includes user avatars, amenities as readable strings
- **Responsive Design**: Works on iOS, Android, and web browsers

## Project Structure

```
lactamap/
├── backend/
│   ├── src/
│   │   ├── controllers/       # Request handlers
│   │   ├── routes/            # API endpoints
│   │   ├── services/          # Business logic (gamification, etc.)
│   │   ├── lib/               # Utilities (Prisma, S3)
│   │   └── server.ts          # Express entry point
│   ├── prisma/
│   │   └── schema.prisma      # Database schema
│   └── package.json
└── frontend/
    ├── src/
    │   ├── screens/           # Navigation screens
    │   ├── components/        # Reusable UI components
    │   ├── context/           # Auth and app context
    │   ├── services/          # API client, local storage
    │   ├── theme/             # Centralized styling
    │   └── types/             # TypeScript interfaces
    ├── app.json               # Expo configuration
    └── package.json
```

## Key API Endpoints

### Auth
- `POST /api/v1/auth/register` - Create new account
- `POST /api/v1/auth/login` - Login with email/password

### Lactarios
- `GET /api/v1/lactarios` - List all lactarios (with search/filter)
- `GET /api/v1/lactarios/:id` - Get lactario details with reviews
- `POST /api/v1/lactarios` - Create new lactario (auth required)
- `PUT /api/v1/lactarios/:id` - Update lactario (owner/admin)
- `DELETE /api/v1/lactarios/:id` - Delete lactario (admin only)
- `POST /api/v1/photos/lactario/:id` - Upload lactario image

### Reviews
- `GET /api/v1/reviews/lactario/:id` - Get reviews for lactario
- `POST /api/v1/reviews/lactario/:id` - Leave a review
- `PUT /api/v1/reviews/:id` - Edit your review
- `DELETE /api/v1/reviews/:id` - Delete review (own or admin)

### Users
- `GET /api/v1/users/profile` - Get current user profile
- `PUT /api/v1/users/profile` - Update profile (name, etc.)
- `POST /api/v1/users/avatar` - Upload profile photo
- `GET /api/v1/users/leaderboard` - Get top contributors

## Database Schema

### Core Tables
- **User**: Accounts with roles, points, badges, and profile photo
- **Lactario**: Locations with images, amenities, ratings
- **Review**: 1-5 star ratings with comments
- **Photo**: Image metadata and S3 URLs
- **Badge** / **UserBadge**: Achievement system

### Key Fields
- User: `id`, `email`, `passwordHash`, `role`, `points`, `avatarUrl`, `name`
- Lactario: `id`, `name`, `latitude`, `longitude`, `address`, `amenities`, `imageUrl`, `avgRating`
- Review: `id`, `lactarioId`, `userId`, `rating`, `comment`, `createdAt`, `user` (with avatarUrl)

## Environment Variables

### Backend (.env)

```env
# Database
DATABASE_URL=postgresql://...

# JWT
JWT_SECRET=your_secret_key

# AWS S3
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_REGION=us-east-1
S3_BUCKET=lactamap-images-844646862120-us-east-1-an

# Optional
NODE_ENV=development
PORT=3000
```

### Frontend (.env / .env.local)

```env
# API Base URL (defaults to http://localhost:3000/api/v1)
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000/api/v1
```

## Development Notes

### Image Storage
- Profile photos: `profiles/{userId}_{timestamp}.webp` (400×400, cover crop)
- Lactario photos: `lactarios/{lactarioId}_{timestamp}.webp` (1200×800, inside fit)
- Cambiador photos: `cambiadores/{lactarioId}_{timestamp}.webp` (1200×800, inside fit)
- All images: WebP format @ 85% quality, served via 6-hour signed URLs

### Local Data (Frontend)
- Baby information and nursing sessions stored locally in AsyncStorage
- No server sync — data persists only on device
- Keys: `@Nursing:babies`, `@Nursing:sessions`, `@Nursing:activeBaby`

### Authentication
- JWT tokens stored in `@Auth:token` (AsyncStorage)
- User object stored in `@Auth:user`
- Tokens automatically cleared on logout to prevent data contamination

## Running Tests

Frontend:
```bash
cd frontend
npm test
```

Backend:
```bash
cd backend
npm test
```

## Deployment

### Backend (Vercel)
Configuration already in place. Deploy with:
```bash
vercel deploy
```

### Frontend (Expo)
```bash
eas build --platform ios
eas build --platform android
eas submit --platform ios
eas submit --platform android
```

## Known Issues

- `@types/react` pinned to ~18.2.45 due to React Native compatibility — use `--legacy-peer-deps` for npm installs
- Database: TLS required for cloud PostgreSQL connections

## Contributing

1. Create a feature branch from `main`
2. Test locally on web and mobile
3. Push to your branch and create a PR
4. Ensure all tests pass before merging

## License

Proprietary — Contact the team for usage rights.

## Support

For issues, contact the development team or open an issue on GitHub.