// Speech to text through the browser's own recognition. In Chrome the audio is
// sent to Google for transcription. The app only uses this one function, so a
// Whisper server can replace it later without touching the pages.

type RecognitionResult = {
  isFinal: boolean
  0: { transcript: string }
}

type Recognition = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: { results: ArrayLike<RecognitionResult> }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}

type RecognitionConstructor = new () => Recognition

function constructor(): RecognitionConstructor | undefined {
  const w = window as unknown as {
    SpeechRecognition?: RecognitionConstructor
    webkitSpeechRecognition?: RecognitionConstructor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

export const speechSupported = () => constructor() !== undefined

export type Listening = {
  // Stop and still deliver what was heard.
  stop: () => void
  // Stop and throw it away.
  cancel: () => void
}

// `onText` gets the whole transcript so far. `onEnd` runs once, last, with the
// final text and an error code if recognition failed ("not-allowed" means the
// microphone is blocked).
export function startListening(handlers: {
  onText?: (text: string) => void
  onEnd: (text: string, error: string | null) => void
}): Listening | null {
  const Recognizer = constructor()
  if (!Recognizer) return null

  const recognition = new Recognizer()
  recognition.lang = 'sv-SE'
  recognition.continuous = false
  recognition.interimResults = true

  let text = ''
  let error: string | null = null
  let cancelled = false

  recognition.onresult = (event) => {
    text = Array.from(event.results)
      .map((result) => result[0].transcript)
      .join('')
      .trim()
    handlers.onText?.(text)
  }
  recognition.onerror = (event) => {
    // "no-speech" and "aborted" just mean nothing was said.
    if (event.error !== 'no-speech' && event.error !== 'aborted') {
      error = event.error
    }
  }
  recognition.onend = () => {
    if (!cancelled) handlers.onEnd(text, error)
  }

  try {
    recognition.start()
  } catch {
    return null
  }

  return {
    stop: () => recognition.stop(),
    cancel: () => {
      cancelled = true
      recognition.abort()
    },
  }
}

export function speechErrorMessage(code: string) {
  if (code === 'not-allowed' || code === 'service-not-allowed') {
    return 'Mikrofonen är blockerad. Tillåt den i webbläsarens inställningar.'
  }
  if (code === 'network') return 'Taligenkänningen kan inte nå sin tjänst.'
  return 'Taligenkänningen misslyckades.'
}
