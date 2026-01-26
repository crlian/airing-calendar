import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

const FEEDBACK_STORAGE_KEY = "anime-calendar:feedback-sent";
const QUESTION_TEXT = "See something wrong or missing?";
const BUBBLE_TEXT = "Got feedback?";
const THANK_YOU_TEXT = "Thanks — I read every message 🙏";

type FeedbackStatus = "idle" | "submitting" | "sent";

interface FeedbackWidgetProps {
  hasAddedAnime: boolean;
  onSubmit?: (payload: FeedbackSubmission) => Promise<void>;
}

type FeedbackSubmission = {
  message: string;
  honeypot: string;
  turnstileToken?: string | null;
};

type TurnstileRenderOptions = {
  sitekey: string;
  size?: "invisible" | "compact" | "normal";
  callback?: (token: string) => void;
  "error-callback"?: () => void;
  "expired-callback"?: () => void;
};

type TurnstileApi = {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
  execute: (widgetId: string) => void;
  reset: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let turnstileScriptPromise: Promise<void> | null = null;

const loadTurnstileScript = (): Promise<void> => {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (turnstileScriptPromise) return turnstileScriptPromise;

  turnstileScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(
      'script[src="https://challenges.cloudflare.com/turnstile/v0/api.js"]'
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Turnstile failed")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Turnstile failed"));
    document.head.appendChild(script);
  });

  return turnstileScriptPromise;
};

const getScrollRatio = (target: EventTarget | null): number => {
  if (typeof document === "undefined") return 0;

  const scrollElement = (element: HTMLElement) => {
    const maxScroll = element.scrollHeight - element.clientHeight;
    if (maxScroll <= 0) return 0;
    return element.scrollTop / maxScroll;
  };

  if (target instanceof Document) {
    const element = target.scrollingElement || target.documentElement;
    if (element instanceof HTMLElement) {
      return scrollElement(element);
    }
    return 0;
  }

  if (target instanceof HTMLElement) {
    return scrollElement(target);
  }

  return 0;
};

