const router = require('express').Router();
const crypto = require('crypto');
const { redis } = require('../cache');
const { secondsUntilNext, describeExpression } = require('../cron/parser');
const { scheduleJob, TRIGGER_PREFIX, JOB_PREFIX, LOG_PREFIX } = require('../cron/engine');

// Create a new cron job
router.post('/', async (req, res, next) => {
  try {
    const { name, expression, actionType, action } = req.body;
    if (!name || !expression || !actionType || !action) {
      return res.status(400).json({ error: 'name, expression, actionType, and action are required' });
    }
    if (!['http', 'script'].includes(actionType)) {
      return res.status(400).json({ error: 'actionType must be "http" or "script"' });
    }

    // Validate cron expression
    try { secondsUntilNext(expression); } catch (err) {
      return res.status(400).json({ error: 'Invalid cron expression: ' + err.message });
    }

    const id = crypto.randomBytes(6).toString('hex');
    const job = { name, expression, actionType, action, enabled: 'true', createdAt: new Date().toISOString() };

    await redis.hset(JOB_PREFIX + id, job);
    const ttl = await scheduleJob(id, expression);

    res.json({ id, ...job, nextRunIn: ttl, description: describeExpression(expression) });
  } catch (err) { next(err); }
});

// List all cron jobs
router.get('/', async (req, res, next) => {
  try {
    const keys = await redis.keys(JOB_PREFIX + '*');
    const jobs = [];

    for (const key of keys) {
      const id = key.slice(JOB_PREFIX.length);
      const job = await redis.hgetall(key);
      const ttl = await redis.ttl(TRIGGER_PREFIX + id);
      jobs.push({
        id,
        ...job,
        nextRunIn: ttl > 0 ? ttl : null,
        description: describeExpression(job.expression || ''),
      });
    }

    jobs.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    res.json(jobs);
  } catch (err) { next(err); }
});

// Toggle enabled/disabled
router.post('/:id/toggle', async (req, res, next) => {
  try {
    const { id } = req.params;
    const job = await redis.hgetall(JOB_PREFIX + id);
    if (!job || !job.name) return res.status(404).json({ error: 'Job not found' });

    const newEnabled = job.enabled === 'true' ? 'false' : 'true';
    await redis.hset(JOB_PREFIX + id, 'enabled', newEnabled);

    if (newEnabled === 'true') {
      await scheduleJob(id, job.expression);
    } else {
      await redis.del(TRIGGER_PREFIX + id);
    }

    res.json({ id, enabled: newEnabled });
  } catch (err) { next(err); }
});

// Delete a cron job
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    await redis.del(JOB_PREFIX + id, TRIGGER_PREFIX + id, LOG_PREFIX + id);
    res.json({ deleted: true });
  } catch (err) { next(err); }
});

// Get execution log for a job
router.get('/:id/logs', async (req, res, next) => {
  try {
    const { id } = req.params;
    const entries = await redis.lrange(LOG_PREFIX + id, 0, 19);
    res.json(entries.map(e => JSON.parse(e)));
  } catch (err) { next(err); }
});

module.exports = router;
