import type { Bucket, MailMessage, MailRecord } from "./types.ts";

// Rules that sort mail without any AI. Each list is plain data, so it is easy
// to extend. Matching is case-insensitive.

// One-time codes, login links, and password resets. They go in their own
// bucket, "Koder", and are sensitive: no snippet is kept, and they must never
// be sent to any AI.
const CODE_SUBJECT = [
  "engångskod",
  "engångslösenord",
  "verifieringskod",
  "säkerhetskod",
  "bekräftelsekod",
  "inloggningskod",
  "verification code",
  "security code",
  "login code",
  "sign-in code",
  "one-time",
  "your code",
  "din kod",
  "återställ lösenord",
  "nytt lösenord",
  "reset your password",
  "password reset",
  "verify your email",
  "bekräfta din e-post",
  "bankid",
  "password",
];

// Mail from banks and public authorities is sensitive too, but sorted like
// any other mail.
const SENSITIVE_SENDER = [
  "swedbank",
  "handelsbanken",
  "seb.se",
  "nordea",
  "danskebank",
  "lansforsakringar",
  "icabanken",
  "skandia",
  "avanza",
  "klarna",
  "swish",
  "skatteverket",
  "forsakringskassan",
  "csn.se",
  "1177",
  "mina meddelanden",
];

const PROMOTION = [
  "rabatt",
  "erbjudande",
  "kampanj",
  "extrapris",
  "sale",
  "deal",
  "spara ",
  "% off",
  "% rabatt",
  "fri frakt",
  "gratis frakt",
  "limited time",
  "nu med",
];
const INVOICE = [
  "faktura",
  "invoice",
  "betalningspåminnelse",
  "påminnelse om betalning",
  "förfaller",
  "förfallodatum",
  "att betala",
  "kvitto",
  "receipt",
  "betalning mottagen",
  "purchase",
];
const DELIVERY = [
  "paket",
  "leverans",
  "skickad",
  "har skickats",
  "på väg",
  "spårning",
  "tracking",
  "avi ",
  "utlämning",
  "ditt paket",
  "din order",
  "din beställning",
  "order confirmation",
  "orderbekräftelse",
  "shipped",
  "delivery",
  "beställt",
  "levereras",
];
const DELIVERY_SENDER = [
  "postnord",
  "dhl",
  "ups.com",
  "schenker",
  "bring.",
  "instabox",
  "budbee",
  "airmee",
  "fedex",
  "earlybird",
];
const BOOKING = [
  "bokning",
  "booking",
  "bokningsbekräftelse",
  "reservation",
  "biljett",
  "ticket",
  "din tid",
  "avbokning",
  "påminnelse om din tid",
  "check-in",
  "resa till",
  "appointment",
];

const NO_REPLY =
  /(^|[^a-z])(no-?reply|do-?not-?reply|donotreply|notifications?|mailer|bounce)([^a-z]|$)/;

function includesAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

export type Classification = Pick<MailRecord, "bucket" | "sensitive" | "bulk">;

export function classify(message: MailMessage): Classification {
  const subject = message.subject.toLowerCase();
  const sender = `${message.fromAddress} ${message.fromName}`.toLowerCase();
  const bulk =
    message.headers.listUnsubscribe ||
    message.headers.listId ||
    /bulk|list|junk/.test(message.headers.precedence.toLowerCase());
  const automated =
    bulk ||
    message.headers.autoSubmitted ||
    NO_REPLY.test(message.fromAddress.toLowerCase());

  const isCode = includesAny(subject, CODE_SUBJECT);
  const sensitive = isCode || includesAny(sender, SENSITIVE_SENDER);

  const pick = (bucket: Bucket): Classification => ({
    bucket,
    sensitive,
    bulk,
  });

  // Codes first: a login code is never an invoice or a newsletter, even from a
  // sender that sends those too.
  if (isCode) return pick("codes");

  // Bulk mail with sales language is advertising, whatever else it mentions.
  if (bulk && includesAny(subject, PROMOTION)) return pick("promotions");
  if (includesAny(subject, INVOICE)) return pick("invoices");
  if (includesAny(subject, DELIVERY) || includesAny(sender, DELIVERY_SENDER)) {
    return pick("deliveries");
  }
  if (includesAny(subject, BOOKING)) return pick("bookings");
  if (bulk) return pick("newsletters");
  // Mail from a person, rather than a system, is the most likely to matter.
  if (!automated) return pick("important");
  if (message.labels.includes("\\Important")) return pick("important");
  return pick("other");
}

// The record the app stores. Sensitive mail keeps no snippet at all.
export function toRecord(message: MailMessage): MailRecord {
  const { bucket, sensitive, bulk } = classify(message);
  return {
    uid: message.uid,
    uidValidity: message.uidValidity,
    messageId: message.messageId,
    threadId: message.threadId,
    fromAddress: message.fromAddress,
    fromName: message.fromName,
    subject: message.subject,
    date: message.date,
    snippet: sensitive ? "" : message.body,
    bucket,
    seen: message.seen,
    sensitive,
    bulk,
  };
}
