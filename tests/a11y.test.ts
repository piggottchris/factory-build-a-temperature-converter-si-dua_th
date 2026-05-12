/**
 * Issue #11: Screen-reader live-region accessibility tests
 *
 * Verifies:
 * 1. index.html has the two SR live-region elements with correct ARIA attributes
 * 2. src/styles.css has the .sr-only visually-hidden rule (clip-path + position absolute)
 * 3. The debounced announcer: typing rapidly leaves live regions silent;
 *    after 400 ms idle, the correct content is set.
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { JSDOM } from 'jsdom'
import { describe, it, expect, beforeAll, vi, beforeEach, afterEach } from 'vitest'
import { createAnnouncer } from '../src/announcer'
import { celsiusToFahrenheit, celsiusToKelvin, formatNumber } from '../src/convert'

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const htmlPath = resolve(__dirname, '../index.html')
const cssPath = resolve(__dirname, '../src/styles.css')

let document: Document

beforeAll(() => {
  if (!existsSync(htmlPath)) throw new Error(`index.html not found at ${htmlPath}`)
  const html = readFileSync(htmlPath, 'utf8')
  const dom = new JSDOM(html)
  document = dom.window.document
})

// ---------------------------------------------------------------------------
// DOM additions — index.html
// ---------------------------------------------------------------------------

describe('SR live-region elements in index.html', () => {
  it('has #sr-result element in the document', () => {
    const el = document.getElementById('sr-result')
    expect(el).not.toBeNull()
  })

  it('#sr-result has aria-live="polite"', () => {
    const el = document.getElementById('sr-result')
    expect(el?.getAttribute('aria-live')).toBe('polite')
  })

  it('#sr-result has aria-atomic="true"', () => {
    const el = document.getElementById('sr-result')
    expect(el?.getAttribute('aria-atomic')).toBe('true')
  })

  it('#sr-result has class sr-only', () => {
    const el = document.getElementById('sr-result')
    expect(el?.classList.contains('sr-only')).toBe(true)
  })

  it('#sr-result is empty on page load', () => {
    const el = document.getElementById('sr-result')
    expect(el?.textContent?.trim()).toBe('')
  })

  it('has #sr-error element in the document', () => {
    const el = document.getElementById('sr-error')
    expect(el).not.toBeNull()
  })

  it('#sr-error has aria-live="assertive"', () => {
    const el = document.getElementById('sr-error')
    expect(el?.getAttribute('aria-live')).toBe('assertive')
  })

  it('#sr-error has aria-atomic="true"', () => {
    const el = document.getElementById('sr-error')
    expect(el?.getAttribute('aria-atomic')).toBe('true')
  })

  it('#sr-error has class sr-only', () => {
    const el = document.getElementById('sr-error')
    expect(el?.classList.contains('sr-only')).toBe(true)
  })

  it('#sr-error is empty on page load', () => {
    const el = document.getElementById('sr-error')
    expect(el?.textContent?.trim()).toBe('')
  })
})

// ---------------------------------------------------------------------------
// CSS — .sr-only in src/styles.css
// ---------------------------------------------------------------------------

describe('.sr-only in src/styles.css', () => {
  let css: string

  beforeAll(() => {
    if (!existsSync(cssPath)) throw new Error(`styles.css not found at ${cssPath}`)
    css = readFileSync(cssPath, 'utf8')
  })

  it('has a .sr-only rule block', () => {
    expect(css).toMatch(/\.sr-only\s*\{/)
  })

  it('.sr-only uses position: absolute (not display:none)', () => {
    // Extract the .sr-only block and verify position:absolute inside it
    const blockMatch = css.match(/\.sr-only\s*\{([^}]*)\}/)
    expect(blockMatch).not.toBeNull()
    expect(blockMatch![1]).toMatch(/position\s*:\s*absolute/)
  })

  it('.sr-only uses clip-path for clipping (not legacy clip)', () => {
    const blockMatch = css.match(/\.sr-only\s*\{([^}]*)\}/)
    expect(blockMatch).not.toBeNull()
    expect(blockMatch![1]).toMatch(/clip-path/)
  })

  it('.sr-only clip-path value is exactly inset(50%)', () => {
    const blockMatch = css.match(/\.sr-only\s*\{([^}]*)\}/)
    expect(blockMatch).not.toBeNull()
    expect(blockMatch![1]).toMatch(/clip-path\s*:\s*inset\(50%\)/)
  })

  it('.sr-only sets width to 1px', () => {
    const blockMatch = css.match(/\.sr-only\s*\{([^}]*)\}/)
    expect(blockMatch).not.toBeNull()
    expect(blockMatch![1]).toMatch(/width\s*:\s*1px/)
  })

  it('.sr-only sets height to 1px', () => {
    const blockMatch = css.match(/\.sr-only\s*\{([^}]*)\}/)
    expect(blockMatch).not.toBeNull()
    expect(blockMatch![1]).toMatch(/height\s*:\s*1px/)
  })

  it('.sr-only sets overflow: hidden', () => {
    const blockMatch = css.match(/\.sr-only\s*\{([^}]*)\}/)
    expect(blockMatch).not.toBeNull()
    expect(blockMatch![1]).toMatch(/overflow\s*:\s*hidden/)
  })

  it('.sr-only sets white-space: nowrap', () => {
    const blockMatch = css.match(/\.sr-only\s*\{([^}]*)\}/)
    expect(blockMatch).not.toBeNull()
    expect(blockMatch![1]).toMatch(/white-space\s*:\s*nowrap/)
  })
})

// ---------------------------------------------------------------------------
// Debouncer behaviour — createAnnouncer from src/announcer.ts
// ---------------------------------------------------------------------------

describe('createAnnouncer — debounced SR updates', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  /** Minimal stand-ins for HTMLElement (only textContent needed) */
  function makeEls() {
    const srResult = { textContent: '' } as unknown as HTMLElement
    const srError = { textContent: '' } as unknown as HTMLElement
    return { srResult, srError }
  }

  it('does not update live regions before 400 ms have elapsed', () => {
    const { srResult, srError } = makeEls()
    const ann = createAnnouncer(400)

    // Simulate 5 rapid keystrokes at 50 ms intervals
    for (let i = 0; i < 5; i++) {
      ann.schedule(srResult, srError, 'valid', '212.00 °F and 373.15 K')
      vi.advanceTimersByTime(50)
    }
    // 250 ms total elapsed, but only 50 ms since the last call
    expect(srResult.textContent).toBe('')
    expect(srError.textContent).toBe('')
  })

  it('updates #sr-result after 400 ms for a valid result', () => {
    const { srResult, srError } = makeEls()
    const ann = createAnnouncer(400)

    ann.schedule(srResult, srError, 'valid', '212.00 °F and 373.15 K')
    vi.advanceTimersByTime(400)

    expect(srResult.textContent).toBe('212.00 °F and 373.15 K')
    expect(srError.textContent).toBe('')
  })

  it('clears #sr-result and sets #sr-error for invalid input after 400 ms', () => {
    const { srResult, srError } = makeEls()
    const ann = createAnnouncer(400)

    ann.schedule(srResult, srError, 'invalid', 'Invalid number format.')
    vi.advanceTimersByTime(400)

    expect(srError.textContent).toBe('Invalid number format.')
    expect(srResult.textContent).toBe('')
  })

  it('clears both regions for empty status after 400 ms', () => {
    const { srResult, srError } = makeEls()
    const ann = createAnnouncer(400)

    // Prime both with some prior content
    srResult.textContent = '212.00 °F and 373.15 K'
    srError.textContent = 'Invalid number format.'

    ann.schedule(srResult, srError, 'empty', '')
    vi.advanceTimersByTime(400)

    expect(srResult.textContent).toBe('')
    expect(srError.textContent).toBe('')
  })

  it('clears both regions for pending status after 400 ms', () => {
    const { srResult, srError } = makeEls()
    const ann = createAnnouncer(400)

    srResult.textContent = '212.00 °F and 373.15 K'
    srError.textContent = 'Invalid number format.'

    ann.schedule(srResult, srError, 'pending', '')
    vi.advanceTimersByTime(400)

    expect(srResult.textContent).toBe('')
    expect(srError.textContent).toBe('')
  })

  it('cancels the prior timer when a second call arrives before 400 ms', () => {
    const { srResult, srError } = makeEls()
    const ann = createAnnouncer(400)

    // First call
    ann.schedule(srResult, srError, 'valid', 'first announcement')
    vi.advanceTimersByTime(200) // 200 ms elapsed — timer not yet fired

    // Second call resets the 400 ms window
    ann.schedule(srResult, srError, 'valid', 'second announcement')
    vi.advanceTimersByTime(200) // 400 ms from start, but only 200 ms from last call

    // Neither fires yet
    expect(srResult.textContent).toBe('')

    // Advance past the second call's 400 ms window
    vi.advanceTimersByTime(200) // now 400 ms from second call

    // Only the second announcement fires; first is discarded
    expect(srResult.textContent).toBe('second announcement')
  })

  it('does not fire the first announcement when second replaces it', () => {
    const { srResult, srError } = makeEls()
    const ann = createAnnouncer(400)

    ann.schedule(srResult, srError, 'invalid', 'first error')
    vi.advanceTimersByTime(100)
    ann.schedule(srResult, srError, 'valid', 'second valid')
    vi.advanceTimersByTime(400)

    // Result should be from second call; error must be cleared
    expect(srResult.textContent).toBe('second valid')
    expect(srError.textContent).toBe('')
  })

  it('cancel() prevents any pending announcement from firing', () => {
    const { srResult, srError } = makeEls()
    const ann = createAnnouncer(400)

    ann.schedule(srResult, srError, 'valid', '212.00 °F and 373.15 K')
    ann.cancel()
    vi.advanceTimersByTime(1000)

    expect(srResult.textContent).toBe('')
    expect(srError.textContent).toBe('')
  })
})

