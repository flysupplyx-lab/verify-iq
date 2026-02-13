# Verify.IQ V3 🛡️

> The Intelligence Suite for the Modern Web. Instantly verify authenticity, safety, and value.

**New in V3:** Completely redesigned **Liquid Glass** interface (Apple Xcode-inspired), enhanced detection modules, and persistent history.

![V3 Preview](https://verifyiq.io/preview.png)

## Features

### 🛡️ URL Trust Scanner
Scan any URL for SSL, DNS, WHOIS, Safe Browsing, and domain age. Get an instant **Trust Score (0-100)**.

### 👤 Social Authenticity Checker
Analyze Instagram, TikTok, and X profiles for bot behavior:
- **Bot Detection** — Flags mass-follow bots and fake accounts.
- **Engagement Audit** — Detects bought likes/followers.
- **Sentiment Analysis** — NLP checks on comments.

### 📦 Dropshipping Detector
Unmask resold products on Shopify stores.
- **Source Match** — Findlay the original product on AliExpress/Alibaba.
- **Markup Calculator** — See exactly how much the price is inflated (e.g., 3.5x).
- **Listing Analysis** — Detects copied descriptions and stock images.

### ⛓️ Rug Pull Scanner
Analyze crypto tokens (ETH, BSC, Polygon, Base) for scams.
- **Honeypot Check** — Simulates buy/sell transactions.
- **Tax Analysis** — Flags high buy/sell taxes (e.g., 99%).
- **Liquidity Lock** — Verifies if LP is locked or burn.

### 🤖 Intel Suite
- **Deepfake Detector**: Scan profile pictures for AI-generated faces (GAN/Diffusion artifacts).
- **Ad Transparency**: Detect if an influencer is running hidden paid ads or using funnel tactics.
- **Dark Web Monitor**: Check if domains or emails have been exposed in data breaches.

## Tech Stack
- **Frontend**: Vanilla JS (ES6+), CSS3 Variables (Liquid Glass Design System)
- **Backend**: Node.js + Express
- **Storage**: `chrome.storage.local` for settings & history
- **Design**: Frosted glassmorphism, mesh gradients, spring animations

## Quick Start
1.  **Install dependencies**:
    ```bash
    npm install
    ```
2.  **Start API server**:
    ```bash
    npm start
    ```
3.  **Load Extension**:
    -   Open Chrome/Brave/Edge and go to `chrome://extensions`.
    -   Enable "Developer Mode".
    -   Click "Load Unpacked" and select the `extension/` folder in this project.

## License
MIT