export function FeedbackWidget({ hasAddedAnime, onSubmit }: FeedbackWidgetProps) {
  const [isEligible, setIsEligible] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<FeedbackStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [honeypot, setHoneypot] = useState("");

  const hasTriggeredRef = useRef(false);
  const previousAddRef = useRef(hasAddedAnime);
  const widgetRef = useRef<HTMLDivElement | null>(null);
  const turnstileContainerRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetIdRef = useRef<string | null>(null);
  const turnstileResolverRef = useRef<((token: string | null) => void) | null>(
    null
  );

  const siteKey = useMemo(
    () => (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) ?? "",
    []
  );

  const markTriggered = useCallback(() => {
    if (hasTriggeredRef.current) return;
    hasTriggeredRef.current = true;
    setIsEligible(true);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      markTriggered();
    }, 30000);
    return () => window.clearTimeout(timeout);
  }, [markTriggered]);

  useEffect(() => {
    if (!previousAddRef.current && hasAddedAnime) {
      markTriggered();
    }
    previousAddRef.current = hasAddedAnime;
  }, [hasAddedAnime, markTriggered]);

  useEffect(() => {
    const handleScroll = (event: Event) => {
      if (hasTriggeredRef.current) return;
      if (getScrollRatio(event.target) >= 0.3) {
        markTriggered();
      }
    };

    const options: AddEventListenerOptions = { passive: true, capture: true };
    document.addEventListener("scroll", handleScroll, options);
    return () => document.removeEventListener("scroll", handleScroll, options);
  }, [markTriggered]);

  useEffect(() => {
    if (!isOpen || !siteKey || !turnstileContainerRef.current) return;
    let isCancelled = false;

    loadTurnstileScript()
      .then(() => {
        if (isCancelled || !turnstileContainerRef.current || !window.turnstile) return;

        if (!turnstileWidgetIdRef.current) {
          turnstileWidgetIdRef.current = window.turnstile.render(
            turnstileContainerRef.current,
            {
              sitekey: siteKey,
              size: "invisible",
              callback: (token) => {
                if (turnstileResolverRef.current) {
                  turnstileResolverRef.current(token);
                  turnstileResolverRef.current = null;
                }
              },
              "error-callback": () => {
                if (turnstileResolverRef.current) {
                  turnstileResolverRef.current(null);
                  turnstileResolverRef.current = null;
                }
              },
              "expired-callback": () => {
                if (turnstileResolverRef.current) {
                  turnstileResolverRef.current(null);
                  turnstileResolverRef.current = null;
                }
              },
            }
          );
        } else {
          window.turnstile.reset(turnstileWidgetIdRef.current);
        }
      })
      .catch((err) => {
        console.error("Turnstile failed to load:", err);
      });

    return () => {
      isCancelled = true;
    };
  }, [isOpen, siteKey]);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (event: Event) => {
      const target = event.target;
      if (!widgetRef.current || !(target instanceof Node)) return;
      if (!widgetRef.current.contains(target)) {
        setIsOpen(false);
      }
    };

    const options: AddEventListenerOptions = { capture: true };
    document.addEventListener("mousedown", handleOutside, options);
    document.addEventListener("touchstart", handleOutside, options);
    return () => {
      document.removeEventListener("mousedown", handleOutside, options);
      document.removeEventListener("touchstart", handleOutside, options);
    };
  }, [isOpen]);

  const handleSend = async () => {
    const trimmed = message.trim();
    if (!trimmed || status === "submitting") return;

    setStatus("submitting");
    setError(null);

    if (honeypot.trim()) {
      localStorage.setItem(FEEDBACK_STORAGE_KEY, "true");
      setStatus("sent");
      setMessage("");
      setIsOpen(true);
      return;
    }

    let turnstileToken: string | null = null;
    if (siteKey) {
      if (!window.turnstile || !turnstileWidgetIdRef.current) {
        setStatus("idle");
        setError("Verification failed. Try again.");
        return;
      }

      turnstileToken = await new Promise((resolve) => {
        turnstileResolverRef.current = resolve;
        window.turnstile?.execute(turnstileWidgetIdRef.current as string);
        window.setTimeout(() => {
          if (turnstileResolverRef.current === resolve) {
            turnstileResolverRef.current = null;
            resolve(null);
          }
        }, 8000);
      });

      if (!turnstileToken) {
        setStatus("idle");
        setError("Verification failed. Try again.");
        return;
      }
    }

    try {
      if (onSubmit) {
        await onSubmit({
          message: trimmed,
          honeypot,
          turnstileToken,
        });
      }
    } catch (error) {
      console.error("Feedback submission failed:", error);
      setStatus("idle");
      setError("Something went wrong. Try again.");
      return;
    }

    localStorage.setItem(FEEDBACK_STORAGE_KEY, "true");
    setStatus("sent");
    setMessage("");
    setIsOpen(true);
  };

  const handleBubbleClick = () => {
    setIsOpen((prev) => {
      const next = !prev;
      if (next && status === "sent") {
        setStatus("idle");
        setError(null);
        setMessage("");
        setHoneypot("");
      }
      return next;
    });
  };

  const handleSendAnother = () => {
    setStatus("idle");
    setError(null);
    setMessage("");
    setHoneypot("");
    setIsOpen(true);
  };

  if (!isEligible && status !== "sent") return null;

  return (
    <div
      ref={widgetRef}
      className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2 sm:bottom-6 sm:right-6"
    >
      {isOpen && (
        <div className="w-[320px] max-w-[calc(100vw-2rem)] rounded-2xl border border-black/10 bg-white p-4 text-sm text-gray-700 shadow-[0_18px_40px_rgba(15,23,42,0.15)]">
          {status === "sent" ? (
            <div className="space-y-3">
              <div className="text-sm text-gray-800">{THANK_YOU_TEXT}</div>
              <Button size="sm" variant="outline" onClick={handleSendAnother}>
                Send another
              </Button>
            </div>
          ) : (
            <>
              <div className="text-sm font-semibold text-gray-900">{QUESTION_TEXT}</div>
              <textarea
                className="mt-3 min-h-[120px] w-full resize-none rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-black focus:outline-none"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Missing anime? Wrong time? Something confusing?"
                maxLength={1000}
                rows={5}
              />
              <input
                type="text"
                name="company"
                value={honeypot}
                onChange={(event) => setHoneypot(event.target.value)}
                tabIndex={-1}
                autoComplete="off"
                className="absolute left-[-9999px] h-0 w-0 overflow-hidden"
                aria-hidden="true"
              />
              {error && <div className="mt-2 text-xs text-red-600">{error}</div>}
              <div className="mt-3 flex justify-end">
                <Button
                  size="sm"
                  onClick={handleSend}
                  disabled={!message.trim() || status === "submitting"}
                >
                  {status === "submitting" ? "Sending..." : "Send"}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
      {siteKey && (
        <div
          ref={turnstileContainerRef}
          className="absolute left-[-9999px] top-0 h-0 w-0 overflow-hidden"
        />
      )}
      <button
        type="button"
        onClick={handleBubbleClick}
        className="inline-flex items-center gap-2 rounded-full border border-black bg-black px-4 py-2 text-xs font-semibold text-white shadow-[0_12px_24px_rgba(15,23,42,0.18)] transition hover:-translate-y-0.5 hover:bg-black/90"
        aria-expanded={isOpen}
        aria-label={BUBBLE_TEXT}
      >
        <span>{BUBBLE_TEXT}</span>
      </button>
    </div>
  );
}
