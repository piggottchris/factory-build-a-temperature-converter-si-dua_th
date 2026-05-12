/**
 * Debounced screen-reader announcer for the temperature converter.
 *
 * On each `input` event the caller should invoke `schedule()`; the announcer
 * cancels any pending announcement and restarts the 400 ms idle timer.  Only
 * once the user has paused for `delayMs` milliseconds does the appropriate
 * live region receive its content.
 *
 * Visible output rows must be updated **synchronously** inside the input
 * handler — before calling `schedule()` — so sighted users always see
 * instant feedback.  The announcer only controls the two ARIA live regions.
 */

export type AnnouncerStatus = 'valid' | 'invalid' | 'empty' | 'pending'

export interface Announcer {
  /**
   * Schedule a deferred SR update.  Cancels any previously-scheduled update.
   *
   * @param srResult  The `#sr-result` live region element.
   * @param srError   The `#sr-error` live region element.
   * @param status    Parse state of the current input value.
   * @param message   The text to announce (ignored for `empty` / `pending`).
   */
  schedule(
    srResult: HTMLElement,
    srError: HTMLElement,
    status: AnnouncerStatus,
    message: string,
  ): void

  /** Cancel any pending announcement (e.g. on component teardown). */
  cancel(): void
}

/**
 * Create an announcer that batches SR updates with the given idle window.
 *
 * @param delayMs  Milliseconds to wait after the last `schedule()` call
 *                 before writing to the live regions.  Defaults to 400.
 */
export function createAnnouncer(delayMs = 400): Announcer {
  let timerId: ReturnType<typeof setTimeout> | null = null

  return {
    schedule(srResult, srError, status, message) {
      // Cancel any in-flight announcement — live regions must not update
      // on every keystroke, only after the user pauses.
      if (timerId !== null) {
        clearTimeout(timerId)
      }

      timerId = setTimeout(() => {
        timerId = null

        if (status === 'valid') {
          srResult.textContent = message
          srError.textContent = ''
        } else if (status === 'invalid') {
          srError.textContent = message
          srResult.textContent = ''
        } else {
          // empty or pending: clear both regions so no stale content lingers
          srResult.textContent = ''
          srError.textContent = ''
        }
      }, delayMs)
    },

    cancel() {
      if (timerId !== null) {
        clearTimeout(timerId)
        timerId = null
      }
    },
  }
}
