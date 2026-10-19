import React, { useEffect, useRef, useState } from 'react';

const ADSGRAM_BLOCK_ID = import.meta.env.VITE_ADSGRAM_BLOCK_ID || 'task-000';

export default function App() {
  const [balance, setBalance] = useState(null);
  const [status, setStatus] = useState('Loading…');
  const [noTasks, setNoTasks] = useState(false);
  const taskRef = useRef(null);

  // Boot: hand Telegram initData to the backend, get the user's balance back
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    tg?.ready();
    tg?.expand();

    const initData = tg?.initData || '';

    fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData })
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setBalance(data.balance);
          setStatus('');
        } else {
          setStatus('Could not verify your session. Reopen from Telegram.');
        }
      })
      .catch(() => setStatus('Connection problem. Try again in a moment.'));
  }, []);

  // Wire up the AdsGram task widget's events once it's mounted
  useEffect(() => {
    const el = taskRef.current;
    if (!el) return;

    const onReward = (e) => {
      const tg = window.Telegram?.WebApp;
      const initData = tg?.initData || '';
      fetch('/api/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, taskRef: e.detail?.trackingId || Date.now().toString() })
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.ok) setBalance(data.balance);
        });
    };

    const onNoTasks = () => setNoTasks(true);

    el.addEventListener('reward', onReward);
    el.addEventListener('onBannerNotFound', onNoTasks);

    return () => {
      el.removeEventListener('reward', onReward);
      el.removeEventListener('onBannerNotFound', onNoTasks);
    };
  }, []);

  return (
    <div className="app">
      <header className="topbar">
        <span className="topbar-label">Balance</span>
        <span className="balance">{balance === null ? '—' : balance}</span>
      </header>

      <main className="content">
        <h1>Tasks</h1>
        <p className="subhead">Join, subscribe, or try something new. Get credited the moment it's confirmed.</p>

        {status && <p className="status">{status}</p>}

        {!status && (
          <div className="task-list">
            <adsgram-task
              ref={taskRef}
              data-block-id={ADSGRAM_BLOCK_ID}
              class="task"
            ></adsgram-task>

            {noTasks && (
              <p className="empty-state">No tasks available right now. Check back soon.</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