// ---------------------------------------------------------------------------
// createAnnouncer — boundary cases and edge branches
// ---------------------------------------------------------------------------

describe('createAnnouncer — boundary and edge cases', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  function makeEls() {
    const srResult = { textContent: '' } as unknown as HTMLElement
    const srError = { textContent: '' } as unknown as HTMLElement
    return { srResult, srError }
  }

  it('createAnnouncer() with no argument uses 400 ms default delay', () => {
    const { srResult, srError } = makeEls()
    const ann = createAnnouncer() // no explicit delayMs

    ann.schedule(srResult, srError, 'valid', 'default delay test')

    // 399 ms — must NOT have fired yet
    vi.advanceTimersByTime(399)
    expect(srResult.textContent).toBe('')

    // 1 more ms — now at exactly 400 ms, must fire
    vi.advanceTimersByTime(1)
    expect(srResult.textContent).toBe('default delay test')
  })

  it('createAnnouncer(0) fires on the next timer tick (advanceTimersByTime(0))', () => {
    const { srResult, srError } = makeEls()
    const ann = createAnnouncer(0)

    ann.schedule(srResult, srError, 'valid', 'zero delay')

    // Has not fired yet — setTimeout(..., 0) is still async
    expect(srResult.textContent).toBe('')

    // Advancing by 0 ms flushes any 0-delay timers
    vi.advanceTimersByTime(0)
    expect(srResult.textContent).toBe('zero delay')
  })

  it('cancel() is a no-op when no timer is pending (does not throw)', () => {
    const ann = createAnnouncer(400)
    // No schedule() call has been made — timerId is null
    expect(() => ann.cancel()).not.toThrow()
  })

  it('cancel() after a prior cancel() is also a no-op (does not throw)', () => {
    const { srResult, srError } = makeEls()
    const ann = createAnnouncer(400)

    ann.schedule(srResult, srError, 'valid', 'test')
    ann.cancel() // first cancel — clears the timer
    expect(() => ann.cancel()).not.toThrow() // second cancel — timerId already null
  })

  it('multiple schedule() calls at the same instant only fires the last one', () => {
    const { srResult, srError } = makeEls()
    const ann = createAnnouncer(400)

    // Three calls with no time elapsed between them
    ann.schedule(srResult, srError, 'invalid', 'first')
    ann.schedule(srResult, srError, 'invalid', 'second')
    ann.schedule(srResult, srError, 'valid', 'third')

    vi.advanceTimersByTime(400)

    // Only the third call's state wins
    expect(srResult.textContent).toBe('third')
    expect(srError.textContent).toBe('')
  })

  it('schedule() after cancel() works correctly (restarts the timer)', () => {
    const { srResult, srError } = makeEls()
    const ann = createAnnouncer(400)

    ann.schedule(srResult, srError, 'valid', 'before cancel')
    ann.cancel()

    // A new schedule() after cancel() should work normally
    ann.schedule(srResult, srError, 'valid', 'after cancel')
    vi.advanceTimersByTime(400)

    expect(srResult.textContent).toBe('after cancel')
    expect(srError.textContent).toBe('')
  })
})

