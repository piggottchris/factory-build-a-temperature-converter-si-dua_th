/**
 * Issue #4: static card structure and base styles
 *
 * Verifies that index.html satisfies all structural requirements
 * from the issue spec before any JavaScript logic is wired.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { JSDOM } from 'jsdom'
import { describe, it, expect, beforeAll } from 'vitest'

const htmlPath = resolve(__dirname, '../index.html')

let document: Document

beforeAll(() => {
  const html = readFileSync(htmlPath, 'utf8')
  const dom = new JSDOM(html)
  document = dom.window.document
})

// ---------------------------------------------------------------------------
// <head> metadata
// ---------------------------------------------------------------------------
describe('head metadata', () => {
  it('has title "Temperature Converter"', () => {
    expect(document.title).toBe('Temperature Converter')
  })

  it('has meta description with privacy-safe copy', () => {
    const meta = document.querySelector('meta[name="description"]')
    expect(meta).not.toBeNull()
    expect(meta!.getAttribute('content')).toBe(
      'Convert Celsius to Fahrenheit and Kelvin instantly. No tracking, no accounts.',
    )
  })

  it('has meta theme-color #f5f5f7', () => {
    const meta = document.querySelector('meta[name="theme-color"]')
    expect(meta).not.toBeNull()
    expect(meta!.getAttribute('content')).toBe('#f5f5f7')
  })
})

// ---------------------------------------------------------------------------
// External assets only — no inline script or style
// ---------------------------------------------------------------------------
describe('no inline scripts or styles', () => {
  it('has no inline <style> elements', () => {
    const styles = document.querySelectorAll('style')
    expect(styles.length).toBe(0)
  })

  it('has external <link rel="stylesheet"> for CSS', () => {
    const link = document.querySelector('link[rel="stylesheet"]')
    expect(link).not.toBeNull()
    const href = link!.getAttribute('href') ?? ''
    expect(href.length).toBeGreaterThan(0)
  })

  it('has no inline script content', () => {
    const scripts = document.querySelectorAll('script')
    for (const s of Array.from(scripts)) {
      expect(s.textContent?.trim()).toBe('')
    }
  })

  it('has external <script type="module"> pointing to main.ts', () => {
    const script = document.querySelector('script[type="module"]')
    expect(script).not.toBeNull()
    const src = script!.getAttribute('src') ?? ''
    expect(src).toMatch(/main\.ts/)
  })
})

// ---------------------------------------------------------------------------
// Card heading
// ---------------------------------------------------------------------------
describe('card heading', () => {
  it('has a heading with text "Temperature Converter"', () => {
    const heading = document.querySelector('h1, h2')
    expect(heading).not.toBeNull()
    expect(heading!.textContent?.trim()).toBe('Temperature Converter')
  })
})

// ---------------------------------------------------------------------------
// Celsius input
// ---------------------------------------------------------------------------
describe('celsius input', () => {
  it('has <label for="celsius-input"> with correct text', () => {
    const label = document.querySelector('label[for="celsius-input"]')
    expect(label).not.toBeNull()
    expect(label!.textContent?.trim()).toContain('Celsius')
    expect(label!.textContent?.trim()).toContain('°C')
  })

  it('has <input id="celsius-input"> with required attributes', () => {
    const input = document.querySelector<HTMLInputElement>('#celsius-input')
    expect(input).not.toBeNull()
    expect(input!.getAttribute('type')).toBe('text')
    expect(input!.getAttribute('inputmode')).toBe('decimal')
    expect(input!.getAttribute('autocomplete')).toBe('off')
    expect(input!.getAttribute('maxlength')).toBe('32')
    expect(input!.getAttribute('enterkeyhint')).toBe('done')
    expect(input!.getAttribute('placeholder')).toBeTruthy()
  })

  it('#celsius-input has aria-describedby referencing helper-text and error-slot', () => {
    const input = document.querySelector<HTMLInputElement>('#celsius-input')
    const describedby = input!.getAttribute('aria-describedby') ?? ''
    expect(describedby.length).toBeGreaterThan(0)
    // Must reference at least 2 IDs (helper-text and error-slot)
    const ids = describedby.trim().split(/\s+/)
    expect(ids.length).toBeGreaterThanOrEqual(2)
  })
})

// ---------------------------------------------------------------------------
// Helper text, error slot, empty hint
// ---------------------------------------------------------------------------
describe('helper and hint elements', () => {
  it('has helper-text element with decimal/negative guidance', () => {
    const input = document.querySelector<HTMLInputElement>('#celsius-input')
    const describedby = input!.getAttribute('aria-describedby') ?? ''
    const helperIds = describedby.trim().split(/\s+/)

    // At least one referenced element should contain decimal guidance
    const helperEl = helperIds
      .map(id => document.getElementById(id))
      .find(el => el?.textContent?.includes('decimal') || el?.textContent?.includes('Decimal'))

    expect(helperEl).not.toBeNull()
    expect(helperEl!.textContent).toMatch(/decimal/i)
  })

  it('has a hidden error-slot element (in DOM but not shown)', () => {
    // Error slot must exist in the DOM; the spec says it is hidden
    const input = document.querySelector<HTMLInputElement>('#celsius-input')
    const describedby = input!.getAttribute('aria-describedby') ?? ''
    const ids = describedby.trim().split(/\s+/)

    const errorEl = ids
      .map(id => document.getElementById(id))
      .find(el => el !== null && (
        el.hasAttribute('hidden') ||
        el.getAttribute('aria-hidden') === 'true' ||
        el.getAttribute('data-state') === 'hidden' ||
        el.id.includes('error')
      ))

    expect(errorEl).not.toBeNull()
  })

  it('has empty-hint element with "Enter a temperature in Celsius"', () => {
    // Find by text content
    const all = Array.from(document.querySelectorAll('*'))
    const hintEl = all.find(
      el =>
        el.textContent?.trim() === 'Enter a temperature in Celsius' &&
        el.children.length === 0,
    )
    expect(hintEl).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Output rows
// ---------------------------------------------------------------------------
describe('output rows', () => {
  it('has a Fahrenheit output row with label and em-dash placeholder', () => {
    const body = document.body.textContent ?? ''
    expect(body).toMatch(/Fahrenheit/)
    expect(body).toMatch(/°F/)
    expect(body).toMatch(/—/)
  })

  it('has a Kelvin output row with label and em-dash placeholder', () => {
    const body = document.body.textContent ?? ''
    expect(body).toMatch(/Kelvin/)
    expect(body).toMatch(/\bK\b/)
    expect(body).toMatch(/—/)
  })
})
