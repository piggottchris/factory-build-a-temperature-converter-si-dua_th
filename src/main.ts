/**
 * DOM wiring for the temperature converter (issues #6 + #11).
 *
 * Visible output rows update **synchronously** on every input event so
 * sighted users see instant feedback.  Screen-reader live regions are
 * written only after the user has paused for 400 ms (debounced), so
 * assistive technology is not flooded with partial values on each keystroke.
 */
import { parseCelsius, celsiusToFahrenheit, celsiusToKelvin, formatNumber } from './convert'
import { createAnnouncer } from './announcer'

// ---------------------------------------------------------------------------
// DOM references
// ---------------------------------------------------------------------------

const input = document.getElementById('celsius-input') as HTMLInputElement | null
const fahrenheitOutput = document.getElementById('fahrenheit-output')
const kelvinOutput = document.getElementById('kelvin-output')
const errorEl = document.getElementById('celsius-error')
const hintEl = document.getElementById('celsius-hint')
const srResult = document.getElementById('sr-result') as HTMLElement | null
const srError = document.getElementById('sr-error') as HTMLElement | null

if (!input || !fahrenheitOutput || !kelvinOutput || !errorEl || !hintEl || !srResult || !srError) {
  // Guard against mismatched HTML — fail loudly in development.
  throw new Error(
    'Temperature converter: required DOM element(s) missing. ' +
      'Check that index.html includes #celsius-input, #fahrenheit-output, ' +
      '#kelvin-output, #celsius-error, #celsius-hint, #sr-result, #sr-error.',
  )
}

// ---------------------------------------------------------------------------
// SR announcer (400 ms debounce)
// ---------------------------------------------------------------------------

const announcer = createAnnouncer(400)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setOutputEmpty() {
  fahrenheitOutput!.textContent = '—' // em-dash
  kelvinOutput!.textContent = '—'
  fahrenheitOutput!.classList.add('results__value--empty')
  kelvinOutput!.classList.add('results__value--empty')
}

function setOutputValues(fahr: number, kelv: number) {
  fahrenheitOutput!.textContent = `${formatNumber(fahr)} °F`
  kelvinOutput!.textContent = `${formatNumber(kelv)} K`
  fahrenheitOutput!.classList.remove('results__value--empty')
  kelvinOutput!.classList.remove('results__value--empty')
}

// ---------------------------------------------------------------------------
// Input handler
// ---------------------------------------------------------------------------

input.addEventListener('input', () => {
  const parsed = parseCelsius(input!.value)

  if (parsed.state === 'valid') {
    const fahr = celsiusToFahrenheit(parsed.value)
    const kelv = celsiusToKelvin(parsed.value)

    // Immediate visible update
    setOutputValues(fahr, kelv)
    errorEl!.hidden = true
    errorEl!.textContent = ''
    hintEl!.textContent = ''
    input!.removeAttribute('aria-invalid')

    // Debounced SR announcement
    announcer.schedule(
      srResult!,
      srError!,
      'valid',
      `${formatNumber(fahr)} °F and ${formatNumber(kelv)} K`,
    )
  } else if (parsed.state === 'invalid') {
    const msg =
      parsed.reason === 'range'
        ? 'Value out of range. Enter a number between −1 000 000 and 1 000 000.'
        : 'Invalid number format. Use digits, an optional leading minus, and a decimal point.'

    // Immediate visible update
    setOutputEmpty()
    errorEl!.hidden = false
    errorEl!.textContent = msg
    hintEl!.textContent = ''
    input!.setAttribute('aria-invalid', 'true')

    // Debounced SR announcement
    announcer.schedule(srResult!, srError!, 'invalid', msg)
  } else if (parsed.state === 'empty') {
    // Immediate visible update
    setOutputEmpty()
    errorEl!.hidden = true
    errorEl!.textContent = ''
    hintEl!.textContent = 'Enter a temperature in Celsius'
    input!.removeAttribute('aria-invalid')

    // Debounced SR announcement
    announcer.schedule(srResult!, srError!, 'empty', '')
  } else {
    // pending — user is mid-entry (e.g. "-", "1.", "-.5")
    // Immediate visible update: keep outputs in empty state, no error shown
    setOutputEmpty()
    errorEl!.hidden = true
    errorEl!.textContent = ''
    hintEl!.textContent = ''
    input!.removeAttribute('aria-invalid')

    // Debounced SR announcement (clears both regions)
    announcer.schedule(srResult!, srError!, 'pending', '')
  }
})
