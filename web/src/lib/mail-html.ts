import DOMPurify from 'dompurify'

// Mail HTML is written by strangers, so it is never put on the page itself.
// It is cleaned, and then shown inside a sandboxed frame with its own content
// security policy. Both layers are meant to hold on their own:
//
// - The cleaning removes scripts, forms, embedded frames, and event handlers.
// - The frame's sandbox has no "allow-scripts", so nothing could run anyway.
// - The policy blocks everything remote. Images are the one thing that can be
//   switched on, because loading one tells the sender that the mail was read.

const FORBIDDEN_TAGS = [
  'script',
  'iframe',
  'frame',
  'frameset',
  'object',
  'embed',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'meta',
  'link',
  'base',
]

let hooked = false

function cleanHtml(html: string) {
  if (!hooked) {
    hooked = true
    // Links open in a new tab and never hand over the opener.
    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
      if (node.tagName === 'A') {
        node.setAttribute('target', '_blank')
        node.setAttribute('rel', 'noopener noreferrer nofollow')
      }
    })
  }
  return DOMPurify.sanitize(html, {
    FORBID_TAGS: FORBIDDEN_TAGS,
    ALLOW_DATA_ATTR: false,
  })
}

// A complete page for the frame.
export function buildMailDocument(html: string, showImages: boolean) {
  const policy = [
    "default-src 'none'",
    `img-src data:${showImages ? ' https:' : ''}`,
    "style-src 'unsafe-inline'",
    'font-src data:',
  ].join('; ')

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${policy}">
<base target="_blank">
<style>
  html { background: #fff; color: #111; }
  body { margin: 0; padding: 12px; font: 14px/1.5 system-ui, sans-serif; overflow-wrap: anywhere; }
  img { max-width: 100%; height: auto; }
  table { max-width: 100%; }
</style>
</head>
<body>${cleanHtml(html)}</body>
</html>`
}

// Finds web links in plain text, for making them clickable. The trailing
// punctuation of a sentence isn't part of the link.
export const URL_PATTERN = /(https?:\/\/[^\s<>"]*[^\s<>".,;:!?)\]])/g
