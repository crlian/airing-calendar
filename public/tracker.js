// Anime Calendar Visitor Tracker
// Sends page view events to n8n webhook for Telegram notifications

(function() {
  // Replace with your n8n webhook URL
  const WEBHOOK_URL = 'https://crlian.site/webhook/7f1760d5-e651-4453-ba37-743e7ca417d3';

  // Generate or retrieve Session ID
  function getSessionId() {
    const key = 'aniseason_sid';
    let sid = sessionStorage.getItem(key);

    if (!sid) {
      // Generate unique session ID (timestamp + random)
      sid = Date.now().toString(36) + Math.random().toString(36).substr(2);
      sessionStorage.setItem(key, sid);
    }

    return sid;
  }

  // Capture visit data
  const visitData = {
    sid: getSessionId(), // Session ID for user differentiation
    page: window.location.pathname + window.location.search,
    referrer: document.referrer || 'direct',
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    hostname: window.location.hostname
  };

  // Send to n8n webhook
  try {
    fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(visitData),
      // Use keepalive to ensure request completes even if page closes
      keepalive: true
    }).catch(() => {
      // Silently fail - don't impact user experience
    });
  } catch (e) {
    // Silently fail
  }
})();
