// The home screen's line icons (mockup: design/app-screens), drawn in the
// text colour.
import type { ComponentChildren } from "preact";

function Icon(props: { readonly children: ComponentChildren }) {
  return (
    <svg class="mlh-icon" viewBox="0 0 24 24" aria-hidden="true">
      {props.children}
    </svg>
  );
}

export const Dots = () => (
  <Icon>
    <circle cx="12" cy="5" r="1.4" />
    <circle cx="12" cy="12" r="1.4" />
    <circle cx="12" cy="19" r="1.4" />
  </Icon>
);

export const Plus = () => (
  <Icon>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const Unlock = () => (
  <Icon>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 7.5-2" />
  </Icon>
);

export const Check = () => (
  <Icon>
    <path d="M5 12l5 5 9-10" />
  </Icon>
);

export const Warn = () => (
  <Icon>
    <path d="M12 4l9 16H3zM12 10v4M12 17h.01" />
  </Icon>
);

export const History = () => (
  <Icon>
    <path d="M4 12a8 8 0 1 0 3-6.2M4 4v4h4M12 8v4l3 2" />
  </Icon>
);

/** Module Library's mark: four books on a shelf. */
export const Mark = () => (
  <span class="mlh-mark" aria-hidden="true">
    <i>
      <b />
      <b />
      <b />
      <b />
    </i>
  </span>
);
