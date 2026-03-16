require('dotenv').config();

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const { connectDatabase } = require('./config/db');
const authRoutes = require('./routes/authRoutes');

const app = express();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '1mb' }));
app.use(limiter);

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);

app.use((_req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

async function start() {
  try {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is not configured');
    }

    await connectDatabase();

    const port = Number(process.env.PORT || 3001);
    app.listen(port, () => {
      // eslint-disable-next-line no-console
      console.log(`Server listening on port ${port}`);
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Startup error:', error.message);
    process.exit(1);
  }
}

start();
