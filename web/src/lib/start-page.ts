// Which page the app opens on at "/", chosen per device. A wall-mounted tablet
// can start on Hem while a phone starts on Idag. The choice is only a
// preference, so it lives in this browser and never leaves the device.
const KEY = 'life-app:start-page'

export type StartPage = 'today' | 'home'

export const startPagePaths: Record<StartPage, string> = {
  today: '/idag',
  home: '/hem',
}

export function getStartPage(): StartPage {
  try {
    return localStorage.getItem(KEY) === 'home' ? 'home' : 'today'
  } catch {
    // Storage can be blocked, for example in a private window.
    return 'today'
  }
}

export function setStartPage(page: StartPage) {
  try {
    localStorage.setItem(KEY, page)
  } catch {
    // Nothing to do: the device just keeps using the default.
  }
}
