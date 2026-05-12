## Pass 1 — Security Hardening: enforce maxlength on temperature input

- Critique: The widget accepted arbitrarily long strings from the browser. `parseTemperature` rejects inputs over 32 chars at parse-time (`MAX_LENGTH = 32`), but the `<input>` element carried no `maxlength` attribute, so the browser would buffer and hand the full string (however long) to the event handler before the parser's length guard fired. The `convert.ts` source explicitly exports `MAX_LENGTH` and its JSDoc calls out this exact use case ("e.g. to set a maxLength attribute on an <input>"), making the missing attribute a documented gap. This is a defence-in-depth issue: a 100 000-character paste would traverse the DOM event pipeline and call `parseTemperature` unnecessarily.
- Change: Imported `MAX_LENGTH` from `./convert` in `temperature-widget.ts` and interpolated it as `maxlength="${MAX_LENGTH}"` on the `<input>` element. The browser now rejects characters beyond position 32 before the `input` event fires, making the widget's first line of defence the DOM itself rather than the parser.
- Files touched: `frontend/lib/temperature-widget.ts`
- Tests: 65 passed before, 65 passed after (no regressions)
