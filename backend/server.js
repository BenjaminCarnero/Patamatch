const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./db/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static files (frontend)
app.use(express.static(path.join(__dirname, '../frontend'), {
  extensions: ['html', 'js', 'css'],
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));

// Vercel / API DB Initialization Middleware
let dbInitialized = false;
app.use('/api', async (req, res, next) => {
  if (!dbInitialized) {
    try {
      await initDatabase();
      dbInitialized = true;
      console.log('📦 Database initialized');
    } catch (err) {
      console.error('❌ DB Init Error:', err);
      return res.status(500).json({ success: false, error: 'Database init failed' });
    }
  }
  next();
});

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/pets', require('./routes/pets'));
app.use('/api/lost-pets', require('./routes/lost-pets'));
app.use('/api/posts', require('./routes/posts'));
app.use('/api/stories', require('./routes/stories'));
app.use('/api/favorites', require('./routes/favorites'));
app.use('/api/carnets', require('./routes/carnets'));
app.use('/api/chats', require('./routes/chats'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/volunteers', require('./routes/volunteers'));
app.use('/api/ai', require('./routes/ai'));

// SPA fallback — serve index.html for non-API routes
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  res.status(500).json({ success: false, error: 'Error interno del servidor' });
});

// Export for Vercel Serverless
module.exports = app;

// Initialize DB then start server (for local execution)
async function start() {
  if (!dbInitialized) {
    await initDatabase();
    dbInitialized = true;
    console.log('📦 Database initialized (local)');
  }

  app.listen(PORT, () => {
    console.log(`\n🐾 PataMatch server running at http://localhost:${PORT}\n`);
    console.log('   Demo accounts:');
    console.log('   📧 sarah@patamatch.com / demo123');
    console.log('   📧 david@patamatch.com / demo123');
    console.log('   📧 demo@patamatch.com  / demo123\n');
  });
}

if (require.main === module) {
  start().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
