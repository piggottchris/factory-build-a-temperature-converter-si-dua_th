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
// Content Security Policy
// ---------------------------------------------------------------------------
describe('Content-Security-Policy meta tag', () => {
  it('has a CSP meta http-equiv tag', () => {
    const csp = document.querySelector('meta[http-equiv="Content-Security-Policy"]')
    expect(csp).not.toBeNull()
  })

  it("CSP disallows default-src 'none'", () => {
    const csp = document.querySelector('meta[http-equiv="Content-Security-Policy"]')
    expect(csp?.getAttribute('content')).toMatch(/default-src\s+'none'/)
  })

  it("CSP restricts script-src to 'self' only", () => {
    const csp = document.querySelector('meta[http-equiv="Content-Security-Policy"]')
    const content = csp?.getAttribute('content') ?? ''
    expect(content).toMatch(/script-src\s+'self'/)
    // Must NOT allow unsafe-inline or unsafe-eval
    expect(content).not.toMatch(/unsafe-inline/)
    expect(content).not.toMatch(/unsafe-eval/)
  })

  it("CSP sets frame-ancestors 'none' (clickjacking defence)", () => {
    const csp = document.querySelector('meta[http-equiv="Content-Security-Policy"]')
    expect(csp?.getAttribute('content')).toMatch(/frame-ancestors\s+'none'/)
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

  it('#celsius-input placeholder is exactly "e.g. 100"', () => {
    const input = document.querySelector<HTMLInputElement>('#celsius-input')
    expect(input).not.toBeNull()
    expect(input!.getAttribute('placeholder')).toBe('e.g. 100')
  })

  it('#celsius-input has aria-describedby referencing "celsius-helper" and "celsius-error"', () => {
    const input = document.querySelector<HTMLInputElement>('#celsius-input')
    const describedby = input!.getAttribute('aria-describedby') ?? ''
    const ids = describedby.trim().split(/\s+/)
    expect(ids).toContain('celsius-helper')
    expect(ids).toContain('celsius-error')
  })
})

// ---------------------------------------------------------------------------
// Helper text, error slot, empty hint
// ---------------------------------------------------------------------------
describe('helper and hint elements', () => {
  it('has helper-text element with exact copy', () => {
    const helperEl = document.getElementById('celsius-helper')
    expect(helperEl).not.toBeNull()
    // Normalize whitespace so HTML entity rendering differences don't break the assertion
    const text = helperEl!.textContent?.replace(/\s+/g, ' ').trim() ?? ''
    expect(text).toBe('Decimals and negatives OK. Use “.” as the decimal point.')
  })

  it('#celsius-error is present in the DOM with the hidden attribute', () => {
    const errorEl = document.getElementById('celsius-error')
    expect(errorEl).not.toBeNull()
    expect(errorEl!.hasAttribute('hidden')).toBe(true)
  })

  it('#celsius-error has aria-live="polite"', () => {
    const errorEl = document.getElementById('celsius-error')
    expect(errorEl).not.toBeNull()
    expect(errorEl!.getAttribute('aria-live')).toBe('polite')
  })

  it('#celsius-hint has role="status"', () => {
    const hintEl = document.getElementById('celsius-hint')
    expect(hintEl).not.toBeNull()
    expect(hintEl!.getAttribute('role')).toBe('status')
  })

  it('has empty-hint element with "Enter a temperature in Celsius"', () => {
    const hintEl = document.getElementById('celsius-hint')
    expect(hintEl).not.toBeNull()
    expect(hintEl!.textContent?.trim()).toBe('Enter a temperature in Celsius')
  })
})

// ---------------------------------------------------------------------------
// Output rows — semantic structure and exact copy
// ---------------------------------------------------------------------------
describe('output rows', () => {
  it('uses a <dl> element for the results list', () => {
    const dl = document.querySelector('dl.results')
    expect(dl).not.toBeNull()
  })

  it('has exactly two <dt> label elements inside the results <dl>', () => {
    const dts = document.querySelectorAll('dl.results dt')
    expect(dts.length).toBe(2)
  })

  it('has exactly two <dd> value elements inside the results <dl>', () => {
    const dds = document.querySelectorAll('dl.results dd')
    expect(dds.length).toBe(2)
  })

  it('Fahrenheit <dt> label text is exactly "Fahrenheit (°F)"', () => {
    const dts = Array.from(document.querySelectorAll('dl.results dt'))
    const fahr = dts.find(dt => dt.textContent?.trim() === 'Fahrenheit (°F)')
    expect(fahr).not.toBeNull()
  })

  it('Kelvin <dt> label text is exactly "Kelvin (K)"', () => {
    const dts = Array.from(document.querySelectorAll('dl.results dt'))
    const kelvin = dts.find(dt => dt.textContent?.trim() === 'Kelvin (K)')
    expect(kelvin).not.toBeNull()
  })

  it('#fahrenheit-output <dd> starts with the em-dash placeholder', () => {
    const dd = document.getElementById('fahrenheit-output')
    expect(dd).not.toBeNull()
    expect(dd!.textContent?.trim()).toBe('—')
  })

  it('#kelvin-output <dd> starts with the em-dash placeholder', () => {
    const dd = document.getElementById('kelvin-output')
    expect(dd).not.toBeNull()
    expect(dd!.textContent?.trim()).toBe('—')
  })

  it('#fahrenheit-output and #kelvin-output carry the empty-state CSS modifier', () => {
    const fahr = document.getElementById('fahrenheit-output')
    const kelvin = document.getElementById('kelvin-output')
    expect(fahr!.classList.contains('results__value--empty')).toBe(true)
    expect(kelvin!.classList.contains('results__value--empty')).toBe(true)
  })
})
