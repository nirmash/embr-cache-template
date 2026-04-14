import React, { useState, useRef, useEffect } from 'react';

export default function RedisCli() {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState([]);
  const [cmdHistory, setCmdHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  const runCommand = async () => {
    const cmd = input.trim();
    if (!cmd) return;

    setCmdHistory(prev => [cmd, ...prev]);
    setHistoryIndex(-1);

    setHistory(prev => [...prev, { type: 'cmd', text: cmd }]);
    setInput('');

    try {
      const res = await fetch('/api/redis-cli', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd }),
      });
      const data = await res.json();

      if (data.error) {
        setHistory(prev => [...prev, { type: 'error', text: data.error }]);
      } else {
        const formatted = formatResult(data.result);
        setHistory(prev => [...prev, { type: 'result', text: formatted }]);
      }
    } catch (err) {
      setHistory(prev => [...prev, { type: 'error', text: 'Network error: ' + err.message }]);
    }
  };

  const formatResult = (result) => {
    if (result === null) return '(nil)';
    if (typeof result === 'number') return '(integer) ' + result;
    if (typeof result === 'string') return '"' + result + '"';
    if (Array.isArray(result)) {
      if (result.length === 0) return '(empty array)';
      return result.map((item, i) => (i + 1) + ') ' + formatResult(item)).join('\n');
    }
    return String(result);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      runCommand();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (cmdHistory.length > 0) {
        const newIndex = Math.min(historyIndex + 1, cmdHistory.length - 1);
        setHistoryIndex(newIndex);
        setInput(cmdHistory[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(cmdHistory[newIndex]);
      } else {
        setHistoryIndex(-1);
        setInput('');
      }
    }
  };

  return (
    <div className="panel">
      <h2>Redis CLI <span className="badge">Interactive</span></h2>

      <div className="redis-cli-terminal" onClick={() => inputRef.current?.focus()}>
        <div className="redis-cli-output">
          {history.length === 0 && (
            <div className="redis-cli-hint">Type a Redis command and press Enter. Try: PING, KEYS *, INFO server</div>
          )}
          {history.map((entry, i) => (
            <div key={i} className={'redis-cli-line ' + entry.type}>
              {entry.type === 'cmd' && <span className="redis-cli-prompt">{'> '}</span>}
              <span className="redis-cli-text">{entry.text}</span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        <div className="redis-cli-input-row">
          <span className="redis-cli-prompt">{'> '}</span>
          <input
            ref={inputRef}
            className="redis-cli-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter Redis command..."
            spellCheck={false}
            autoComplete="off"
          />
        </div>
      </div>
    </div>
  );
}
