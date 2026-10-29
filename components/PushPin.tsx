/** Single glossy red push pin seen head-on: a stacked base disc and cap with a soft shadow, used on every card. */
export default function PushPin() {
  return (
    <svg aria-hidden viewBox="0 0 48 52" className="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 overflow-visible" style={{ top: -16, width: 34, height: 37 }}>
      <defs>
        <radialGradient id="pp-base" cx="40%" cy="30%" r="85%">
          <stop offset="0" stopColor="#e8303a" />
          <stop offset=".7" stopColor="#b3121c" />
          <stop offset="1" stopColor="#7d0911" />
        </radialGradient>
        <radialGradient id="pp-cap" cx="36%" cy="28%" r="80%">
          <stop offset="0" stopColor="#ff6a6f" />
          <stop offset=".35" stopColor="#e0212b" />
          <stop offset="1" stopColor="#990d15" />
        </radialGradient>
        <filter id="pp-blur" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.4" /></filter>
      </defs>
      <ellipse cx="27" cy="38" rx="16" ry="9" fill="#000" opacity=".35" filter="url(#pp-blur)" />
      <circle cx="22" cy="27" r="16" fill="url(#pp-base)" />
      <circle cx="22" cy="27" r="16" fill="none" stroke="#fff" strokeOpacity=".18" />
      <circle cx="24" cy="21" r="16" fill="url(#pp-cap)" />
      <ellipse cx="18" cy="13" rx="8" ry="4.5" fill="#fff" opacity=".6" transform="rotate(-28 18 13)" />
      <circle cx="30" cy="30" r="9" fill="#000" opacity=".08" />
    </svg>
  );
}
