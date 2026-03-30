require('dotenv').config();

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const { connectDatabase } = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const safetyRoutes = require('./routes/safetyRoutes');
const contactsRoutes = require('./routes/contactsRoutes');
const sosRoutes = require('./routes/sosRoutes');
const { getLiveFusionStats } = require('./utils/tomtomTrafficService');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST']
  }
});

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '1mb' }));
app.use(limiter);

// Make io accessible in routes if needed (as an app property or via middleware)
app.set('socketio', io);

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Register Core APIs
app.use('/api/auth', authRoutes);
app.use('/api/safety', safetyRoutes);
app.use('/api/contacts', contactsRoutes);
app.use('/api/sos', sosRoutes);

// Real-time Socket interactions
io.on('connection', (socket) => {
  console.log('Mobile client connected:', socket.id);

  socket.on('join_region', (data) => {
    // Allows localized broadcasting based on coordinates (e.g., room names by city)
    const { city } = data;
    if (city) socket.join(city);
    console.log(`Client ${socket.id} joined safety zone: ${city || 'Global'}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Background "Heartbeat" for Live Fusion Dashboard Score
setInterval(() => {
   getLiveFusionStats()
     .then((updatedFusion) => {
       io.emit('fusion_stats_update', updatedFusion);
     })
     .catch(() => {
       io.emit('fusion_stats_update', {
         crowdDensity: 50,
         trafficFlow: 60,
         status: 'fallback',
         timestamp: new Date().toISOString(),
       });
     });
}, 60000); // Pulse every 60 seconds

async function start() {
  try {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is not configured');
    }

    await connectDatabase();

    const port = Number(process.env.PORT || 3001);
    server.listen(port, '0.0.0.0', () => {
      console.log(`📡 SafeRoute Real-time Engine listening on 0.0.0.0:${port}`);
    });
  } catch (error) {
    console.error('Core Startup error:', error.message);
    process.exit(1);
  }
}

start();
