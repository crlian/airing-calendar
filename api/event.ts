const WEBHOOK_URL = process.env.N8N_TRACKER_WEBHOOK_URL || "";

type TrackPayload = {
  sid?: string;
  page?: string;
  referrer?: string;
  timestamp?: string;
  userAgent?: string;
  hostname?: string;
};

const getString = (value: unknown): string => {
  return typeof value === "string" ? value : "";
};

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method Not Allowed" });
    return;
  }

  let body: TrackPayload | null = null;

  try {
    if (typeof req.body === "string") {
      body = JSON.parse(req.body) as TrackPayload;
    } else if (typeof req.body === "object" && req.body !== null) {
      body = req.body as TrackPayload;
    }
  } catch (error) {
    console.error("Invalid tracking body:", error);
  }

  const sid = getString(body?.sid).trim();
  const page = getString(body?.page).trim();
  if (!sid || !page) {
    res.status(400).json({ ok: false, error: "Invalid payload" });
    return;
  }

  if (!WEBHOOK_URL) {
    if (process.env.NODE_ENV === "production") {
      res.status(500).json({ ok: false, error: "Webhook not configured" });
      return;
    }
    res.status(200).json({ ok: true, skipped: true });
    return;
  }

  const payload = {
    sid,
    page,
    referrer: getString(body?.referrer) || "direct",
    timestamp: getString(body?.timestamp) || new Date().toISOString(),
    userAgent:
      getString(body?.userAgent) || req.headers["user-agent"] || "",
    hostname: getString(body?.hostname),
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
    console.error("Failed to send tracking event:", error);
    res.status(500).json({ ok: false, error: "Failed to send tracking" });
  }
}
