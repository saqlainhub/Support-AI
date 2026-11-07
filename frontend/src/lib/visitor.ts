
const VISITOR_ID_KEY = "customer_support_visitor_id";

export function getVisitorId(): string {
  if (typeof window === "undefined") {
    throw new Error("Visitor ID can only be accessed in the browser.");
  }

  let visitorId = window.localStorage.getItem(VISITOR_ID_KEY);

  if (!visitorId) {
    visitorId =
      typeof window.crypto.randomUUID === "function"
        ? window.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    window.localStorage.setItem(VISITOR_ID_KEY, visitorId);
  }

  return visitorId;
}