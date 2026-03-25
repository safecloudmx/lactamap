# LactaMap - Instrucciones para Claude Code

> **REGLA**: Al terminar una sesión donde se creen/modifiquen/eliminen archivos, actualizar este archivo si cambiaron rutas, modelos, pantallas o patrones.

## Workflow
- Branch de trabajo: `qa`. Push a `main` solo cuando el usuario lo indique.
- Versión: `frontend/src/screens/AboutScreen.tsx` línea 26, formato `v0.1-YYMMDD-N`
- Idioma app: Español (MX). Código/variables: Inglés.

## Migraciones DB (Prisma)
`prisma migrate dev/deploy` NO funciona desde local. Usar psql directo:
```bash
# 1. Crear carpeta: backend/prisma/migrations/<YYYYMMDDHHMMSS>_<nombre>/migration.sql
# 2. Aplicar:
PGPASSWORD='<ver .env>' psql -h db-admin.safecloud.mx -p 5432 -U usr_lactamap_sys_w -d db_lactamap -f prisma/migrations/<ts>_<nombre>/migration.sql
# 3. Registrar:
PGPASSWORD='<ver .env>' psql -h db-admin.safecloud.mx -p 5432 -U usr_lactamap_sys_w -d db_lactamap -c "INSERT INTO \"_prisma_migrations\" (id, checksum, migration_name, finished_at, applied_steps_count) VALUES (gen_random_uuid(), 'manual', '<ts>_<nombre>', NOW(), 1);"
# 4. npx prisma generate (cerrar backend si falla con EPERM)
```

## Stack
Backend: Express + Prisma + PostgreSQL + S3 (Sharp→WebP). Frontend: React Native Expo 54 (web+native). Auth: JWT con `userId` (NO `id`). Email: Resend + SMTP fallback.

## Endpoints API (`/api/v1/`)
auth, lactarios, reviews, users, babies, nursing-sessions, pumping-sessions, sleep-sessions, diaper-records, growth-records, submissions, edit-proposals, photos (ver archivos en `backend/src/routes/`)

## Modelos Prisma
User, Lactario, LactarioAmenity, Review, ReviewReport, Baby, NursingSession, PumpingSession, PumpingPhoto, SleepSession, DiaperRecord, GrowthRecord, GrowthPhoto, Photo, Badge, UserBadge, LactarioSubmission, LactarioEditProposal, MaintenanceReport, ModerationQueue

## Pantallas Frontend
Login, Dashboard, HomeScreen(mapa), Explore, Profile, RoomDetail, AddRoom, EditRoom, NursingTimer, PumpingLog, PumpingHistory, FeedingHistory, FeedingSessionDetail, EditProfile, MyContributions, AdminReview, Leaderboard, Resources, Settings, About, BabyDetail, BabyEdit, GrowthAdd, SleepTimer, SleepHistory, SleepSessionDetail, DiaperLog, DiaperHistory, DiaperRecordDetail, RelaxingSounds, AddFloor

## Patrones clave
- Imágenes: ImagePicker → Sharp resize → WebP → S3 → signUrl() (6h TTL, 1h cache)
- Amenidades: DB booleans ↔ Frontend strings español via `mapAmenityObjectToArray()`
- Maps: `.web.tsx` (Leaflet iframe) / `.native.tsx` (react-native-maps)
- Roles: VISITOR < CONTRIBUTOR < DISTINGUISHED < ELITE < OWNER < ADMIN
- ImagePicker/Location: try/catch dynamic require para graceful degradation
- Baby tracking: BabyDetailScreen hub → growth records, nursing, pumping, sleep, diaper filtered by babyId
- Sleep/Diaper: hybrid storage (server API + local AsyncStorage fallback via hasToken() check)
- Baby avatars: same S3 pipeline (Sharp 400x400 cover → WebP → S3)
