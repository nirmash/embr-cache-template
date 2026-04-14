const { exec } = require('child_process');
const { redis, redisSub } = require('../cache');
const { secondsUntilNext } = require('./parser');

const TRIGGER_PREFIX = 'cron:trigger:';
const JOB_PREFIX = 'cron:job:';
const LOG_PREFIX = 'cron:log:';
const MAX_LOG_ENTRIES = 20;

async function executeJob(jobId) {
  const job = await redis.hgetall(JOB_PREFIX + jobId);
  if (!job || !job.name || job.enabled === 'false') return;

  const startTime = Date.now();
  let success = false;
  let output = '';

  try {
    if (job.actionType === 'http') {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      try {
        const res = await fetch(job.action, { signal: controller.signal });
        output = `HTTP ${res.status} ${res.statusText}`;
        success = res.ok;
      } finally {
        clearTimeout(timeout);
      }
    } else if (job.actionType === 'script') {
      output = await new Promise((resolve, reject) => {
        exec(job.action, { timeout: 30000, maxBuffer: 1024 * 100 }, (err, stdout, stderr) => {
          if (err) reject(new Error(stderr || err.message));
          else resolve(stdout.trim().substring(0, 500));
        });
      });
      success = true;
    }
  } catch (err) {
    output = err.message;
    success = false;
  }

  const logEntry = JSON.stringify({
    timestamp: new Date().toISOString(),
    duration: Date.now() - startTime,
    success,
    output: output.substring(0, 500),
  });

  await redis.lpush(LOG_PREFIX + jobId, logEntry);
  await redis.ltrim(LOG_PREFIX + jobId, 0, MAX_LOG_ENTRIES - 1);

  console.log(`Cron [${job.name}] ${success ? 'OK' : 'FAIL'}: ${output.substring(0, 100)}`);
}

async function scheduleJob(jobId, expression) {
  try {
    const ttl = secondsUntilNext(expression);
    await redis.setex(TRIGGER_PREFIX + jobId, ttl, expression);
    return ttl;
  } catch (err) {
    console.error(`Failed to schedule job ${jobId}:`, err.message);
    return null;
  }
}

async function handleExpiration(expiredKey) {
  if (!expiredKey.startsWith(TRIGGER_PREFIX)) return;

  const jobId = expiredKey.slice(TRIGGER_PREFIX.length);
  const job = await redis.hgetall(JOB_PREFIX + jobId);
  if (!job || !job.expression || job.enabled === 'false') return;

  // Execute asynchronously — don't block the event loop
  executeJob(jobId).catch(err => console.error(`Job ${jobId} execution error:`, err.message));

  // Reschedule for next run
  await scheduleJob(jobId, job.expression);
}

async function restoreJobs() {
  const keys = await redis.keys(JOB_PREFIX + '*');
  let restored = 0;

  for (const key of keys) {
    const jobId = key.slice(JOB_PREFIX.length);
    const job = await redis.hgetall(key);
    if (job.enabled === 'false') continue;

    const triggerExists = await redis.exists(TRIGGER_PREFIX + jobId);
    if (!triggerExists && job.expression) {
      await scheduleJob(jobId, job.expression);
      restored++;
    }
  }

  if (restored > 0) console.log(`Restored ${restored} cron trigger(s)`);
}

function startEngine() {
  redisSub.subscribe('__keyevent@0__:expired');
  redisSub.on('message', (channel, expiredKey) => {
    if (channel === '__keyevent@0__:expired') {
      handleExpiration(expiredKey);
    }
  });

  restoreJobs().then(() => {
    console.log('Cron engine started');
  });
}

module.exports = { startEngine, scheduleJob, executeJob, TRIGGER_PREFIX, JOB_PREFIX, LOG_PREFIX };
