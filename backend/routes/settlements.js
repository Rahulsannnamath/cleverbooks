import express from 'express';
import multer from 'multer';
import {
  uploadSettlements,
  getSettlements,
  getSettlementDetail,
  getSettlementStats,
  exportSettlementsCSV,
} from '../controllers/settlementController.js';
import { createRateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Configure multer for CSV file uploads (in-memory buffer)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === 'text/csv' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.originalname.endsWith('.csv')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  },
});

// Rate-limited upload endpoint (max 5 req/min)
const uploadRateLimiter = createRateLimiter(5, 60000);

// Routes
router.post('/upload', uploadRateLimiter, upload.single('file'), uploadSettlements);
router.get('/stats/summary', getSettlementStats);
router.get('/export/csv', exportSettlementsCSV);
router.get('/:awbNumber', getSettlementDetail);
router.get('/', getSettlements);

export default router;
