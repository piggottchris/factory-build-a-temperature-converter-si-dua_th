/**
 * src/main.ts — DOM wiring for the temperature converter (issue #10: ARIA)
 *
 * Exports setInputAriaError() so unit tests can call it directly without a
 * real DOM; the bottom of this file does the actual browser-side wiring.
 */

/**
 * Update #celsius-input's aria-describedby to include or exclude
 * the error-slot ID based on whether an error is currently active.
 *
 * Rules:
 *   hasError = false → aria-describedby="celsius-helper"
 *   hasError = true  → aria-describedby="celsius-helper celsius-error"
 *
 * The helper-text ID is always present so screen readers always have
 * access to the usage hint regardless of validation state.
 */
export function setInputAriaError(
  input: HTMLInputElement,
  hasError: boolean,
): void {
  const base    = 'celsius-helper'
  const errorId = 'celsius-error'
  input.setAttribute(
    'aria-describedby',
    hasError ? `${base} ${errorId}` : base,
  )
}

// ---------------------------------------------------------------------------
// Browser-side wiring — only runs when executed in a real browser context.
// Skipped when imported in Node/vitest so DOM calls don't throw.
// ---------------------------------------------------------------------------
if (typeof document !== 'undefined') {
  const input   = document.querySelector<HTMLInputElement>('#celsius-input')
  const errorEl = document.querySelector<HTMLElement>('#celsius-error')

  // Initialise: aria-describedby should only reference the helper (no error)
  if (input) {
    setInputAriaError(input, false)
  }

  // Wire up sign-toggle button (±) — toggles negative/positive prefix
  const signToggle = document.querySelector<HTMLButtonElement>('#sign-toggle')
  if (input && signToggle) {
    signToggle.addEventListener('click', () => {
      if (input.value.startsWith('-')) {
        input.value = input.value.slice(1)
      } else if (input.value !== '') {
        input.value = '-' + input.value
      } else {
        input.value = '-'
      }
      input.dispatchEvent(new Event('input'))
      input.focus()
    })
  }

  // Example: expose setInputAriaError so the validation layer (issue #7)
  // can call window.setInputAriaError(input, true/false).
  // This keeps the coupling loose — issue #7 does not need to import this module.
  if (input && errorEl) {
    (window as Window & { setInputAriaError: typeof setInputAriaError })
      .setInputAriaError = (inp, hasErr) => {
      setInputAriaError(inp, hasErr)
      if (hasErr) {
        errorEl.removeAttribute('hidden')
      } else {
        errorEl.setAttribute('hidden', '')
        errorEl.textContent = ''
      }
    }
  }
}
