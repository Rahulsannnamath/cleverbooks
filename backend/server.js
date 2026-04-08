import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import settlementRoutes from './routes/settlements.js';
import jobRoutes from './routes/jobs.js';
import notificationRoutes from './routes/notifications.js';
import errorHandler from './middleware/errorHandler.js';
import { startScheduledReconciliation } from './jobs/scheduledReconciliation.js';
import { startNotificationWorker } from './workers/notificationWorker.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ──────────────────────────────────────────────
// Middleware
// ──────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(
      `${req.method} ${req.originalUrl} → ${res.statusCode} (${duration}ms)`
    );
  });
  next();
});

// ──────────────────────────────────────────────
// Routes
// ──────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'CleverBooks Settlement API is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.use('/api/settlements', settlementRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/notifications', notificationRoutes);

// ──────────────────────────────────────────────
// Error handling
// ──────────────────────────────────────────────
app.use(errorHandler);

// ──────────────────────────────────────────────
// Start server
// ──────────────────────────────────────────────
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Start the scheduled reconciliation job
    startScheduledReconciliation();

    // Start the notification worker (BullMQ) — gracefully handles missing Redis
    await startNotificationWorker();

    // Start Express server
    app.listen(PORT, () => {
      console.log(`
╔══════════════════════════════════════════════════╗
║  🚀 CleverBooks Settlement API                  ║
║  ───────────────────────────────────             ║
║  Server:  http://localhost:${PORT}                ║
║  Health:  http://localhost:${PORT}/api/health     ║
║  Mode:    ${process.env.NODE_ENV || 'development'}                       ║
╚══════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error(`❌ Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

startServer();
