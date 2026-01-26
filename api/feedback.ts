const WEBHOOK_URL =
  process.env.N8N_WEBHOOK_URL ||
  "https://crlian.site/webhook-test/f2cb5b42-4f39-4087-9c7e-bf7d4df6e8f6";

const MAX_MESSAGE_LENGTH = 1000;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 5;

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const rateLimitStore = new Map<string, RateLimitEntry>();

type FeedbackPayload = {
  message: string;
  honeypot?: string;
  turnstileToken?: string | null;
  path?: string;
  userAgent?: string;
  timezone?: string;
  timestamp?: string;
};

const getClientIp = (req: any): string => {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = req.headers["x-real-ip"];
  if (typeof realIp === "string") return realIp;
  return req.socket?.remoteAddress || "";
};

const isRateLimited = (ip: string): boolean => {
  if (!ip) return false;
  const now = Date.now();
  const entry = rateLimitStore.get(ip);
  if (!entry || entry.resetAt <= now) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return true;
  }

  entry.count += 1;
  rateLimitStore.set(ip, entry);
  return false;
};

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method Not Allowed" });
    return;
  }

  let body: FeedbackPayload | null = null;

  try {
    if (typeof req.body === "string") {
      body = JSON.parse(req.body) as FeedbackPayload;
    } else if (typeof req.body === "object" && req.body !== null) {
      body = req.body as FeedbackPayload;
    }
  } catch (error) {
    console.error("Invalid feedback body:", error);
  }

  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const honeypot = typeof body?.honeypot === "string" ? body.honeypot.trim() : "";
  if (honeypot) {
    res.status(200).json({ ok: true });
    return;
  }
  if (!message) {
    res.status(400).json({ ok: false, error: "Message required" });
    return;
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    res.status(400).json({ ok: false, error: "Message too long" });
    return;
  }

  if (!WEBHOOK_URL) {
    res.status(500).json({ ok: false, error: "Webhook not configured" });
    return;
  }

  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp)) {
    res.status(429).json({ ok: false, error: "Too many requests" });
    return;
  }

  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
  if (turnstileSecret) {
    const token = typeof body?.turnstileToken === "string" ? body.turnstileToken : "";
    if (!token) {
      res.status(400).json({ ok: false, error: "Verification required" });
      return;
    }

    try {
      const form = new URLSearchParams();
      form.set("secret", turnstileSecret);
      form.set("response", token);
      if (clientIp) {
        form.set("remoteip", clientIp);
      }

      const verifyResponse = await fetch(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        {
          method: "POST",
          body: form,
        }
      );

      const verification = (await verifyResponse.json()) as { success?: boolean };
      if (!verification.success) {
        res.status(403).json({ ok: false, error: "Verification failed" });
        return;
      }
    } catch (error) {
      console.error("Turnstile verification failed:", error);
      res.status(500).json({ ok: false, error: "Verification error" });
      return;
    }
  }

  const payload = {
    message,
    path: typeof body?.path === "string" ? body.path : "",
    userAgent:
      typeof body?.userAgent === "string"
        ? body.userAgent
        : req.headers["user-agent"] || "",
    timezone: typeof body?.timezone === "string" ? body.timezone : "",
    timestamp:
      typeof body?.timestamp === "string" ? body.timestamp : new Date().toISOString(),
  };

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      res.status(502).json({ ok: false, error: "Upstream webhook error" });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Failed to send feedback:", error);
    res.status(500).json({ ok: false, error: "Failed to send feedback" });
  }
}
