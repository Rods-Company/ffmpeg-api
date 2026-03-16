function getScalarCustomCss() {
  return `
      body::before {
        content: "Supported by";
        position: fixed;
        left: 16px;
        bottom: 88px;
        z-index: 30;
        pointer-events: none;
        opacity: 0.78;
        color: rgba(148, 163, 184, 0.95);
        font: 600 11px/1.2 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      body::after {
        content: "";
        position: fixed;
        left: 112px;
        bottom: 80px;
        width: 132px;
        height: 28px;
        z-index: 30;
        pointer-events: none;
        opacity: 1;
        background: url('/assets/logo-rods-horizontal-cinza-escuro.png') no-repeat center / contain;
        filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.18));
      }

      @media (max-width: 900px) {
        body::before,
        body::after {
          display: none;
        }
      }
    `;
}

module.exports = {
  getScalarCustomCss,
};
