# Verify.IQ 🛡️

> The Intelligence Suite for the Modern Web — Social Media Authenticity Checker, URL Scanner, Dark Web Monitor

## Features

### 🔍 URL Trust Scanner (Free)
Scan any URL for SSL, DNS, WHOIS, Safe Browsing, and domain age. Get an instant **Trust Score (0-100)**.

### 👤 Social Authenticity Checker
Analyze Instagram, TikTok, and X profiles for bot behavior:
- **Follower/Following Ratio Analysis** — Detects mass-follow bots
- **Engagement Mismatch Detection** — Exposes bought followers
- **Account Age Verification** — Flags new throwaway accounts
- **Verification Badge Check** — Trust boost for verified accounts

### 🕸️ Dark Web Monitor
Check if domains or emails have been exposed in data breaches and leak databases.

### 🛒 Dropshipping Detector *(Coming Soon)*
Reverse image search on product pages to find AliExpress/Alibaba source pricing.

### 🪙 Rug Pull Scanner *(Coming Soon)*
Automatically check crypto contract addresses for honeypot/high-tax tokens.

### 🤖 AI Face Detector *(Coming Soon)*
Scan profile pictures for AI-generated faces.

## Quick Start

```bash
# Install dependencies
npm install

# Start API server
npm start
```

Then load the `extension/` folder as an unpacked extension in Chrome.

## Tech Stack
- **Extension**: Vanilla JS, CSS (Dark Glassmorphism)
- **Backend**: Node.js + Express
- **Services**: URL Scanner, Email Verifier, AI Detector, Social Analyzer

## License
MIT
