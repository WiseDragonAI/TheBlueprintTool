/**
 * WHAT: Renders the terminal waveform SVG used by the imported voice dock.
 * WHY: The waveform animation targets these exact path and head-line class names.
 */
export function waveSvg(): string {
  return `
    <svg class="wave-svg" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="waveAreaGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--voice-workspace-primary, #0da5ff)" stop-opacity="0.72"></stop><stop offset="100%" stop-color="var(--voice-graph-secondary, #041b3a)" stop-opacity="0.72"></stop></linearGradient>
        <linearGradient id="waveCoreGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--voice-workspace-primary, #0da5ff)" stop-opacity="0.24"></stop><stop offset="100%" stop-color="var(--voice-graph-secondary, #041b3a)" stop-opacity="0.18"></stop></linearGradient>
      </defs>
      <path class="wave-area-path" fill="url(#waveAreaGradient)" d="M0 100H1000V100H0z"></path>
      <path class="wave-core-path" fill="url(#waveCoreGradient)" d="M0 100H1000V100H0z"></path>
      <rect class="wave-head-glow" x="930" y="0" width="68" height="100"></rect>
      <line class="wave-head-line" x1="998" y1="2" x2="998" y2="98"></line>
    </svg>
  `;
}
