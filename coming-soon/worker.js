export default {
  async fetch(request) {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pitchey — Coming Soon</title>
  <meta name="description" content="Pitchey — Where Stories Find Life. A comprehensive movie pitch platform connecting creators, investors, and production companies.">
  <meta property="og:title" content="Pitchey — Coming Soon">
  <meta property="og:description" content="Where Stories Find Life. A comprehensive movie pitch platform connecting creators, investors, and production companies.">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://www.pitchey.com">
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎬</text></svg>">
  <style>
    *, *::before, *::after {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      min-height: 100vh;
      background: linear-gradient(135deg, #7e22ce 0%, #9333ea 30%, #7c3aed 60%, #4338ca 100%);
      color: #fff;
      overflow-x: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* Floating decorative blobs */
    .blob {
      position: fixed;
      border-radius: 50%;
      filter: blur(80px);
      opacity: 0.3;
      pointer-events: none;
      animation: float 20s ease-in-out infinite;
    }

    .blob-1 {
      width: 400px;
      height: 400px;
      background: #a855f7;
      top: -100px;
      right: -100px;
      animation-delay: 0s;
    }

    .blob-2 {
      width: 300px;
      height: 300px;
      background: #6366f1;
      bottom: -80px;
      left: -80px;
      animation-delay: -7s;
      animation-duration: 25s;
    }

    .blob-3 {
      width: 200px;
      height: 200px;
      background: #c084fc;
      top: 50%;
      left: 60%;
      animation-delay: -14s;
      animation-duration: 18s;
    }

    @keyframes float {
      0%, 100% { transform: translate(0, 0) scale(1); }
      25% { transform: translate(30px, -40px) scale(1.05); }
      50% { transform: translate(-20px, 20px) scale(0.95); }
      75% { transform: translate(15px, 30px) scale(1.02); }
    }

    /* Main content */
    .container {
      position: relative;
      z-index: 1;
      text-align: center;
      padding: 2rem;
      max-width: 640px;
      width: 100%;
      animation: fadeInUp 1s ease-out;
    }

    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(30px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* Logo */
    .logo {
      font-size: 3rem;
      font-weight: 800;
      letter-spacing: -0.02em;
      background: linear-gradient(135deg, #fff 0%, #e9d5ff 50%, #c4b5fd 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 0.5rem;
    }

    .tagline {
      font-size: 1.125rem;
      color: rgba(255, 255, 255, 0.7);
      font-weight: 400;
      letter-spacing: 0.05em;
      margin-bottom: 3rem;
    }

    /* Coming Soon heading */
    .heading {
      font-size: 3.5rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      margin-bottom: 2rem;
      line-height: 1.1;
    }

    /* Glass card */
    .card {
      background: rgba(255, 255, 255, 0.08);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 1.25rem;
      padding: 2.5rem 2rem;
      margin-bottom: 2rem;
      animation: fadeInUp 1s ease-out 0.3s both;
    }

    .card p {
      font-size: 1.125rem;
      line-height: 1.7;
      color: rgba(255, 255, 255, 0.85);
    }

    .card p + p {
      margin-top: 1rem;
    }

    /* Pulse dot */
    .status {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
      color: rgba(255, 255, 255, 0.6);
      animation: fadeInUp 1s ease-out 0.6s both;
    }

    .pulse-dot {
      width: 8px;
      height: 8px;
      background: #4ade80;
      border-radius: 50%;
      animation: pulse 2s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.4); }
      50% { opacity: 0.8; box-shadow: 0 0 0 8px rgba(74, 222, 128, 0); }
    }

    /* Responsive */
    @media (max-width: 640px) {
      .logo {
        font-size: 2.25rem;
      }

      .tagline {
        font-size: 1rem;
        margin-bottom: 2rem;
      }

      .heading {
        font-size: 2.5rem;
      }

      .card {
        padding: 1.75rem 1.5rem;
      }

      .card p {
        font-size: 1rem;
      }

      .blob-1 {
        width: 250px;
        height: 250px;
      }

      .blob-2 {
        width: 200px;
        height: 200px;
      }

      .blob-3 {
        width: 150px;
        height: 150px;
      }
    }
  </style>
</head>
<body>
  <div class="blob blob-1"></div>
  <div class="blob blob-2"></div>
  <div class="blob blob-3"></div>

  <div class="container">
    <div class="logo">Pitchey</div>
    <div class="tagline">Where Stories Find Life</div>

    <h1 class="heading">Coming Soon</h1>

    <div class="card">
      <p>We're building a platform that connects creators, investors, and production companies to bring stories to life.</p>
      <p>Something exciting is on the way. Stay tuned.</p>
    </div>

    <div class="status">
      <span class="pulse-dot"></span>
      Building something special
    </div>
  </div>
</body>
</html>`;

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html;charset=UTF-8',
        'Cache-Control': 'public, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      },
    });
  },
};
