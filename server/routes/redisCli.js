const router = require('express').Router();
const { redis } = require('../cache');

const BLOCKED_COMMANDS = new Set([
  'FLUSHALL', 'FLUSHDB', 'SHUTDOWN', 'DEBUG', 'CONFIG',
  'REPLICAOF', 'SLAVEOF', 'CLUSTER', 'BGSAVE', 'BGREWRITEAOF',
  'SAVE', 'MONITOR', 'EVAL', 'EVALSHA', 'SCRIPT', 'MODULE',
  'ACL', 'PSYNC', 'REPLCONF', 'WAIT', 'FAILOVER', 'SWAPDB',
]);

function parseCommandString(input) {
  const tokens = [];
  let current = '';
  let inQuote = false;
  let quoteChar = '';

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inQuote) {
      if (ch === quoteChar) { inQuote = false; }
      else { current += ch; }
    } else if (ch === '"' || ch === "'") {
      inQuote = true;
      quoteChar = ch;
    } else if (ch === ' ' || ch === '\t') {
      if (current) { tokens.push(current); current = ''; }
    } else {
      current += ch;
    }
  }
  if (current) tokens.push(current);
  return tokens;
}

router.post('/', async (req, res, next) => {
  try {
    const { command } = req.body;
    if (!command || typeof command !== 'string') {
      return res.status(400).json({ error: 'command string is required' });
    }

    const tokens = parseCommandString(command.trim());
    if (tokens.length === 0) {
      return res.status(400).json({ error: 'empty command' });
    }

    const cmd = tokens[0].toUpperCase();
    if (BLOCKED_COMMANDS.has(cmd)) {
      return res.json({ result: null, error: `Command '${cmd}' is blocked for safety` });
    }

    const result = await redis.call(tokens[0], ...tokens.slice(1));
    res.json({ result, error: null });
  } catch (err) {
    res.json({ result: null, error: err.message });
  }
});

module.exports = router;
