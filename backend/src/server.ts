import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth.routes';
import lactariosRoutes from './routes/lactarios.routes';
import reviewsRoutes from './routes/reviews.routes';
import usersRoutes from './routes/users.routes';
import babiesRoutes from './routes/babies.routes';
import nursingSessionsRoutes from './routes/nursingSessions.routes';
import submissionsRoutes from './routes/submissions.routes';
import editProposalsRoutes from './routes/editProposals.routes';
import photosRoutes from './routes/photos.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// CORS — in production, replace '*' with specific allowed origins
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://localhost:8081', 'http://localhost:8082', 'http://localhost:19000'];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Postman)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

app.use(express.json());

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Routes
app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1/lactarios', lactariosRoutes);
app.use('/api/v1/reviews', reviewsRoutes);
app.use('/api/v1/users', usersRoutes);
app.use('/api/v1/babies', babiesRoutes);
app.use('/api/v1/nursing-sessions', nursingSessionsRoutes);
app.use('/api/v1/submissions', submissionsRoutes);
app.use('/api/v1/edit-proposals', editProposalsRoutes);
app.use('/api/v1', photosRoutes);

// Health check
app.get('/', (_req, res) => {
  res.send('LactaMap API is running');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
