<<<<<<< HEAD
<<<<<<< HEAD
# lactamap
=======
=======
>>>>>>> 27efff6 (Initial commit with cloud DB configuration)
# LactaMap Project

## Prerequisites

- Node.js (LTS version recommended)
- PostgreSQL (database)

## Setup

### 1. Backend

navigate to `backend/` and run:

```bash
npm install
npx prisma generate
```

Create a `.env` file based on the template (already created) and update `DATABASE_URL`.

To run:

```bash
npm run dev
```

### 2. Frontend

navigate to `frontend/` and run:

```bash
npm install
npx expo start
```

## Structure

- `backend/`: Express.js API + Prisma
- `frontend/`: React Native (Expo) App
<<<<<<< HEAD
>>>>>>> 27efff6 (Initial commit with cloud DB configuration)
=======
>>>>>>> 27efff6 (Initial commit with cloud DB configuration)
