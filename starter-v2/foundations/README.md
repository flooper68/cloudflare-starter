# Verification and UI foundations evidence

[date-picker/](date-picker/) contains the original and corrected selected-preset appearances in both themes. The corrected story always selects Today so the active-row contrast remains exercised every weekday. The focused browser component check passed all 16 theme cases.

The existing anchor reset also overrode declared text tokens. Its settled before/after colors and screenshots are in [the wave-one inventory](../wave1/README.md#theme-timing-and-the-anchor-reset), with [before](../wave1/sidebar-before-light.png), [after](../wave1/sidebar-after-light.png) and [computed values](../wave1/sidebar-computed-colors.json). Theme-transition frames are distinguished from steady-state token evidence.

The Turnstile test harness is limited to the local E2E server and rejects production builds. The Cloudflare/Vitest filesystem-module-cache workaround affects API test transport only; isolation and assertions remain enabled. Their proof is test output, not a visual change.
