// Anime Calendar Visitor Tracker
// Sends page view events to n8n webhook for Telegram notifications

(function() {
  const TRACK_ENDPOINT = "/api/event";

  // Generate or retrieve Session ID
  function getSessionId() {
    const key = "aniseason_sid";
    let sid = sessionStorage.getItem(key);

    if (!sid) {
      // Generate unique session ID (timestamp + random)
      sid = Date.now().toString(36) + Math.random().toString(36).substr(2);
      sessionStorage.setItem(key, sid);
    }

    return sid;
  }

  // Check if this is a new visitor (not seen this sid before)
  function isNewVisitor() {
    const currentSid = getSessionId();
    const lastSeenSid = localStorage.getItem("lastSeenSid");

    if (currentSid !== lastSeenSid) {
      localStorage.setItem("lastSeenSid", currentSid);
      return true;
    }

    return false;
  }

  // Only track if it's a new visitor
  if (isNewVisitor()) {
    // Capture visit data
    const visitData = {
      sid: getSessionId(),
      page: window.location.pathname + window.location.search,
      referrer: document.referrer || "direct",
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      hostname: window.location.hostname
    };

    // Send to serverless endpoint
    try {
      fetch(TRACK_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
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
  }
})();