// ---------------------------------------------------------------------------
// SR announcement message format — self-contained messages for screen readers
// ---------------------------------------------------------------------------

describe('SR announcement message format', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  function makeEls() {
    const srResult = { textContent: '' } as unknown as HTMLElement
    const srError = { textContent: '' } as unknown as HTMLElement
    return { srResult, srError }
  }

  it('valid announcement includes source Celsius value', () => {
    // Verify the message format that main.ts should produce:
    // "<C> °C = <F> °F and <K> K"  — self-contained for SR users
    const celsius = 100
    const fahr = celsiusToFahrenheit(celsius)
    const kelv = celsiusToKelvin(celsius)
    const msg = `${formatNumber(celsius)} °C = ${formatNumber(fahr)} °F and ${formatNumber(kelv)} K`

    const { srResult, srError } = makeEls()
    const ann = createAnnouncer(400)
    ann.schedule(srResult, srError, 'valid', msg)
    vi.advanceTimersByTime(400)

    // The announcement must include the source unit so it is self-contained
    expect(srResult.textContent).toContain('°C')
    expect(srResult.textContent).toContain('°F')
    expect(srResult.textContent).toContain('K')
    expect(srResult.textContent).toMatch(/\d+\.?\d*\s*°C\s*=\s*\d+\.?\d*\s*°F/)
  })

  it('valid announcement for 0 °C reads "0.00 °C = 32.00 °F and 273.15 K"', () => {
    const celsius = 0
    const fahr = celsiusToFahrenheit(celsius)
    const kelv = celsiusToKelvin(celsius)
    const msg = `${formatNumber(celsius)} °C = ${formatNumber(fahr)} °F and ${formatNumber(kelv)} K`

    expect(msg).toBe('0.00 °C = 32.00 °F and 273.15 K')
  })

  it('valid announcement for 100 °C reads "100.00 °C = 212.00 °F and 373.15 K"', () => {
    const celsius = 100
    const fahr = celsiusToFahrenheit(celsius)
    const kelv = celsiusToKelvin(celsius)
    const msg = `${formatNumber(celsius)} °C = ${formatNumber(fahr)} °F and ${formatNumber(kelv)} K`

    expect(msg).toBe('100.00 °C = 212.00 °F and 373.15 K')
  })

  it('valid announcement for -40 °C (crossover point) includes negative Celsius', () => {
    const celsius = -40
    const fahr = celsiusToFahrenheit(celsius)
    const kelv = celsiusToKelvin(celsius)
    const msg = `${formatNumber(celsius)} °C = ${formatNumber(fahr)} °F and ${formatNumber(kelv)} K`

    expect(msg).toContain('-40.00 °C')
    expect(msg).toContain('-40.00 °F')
  })
})
