const express = require('express');
const path = require('path');
const errorHandler = require('./middleware/errorHandler');
const { seedDemoData, enableKeyspaceNotifications } = require('./cache');
const { startEngine } = require('./cron/engine');

const app = express();
app.use(express.json());

// API routes
app.use('/', require('./routes/health'));
app.use('/api/leaderboard', require('./routes/leaderboard'));
app.use('/api/counters', require('./routes/counters'));
app.use('/api/cache-demo', require('./routes/cacheDemo'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/cron', require('./routes/cron'));
app.use('/api/redis-cli', require('./routes/redisCli'));

// Serve static build output
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path === '/health') return next();
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) next();
  });
});

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log('PulseBoard running on port ' + PORT);
  await seedDemoData();
  console.log('Demo data seeded into cache');
  await enableKeyspaceNotifications();
  startEngine();
});
