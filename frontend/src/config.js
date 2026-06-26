// Change this URL based on your current connection method:
//
// Option A — Phone Hotspot (Recommended, works without router change):
//   1. Enable hotspot on your phone
//   2. Connect PC to phone's hotspot
//   3. Run `ipconfig` on PC, find the new IP under the hotspot adapter
//   4. Set that IP below, e.g. 'http://192.168.43.1:5000/api'  ← your PC's IP on hotspot
//
// Option B — Same WiFi (only if Airtel router has AP Isolation disabled):
//   'http://192.168.1.6:5000/api'
//
// Option C — Tunnel (works from any network, run: npx localtunnel --port 5000):
//   'https://xxxx.loca.lt/api'  ← paste the tunnel URL here

// ── LOCAL (same WiFi / hotspot — no sleep, instant) ──────────────────────────
// const API_BASE_URL = 'http://192.168.29.235:5000/api';

// ── RENDER (cloud — works from any network / APK build) ──────────────────────
const API_BASE_URL = 'https://sri-3m2b.onrender.com/api';

export default API_BASE_URL;
