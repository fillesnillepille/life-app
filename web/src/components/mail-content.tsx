import { useEffect, useMemo, useRef, useState } from 'react'
import { buildMailDocument, URL_PATTERN } from '@/lib/mail-html'

// A message's plain text, with web links made clickable.
export function MailText({ text }: { text: string }) {
  const parts = text.split(URL_PATTERN)
  return (
    <div className="text-sm leading-relaxed break-words whitespace-pre-wrap">
      {parts.map((part, index) =>
        // The split keeps the links at the odd positions.
        index % 2 === 1 ? (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="text-primary underline underline-offset-4"
          >
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </div>
  )
}

// A message's own HTML, in a frame that can't run scripts or load anything
// from the internet unless images are switched on.
export function MailHtml({
  html,
  showImages,
}: {
  html: string
  showImages: boolean
}) {
  const frame = useRef<HTMLIFrameElement>(null)
  const observer = useRef<ResizeObserver | null>(null)
  const [height, setHeight] = useState(120)
  const srcDoc = useMemo(
    () => buildMailDocument(html, showImages),
    [html, showImages],
  )

  // Stop watching the old document when the frame is replaced or removed.
  useEffect(() => () => observer.current?.disconnect(), [srcDoc])

  return (
    <iframe
      ref={frame}
      title="Mejlets innehåll"
      srcDoc={srcDoc}
      // No "allow-scripts": nothing in the message can run. "allow-same-origin"
      // is only so the height can be measured, and is harmless without scripts.
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      referrerPolicy="no-referrer"
      onLoad={() => {
        // Fit the frame to the message, now and whenever it changes size,
        // for example when images arrive.
        const body = frame.current?.contentDocument?.body
        if (!body) return
        observer.current?.disconnect()
        observer.current = new ResizeObserver(() =>
          setHeight(Math.ceil(body.getBoundingClientRect().height)),
        )
        observer.current.observe(body)
      }}
      style={{ height }}
      className="block w-full rounded-lg bg-white"
    />
  )
}
