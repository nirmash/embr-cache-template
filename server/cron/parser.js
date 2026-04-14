/**
 * 5 or 6-field cron parser.
 *   5 fields: minute hour dom month dow
 *   6 fields: second minute hour dom month dow
 * Calculates seconds until the next matching time.
 */

function parseCronField(field, min, max) {
  const values = new Set();

  for (const part of field.split(',')) {
    const stepMatch = part.match(/^(.+)\/(\d+)$/);
    let range = stepMatch ? stepMatch[1] : part;
    const step = stepMatch ? parseInt(stepMatch[2]) : 1;

    if (range === '*') {
      for (let i = min; i <= max; i += step) values.add(i);
    } else if (range.includes('-')) {
      const [lo, hi] = range.split('-').map(Number);
      for (let i = lo; i <= hi; i += step) values.add(i);
    } else {
      values.add(parseInt(range));
    }
  }

  return [...values].filter(v => v >= min && v <= max).sort((a, b) => a - b);
}

function secondsUntilNext(expression) {
  const parts = expression.trim().split(/\s+/);

  let seconds, minutes, hours, doms, months, dows;
  let hasSeconds = false;

  if (parts.length === 6) {
    hasSeconds = true;
    seconds = parseCronField(parts[0], 0, 59);
    minutes = parseCronField(parts[1], 0, 59);
    hours = parseCronField(parts[2], 0, 23);
    doms = parseCronField(parts[3], 1, 31);
    months = parseCronField(parts[4], 1, 12);
    dows = parseCronField(parts[5], 0, 6);
  } else if (parts.length === 5) {
    seconds = [0];
    minutes = parseCronField(parts[0], 0, 59);
    hours = parseCronField(parts[1], 0, 23);
    doms = parseCronField(parts[2], 1, 31);
    months = parseCronField(parts[3], 1, 12);
    dows = parseCronField(parts[4], 0, 6);
  } else {
    throw new Error('Cron expression must have 5 fields (min hr dom mon dow) or 6 fields (sec min hr dom mon dow)');
  }

  if (!seconds.length || !minutes.length || !hours.length || !doms.length || !months.length || !dows.length) {
    throw new Error('Invalid cron expression');
  }

  const now = new Date();
  const limit = new Date(now.getTime() + 366 * 24 * 3600 * 1000);

  let candidate = new Date(now);
  candidate.setMilliseconds(0);

  if (hasSeconds) {
    // Advance by 1 second to avoid matching the current second
    candidate.setSeconds(candidate.getSeconds() + 1);
  } else {
    // Advance to the next minute
    candidate.setSeconds(0);
    candidate.setMinutes(candidate.getMinutes() + 1);
  }

  while (candidate < limit) {
    if (!months.includes(candidate.getMonth() + 1)) {
      candidate.setMonth(candidate.getMonth() + 1, 1);
      candidate.setHours(0, 0, 0, 0);
      continue;
    }
    if (!doms.includes(candidate.getDate()) || !dows.includes(candidate.getDay())) {
      candidate.setDate(candidate.getDate() + 1);
      candidate.setHours(0, 0, 0, 0);
      continue;
    }
    if (!hours.includes(candidate.getHours())) {
      candidate.setHours(candidate.getHours() + 1, 0, 0, 0);
      continue;
    }
    if (!minutes.includes(candidate.getMinutes())) {
      candidate.setMinutes(candidate.getMinutes() + 1, 0, 0);
      continue;
    }
    if (hasSeconds && !seconds.includes(candidate.getSeconds())) {
      candidate.setSeconds(candidate.getSeconds() + 1, 0);
      continue;
    }
    // Found a match
    const diff = Math.round((candidate.getTime() - now.getTime()) / 1000);
    return Math.max(diff, 1);
  }

  throw new Error('No matching time found within the next year');
}

function describeExpression(expression) {
  const parts = expression.trim().split(/\s+/);

  if (parts.length === 6) {
    const [sec, min, hr, dom, mon, dow] = parts;
    if (expression === '* * * * * *') return 'Every second';
    if (sec.match(/^\*\/\d+$/) && min === '*' && hr === '*' && dom === '*' && mon === '*' && dow === '*') {
      return `Every ${sec.split('/')[1]} seconds`;
    }
    if (sec !== '*' && min === '*' && hr === '*' && dom === '*' && mon === '*' && dow === '*') {
      return `At second ${sec} of every minute`;
    }
    // Fall through to show raw expression
  }

  if (parts.length === 5) {
    const [min, hr, dom, mon, dow] = parts;
    if (expression === '* * * * *') return 'Every minute';
    if (min.match(/^\*\/\d+$/) && hr === '*' && dom === '*' && mon === '*' && dow === '*') {
      return `Every ${min.split('/')[1]} minutes`;
    }
    if (min !== '*' && hr === '*' && dom === '*' && mon === '*' && dow === '*') {
      return `At minute ${min} of every hour`;
    }
    if (min !== '*' && hr !== '*' && dom === '*' && mon === '*' && dow === '*') {
      return `Daily at ${hr.padStart(2, '0')}:${min.padStart(2, '0')}`;
    }
  }

  return expression;
}

module.exports = { secondsUntilNext, describeExpression, parseCronField };
