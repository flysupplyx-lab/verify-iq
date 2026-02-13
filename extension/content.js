// Verify.IQ V2 — Content Script
// Injects toast notifications, handles social media data extraction,
// dropship detection, rug pull scanning, deepfake detection, and ad transparency

// ===== TOAST CONTAINER =====
function ensureContainer() {
  let container = document.getElementById('verifyiq-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'verifyiq-toast-container';
    document.body.appendChild(container);
  }
  return container;
}

// ===== TOAST FUNCTION =====
function showToast(content, type = 'info', duration = 8000) {
  const container = ensureContainer();

  const toast = document.createElement('div');
  toast.className = `verifyiq-toast verifyiq-toast-${type}`;
  toast.innerHTML = `
        <div class="verifyiq-toast-header">
            <div class="verifyiq-toast-logo">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="14" height="14">
                    <path d="M9 12L11 14L15 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M12 2L3 7V12C3 16.97 6.84 21.63 12 23C17.16 21.63 21 16.97 21 12V7L12 2Z" stroke="currentColor" stroke-width="2"/>
                </svg>
                <span>Verify.IQ</span>
            </div>
            <button class="verifyiq-toast-close" onclick="this.closest('.verifyiq-toast').remove()">×</button>
        </div>
        <div class="verifyiq-toast-body">${content}</div>
    `;

  container.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => toast.classList.add('verifyiq-toast-show'));

  // Auto-dismiss
  if (duration > 0) {
    setTimeout(() => {
      toast.classList.add('verifyiq-toast-hide');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  return toast;
}

function clearToasts() {
  const container = document.getElementById('verifyiq-toast-container');
  if (container) container.innerHTML = '';
}

// ===== SOCIAL MEDIA EXTRACTION (Enhanced) =====
const SocialExtractors = {
  // Helper to parse "10.5K" or "1M" to numbers
  parseCount: (str) => {
    if (!str) return 0;
    const s = str.toString().toUpperCase().replace(/,/g, '').trim();
    let mult = 1;
    if (s.includes('K')) mult = 1000;
    else if (s.includes('M')) mult = 1000000;
    else if (s.includes('B')) mult = 1000000000;
    return parseFloat(s) * mult || 0;
  },

  // Extract comments from the most recent post (up to 10)
  extractComments: {
    instagram: () => {
      try {
        // IG comments are in nested spans within ul elements
        const commentEls = document.querySelectorAll('ul ul span[dir="auto"]');
        const comments = [];
        commentEls.forEach((el, i) => {
          if (i < 10 && el.textContent.trim().length > 0) {
            const parent = el.closest('li') || el.closest('div[role="button"]')?.parentElement;
            const usernameEl = parent?.querySelector('a[role="link"] span, a[href^="/"] span');
            comments.push({
              text: el.textContent.trim(),
              username: usernameEl?.textContent?.trim() || 'unknown'
            });
          }
        });
        return comments;
      } catch (e) { return []; }
    },

    tiktok: () => {
      try {
        const commentEls = document.querySelectorAll('[data-e2e="comment-level-1"] [data-e2e="comment-text"], .comment-text');
        const comments = [];
        commentEls.forEach((el, i) => {
          if (i < 10) {
            const container = el.closest('[data-e2e="comment-level-1"]') || el.parentElement;
            const usernameEl = container?.querySelector('[data-e2e="comment-username-1"], .comment-username');
            comments.push({
              text: el.textContent.trim(),
              username: usernameEl?.textContent?.trim() || 'unknown'
            });
          }
        });
        return comments;
      } catch (e) { return []; }
    },

    x: () => {
      try {
        // X replies are in [data-testid="tweetText"] elements within the reply thread
        const tweetTexts = document.querySelectorAll('[data-testid="tweetText"]');
        const comments = [];
        // Skip first one (it's the main tweet), collect up to 10 replies
        for (let i = 1; i < Math.min(tweetTexts.length, 11); i++) {
          const el = tweetTexts[i];
          const cellInner = el.closest('[data-testid="cellInnerDiv"]');
          const usernameEl = cellInner?.querySelector('[data-testid="User-Name"] a[tabindex="-1"]');
          comments.push({
            text: el.textContent.trim(),
            username: usernameEl?.textContent?.trim() || 'unknown'
          });
        }
        return comments;
      } catch (e) { return []; }
    }
  },

  // Extract recent post engagement (likes from visible posts)
  extractRecentLikes: {
    instagram: () => {
      try {
        // IG article/post like counts
        const likeEls = document.querySelectorAll('section span[class] a[href*="/liked_by/"] span, section button span');
        const likes = [];
        likeEls.forEach(el => {
          const count = SocialExtractors.parseCount(el.textContent);
          if (count > 0) likes.push(count);
        });
        return likes.slice(0, 10);
      } catch (e) { return []; }
    },

    tiktok: () => {
      try {
        const likeEls = document.querySelectorAll('[data-e2e="video-like-count"], [data-e2e="browse-like-count"]');
        return Array.from(likeEls).slice(0, 10).map(el => SocialExtractors.parseCount(el.textContent));
      } catch (e) { return []; }
    },

    x: () => {
      try {
        const likeEls = document.querySelectorAll('[data-testid="like"] span, [data-testid="unlike"] span');
        return Array.from(likeEls).slice(0, 10)
          .map(el => SocialExtractors.parseCount(el.textContent))
          .filter(n => n > 0);
      } catch (e) { return []; }
    }
  },

  // Extract bio text
  extractBio: {
    instagram: () => {
      try {
        const bioEl = document.querySelector('header section div > span, meta[property="og:description"]');
        return bioEl?.textContent || bioEl?.getAttribute('content') || '';
      } catch (e) { return ''; }
    },
    tiktok: () => {
      try {
        return document.querySelector('[data-e2e="user-bio"]')?.textContent || '';
      } catch (e) { return ''; }
    },
    x: () => {
      try {
        return document.querySelector('[data-testid="UserDescription"]')?.textContent || '';
      } catch (e) { return ''; }
    }
  },

  // Extract profile picture URL
  extractProfilePic: {
    instagram: () => {
      try {
        const img = document.querySelector('header img[alt*="profile"], header canvas + img, img[data-testid="user-avatar"]');
        return img?.src || '';
      } catch (e) { return ''; }
    },
    tiktok: () => {
      try {
        const img = document.querySelector('[data-e2e="user-avatar"] img, .avatar img');
        return img?.src || '';
      } catch (e) { return ''; }
    },
    x: () => {
      try {
        const img = document.querySelector('img[alt="Opens profile photo"], a[href$="/photo"] img');
        return img?.src || '';
      } catch (e) { return ''; }
    }
  },

  // Extract account creation/join date
  extractJoinDate: {
    instagram: () => null, // IG doesn't show join date publicly
    tiktok: () => null,    // TikTok doesn't show join date publicly
    x: () => {
      try {
        // X shows "Joined Month Year" in the profile
        const joinEl = document.querySelector('[data-testid="UserJoinDate"] span');
        if (joinEl) {
          const text = joinEl.textContent.replace('Joined ', '');
          return new Date(text).toISOString();
        }
      } catch (e) { }
      return null;
    }
  },

  instagram: () => {
    try {
      const metas = document.getElementsByTagName('meta');
      let desc = '';
      for (let m of metas) {
        if (m.getAttribute('property') === 'og:description') {
          desc = m.getAttribute('content');
          break;
        }
      }
      // "100 Followers, 50 Following, 20 Posts - ..."
      let followers = 0, following = 0;
      if (desc) {
        const parts = desc.split(',').map(p => p.trim());
        followers = SocialExtractors.parseCount(parts.find(p => p.includes('Followers'))?.split(' ')[0]);
        following = SocialExtractors.parseCount(parts.find(p => p.includes('Following'))?.split(' ')[0]);
      }

      const recentLikes = SocialExtractors.extractRecentLikes.instagram();
      const avgLikes = recentLikes.length > 0 ? Math.round(recentLikes.reduce((a, b) => a + b, 0) / recentLikes.length) : 0;
      const comments = SocialExtractors.extractComments.instagram();
      const bio = SocialExtractors.extractBio.instagram();
      const profilePic = SocialExtractors.extractProfilePic.instagram();
      const isVerified = !!document.querySelector('svg[aria-label="Verified"]');

      return {
        platform: 'instagram',
        followers,
        following,
        avgLikes,
        recentLikes,
        comments,
        bio,
        profilePic,
        isVerified,
        creationDate: null
      };
    } catch (e) {
      console.warn('Verify.IQ: Insta scrape fail', e);
    }
    return null;
  },

  tiktok: () => {
    try {
      const followersEl = document.querySelector('[data-e2e="followers-count"]');
      const followingEl = document.querySelector('[data-e2e="following-count"]');
      const likesEl = document.querySelector('[data-e2e="likes-count"]');

      const recentLikes = SocialExtractors.extractRecentLikes.tiktok();
      const avgLikes = recentLikes.length > 0 ? Math.round(recentLikes.reduce((a, b) => a + b, 0) / recentLikes.length) : 0;
      const comments = SocialExtractors.extractComments.tiktok();
      const bio = SocialExtractors.extractBio.tiktok();
      const profilePic = SocialExtractors.extractProfilePic.tiktok();

      return {
        platform: 'tiktok',
        followers: SocialExtractors.parseCount(followersEl?.textContent),
        following: SocialExtractors.parseCount(followingEl?.textContent),
        avgLikes,
        totalLikes: SocialExtractors.parseCount(likesEl?.textContent),
        recentLikes,
        comments,
        bio,
        profilePic,
        isVerified: !!document.querySelector('[data-e2e="verify-badge"], svg[data-e2e="verify-badge"]'),
        creationDate: null
      };
    } catch (e) { console.warn('Verify.IQ: TikTok scrape fail', e); }
    return null;
  },

  x: () => {
    try {
      const links = Array.from(document.querySelectorAll('a[href$="/following"], a[href$="/verified_followers"], a[href$="/followers"]'));
      let following = 0, followers = 0;

      links.forEach(l => {
        const txt = l.textContent || '';
        if (l.getAttribute('href').endsWith('/following')) following = SocialExtractors.parseCount(txt.replace('Following', ''));
        if (l.getAttribute('href').endsWith('/verified_followers') || l.getAttribute('href').endsWith('/followers'))
          followers = SocialExtractors.parseCount(txt.replace('Followers', ''));
      });

      const recentLikes = SocialExtractors.extractRecentLikes.x();
      const avgLikes = recentLikes.length > 0 ? Math.round(recentLikes.reduce((a, b) => a + b, 0) / recentLikes.length) : 0;
      const comments = SocialExtractors.extractComments.x();
      const bio = SocialExtractors.extractBio.x();
      const profilePic = SocialExtractors.extractProfilePic.x();
      const creationDate = SocialExtractors.extractJoinDate.x();

      return {
        platform: 'x',
        followers,
        following,
        avgLikes,
        recentLikes,
        comments,
        bio,
        profilePic,
        isVerified: !!document.querySelector('svg[aria-label="Verified account"]'),
        creationDate
      };
    } catch (e) { console.warn('Verify.IQ: X scrape fail', e); }
    return null;
  }
};

function extractProfileData() {
  const host = window.location.hostname;
  let data = null;

  if (host.includes('instagram.com')) {
    data = SocialExtractors.instagram();
  } else if (host.includes('tiktok.com')) {
    data = SocialExtractors.tiktok();
  } else if (host.includes('twitter.com') || host.includes('x.com')) {
    data = SocialExtractors.x();
  }

  return data;
}


// ===== MODULE B: DROPSHIP DETECTOR (Content Script) =====
const DropshipDetector = {
  isShopify: () => {
    try {
      // Multiple Shopify detection methods
      const hasShopifyMeta = !!document.querySelector('meta[name="shopify-checkout-api-token"]');
      const hasShopifyCdn = !!document.querySelector('link[href*="cdn.shopify.com"], script[src*="cdn.shopify.com"]');
      const hasCartJs = !!document.querySelector('script[src*="/cart.js"], script[src*="shopify"]');
      const hasShopifyGlobal = typeof window.Shopify !== 'undefined';
      const htmlIncludes = document.documentElement.innerHTML.includes('cdn.shopify.com');
      return hasShopifyMeta || hasShopifyCdn || hasCartJs || hasShopifyGlobal || htmlIncludes;
    } catch (e) { return false; }
  },

  extractProduct: () => {
    try {
      const title = document.querySelector('h1, [data-product-title], .product-title, .product__title')?.textContent?.trim() || '';
      const priceEl = document.querySelector('[data-product-price], .price .money, .product__price .money, .price-item--regular, meta[property="product:price:amount"]');
      let price = 0;
      if (priceEl) {
        const priceText = priceEl.getAttribute('content') || priceEl.textContent;
        price = parseFloat(priceText.replace(/[^0-9.]/g, '')) || 0;
      }
      const imageEl = document.querySelector('.product__media img, .product-featured-media img, [data-product-image], .product-single__photo img, meta[property="og:image"]');
      const imageUrl = imageEl?.src || imageEl?.getAttribute('content') || '';
      const storeUrl = window.location.origin;
      const currency = document.querySelector('meta[property="product:price:currency"]')?.content || 'USD';

      return { title, price, imageUrl, storeUrl, currency };
    } catch (e) { return null; }
  },

  injectBadge: (productData) => {
    if (document.getElementById('verifyiq-dropship-badge')) return;
    const targetImg = document.querySelector('.product__media img, .product-featured-media img, [data-product-image], .product-single__photo img');
    if (!targetImg) return;

    const badge = document.createElement('div');
    badge.id = 'verifyiq-dropship-badge';
    badge.className = 'verifyiq-dropship-badge';
    badge.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      Check Source
    `;
    badge.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'DROPSHIP_CHECK', data: productData });
    });

    const wrapper = targetImg.closest('.product__media, .product-featured-media, .product-single__photo') || targetImg.parentElement;
    wrapper.style.position = 'relative';
    wrapper.appendChild(badge);
  }
};


// ===== MODULE C: RUG PULL SCANNER (Content Script) =====
const RugPullScanner = {
  // Regex patterns for contract addresses
  ETH_REGEX: /\b(0x[a-fA-F0-9]{40})\b/g,
  SOL_REGEX: /\b([1-9A-HJ-NP-Za-km-z]{32,44})\b/g,

  scannedAddresses: new Set(),

  scanPage: () => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    const matches = [];
    let node;

    while (node = walker.nextNode()) {
      // Skip script/style/verifyiq elements
      const parent = node.parentElement;
      if (!parent || parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE' ||
        parent.closest('.verifyiq-toast-container, .verifyiq-rug-badge')) continue;

      const text = node.textContent;
      let match;

      // ETH addresses
      RugPullScanner.ETH_REGEX.lastIndex = 0;
      while ((match = RugPullScanner.ETH_REGEX.exec(text)) !== null) {
        const addr = match[1];
        if (!RugPullScanner.scannedAddresses.has(addr)) {
          RugPullScanner.scannedAddresses.add(addr);
          matches.push({ address: addr, chain: 'ethereum', node: parent });
        }
      }
    }
    return matches;
  },

  injectBadge: (element, address, status) => {
    // status: { safe: bool, buyTax: number, sellTax: number, verdict: string }
    const existing = element.querySelector(`.verifyiq-rug-badge[data-addr="${address}"]`);
    if (existing) return;

    const badge = document.createElement('span');
    badge.className = 'verifyiq-rug-badge';
    badge.dataset.addr = address;

    let color, emoji, tooltip;
    if (status.isHoneypot) {
      color = '#ef4444'; emoji = '🔴'; tooltip = `HONEYPOT — Sell Tax: ${status.sellTax}%`;
    } else if (status.sellTax > 10 || status.buyTax > 10) {
      color = '#f59e0b'; emoji = '🟡'; tooltip = `CAUTION — Buy: ${status.buyTax}% / Sell: ${status.sellTax}%`;
    } else {
      color = '#22c55e'; emoji = '🟢'; tooltip = `Safe — Buy: ${status.buyTax}% / Sell: ${status.sellTax}%`;
    }

    badge.innerHTML = `<span style="cursor:pointer;font-size:12px;" title="${tooltip}">${emoji}</span>`;
    badge.style.cssText = 'display:inline;margin-left:4px;';

    // Insert right after the address text
    element.appendChild(badge);
  }
};


// ===== MODULE D: DEEPFAKE DETECTOR (Content Script) =====
const DeepfakeDetector = {
  extractProfilePic: () => {
    const host = window.location.hostname;
    if (host.includes('instagram.com')) return SocialExtractors.extractProfilePic.instagram();
    if (host.includes('tiktok.com')) return SocialExtractors.extractProfilePic.tiktok();
    if (host.includes('twitter.com') || host.includes('x.com')) return SocialExtractors.extractProfilePic.x();
    return '';
  }
};


// ===== MODULE E: GURU AD CHECKER (Content Script) =====
const GuruAdChecker = {
  extractUsername: () => {
    const host = window.location.hostname;
    const path = window.location.pathname;

    try {
      if (host.includes('instagram.com')) {
        return path.split('/').filter(Boolean)[0] || '';
      }
      if (host.includes('tiktok.com')) {
        const match = path.match(/@([^/?]+)/);
        return match ? match[1] : '';
      }
      if (host.includes('twitter.com') || host.includes('x.com')) {
        return path.split('/').filter(Boolean)[0] || '';
      }
    } catch (e) { }
    return '';
  },

  detectPlatform: () => {
    const host = window.location.hostname;
    if (host.includes('instagram.com')) return 'instagram';
    if (host.includes('tiktok.com')) return 'tiktok';
    if (host.includes('twitter.com') || host.includes('x.com')) return 'x';
    if (host.includes('facebook.com')) return 'facebook';
    return 'unknown';
  }
};


// ===== MESSAGE HANDLER =====
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'EXTRACT_PROFILE_DATA': {
      const data = extractProfileData();
      if (data) {
        sendResponse({ success: true, data });
      } else {
        sendResponse({ success: false, error: 'Could not extract profile data. Make sure you are on a profile page.' });
      }
      break;
    }

    case 'SCAN_LOADING':
      showToast(`<div class="verifyiq-loading">Scanning URL...<br><small style="opacity:0.6">${truncateUrl(message.url)}</small></div>`, 'info', 0);
      break;

    case 'SCAN_RESULT':
      clearToasts();
      showScanToast(message.data);
      break;

    case 'AI_LOADING':
      showToast(`<div class="verifyiq-loading">Analyzing text for AI patterns...</div>`, 'info', 0);
      break;

    case 'AI_RESULT':
      clearToasts();
      showAIToast(message.data);
      break;

    case 'EMAIL_LOADING':
      showToast(`<div class="verifyiq-loading">Verifying email address...</div>`, 'info', 0);
      break;

    case 'EMAIL_RESULT':
      clearToasts();
      showEmailToast(message.data);
      break;

    case 'ERROR':
      clearToasts();
      showToast(`<div style="color:#ef4444;">❌ ${message.error}</div>`, 'error', 6000);
      break;

    // Module B: Dropship
    case 'CHECK_DROPSHIP': {
      if (DropshipDetector.isShopify()) {
        const product = DropshipDetector.extractProduct();
        sendResponse({ success: true, isShopify: true, product });
      } else {
        sendResponse({ success: true, isShopify: false, product: null });
      }
      break;
    }

    case 'DROPSHIP_RESULT':
      clearToasts();
      showDropshipToast(message.data);
      break;

    // Module C: Rug Pull
    case 'SCAN_RUG_PULL': {
      const matches = RugPullScanner.scanPage();
      sendResponse({ success: true, addresses: matches.map(m => ({ address: m.address, chain: m.chain })) });
      break;
    }

    case 'RUG_PULL_RESULT': {
      // Inject badges for scanned addresses
      const results = message.data;
      if (results && results.address) {
        const elements = document.querySelectorAll(`*`);
        for (const el of elements) {
          if (el.textContent.includes(results.address) && !el.querySelector('.verifyiq-rug-badge')) {
            RugPullScanner.injectBadge(el, results.address, results);
            break;
          }
        }
        showRugPullToast(results);
      }
      break;
    }

    // Module D: Deepfake
    case 'CHECK_DEEPFAKE': {
      const pfpUrl = DeepfakeDetector.extractProfilePic();
      sendResponse({ success: !!pfpUrl, profilePic: pfpUrl });
      break;
    }

    case 'DEEPFAKE_RESULT':
      clearToasts();
      showDeepfakeToast(message.data);
      break;

    // Module E: Guru Ad Check
    case 'CHECK_AD_TRANSPARENCY': {
      const username = GuruAdChecker.extractUsername();
      const platform = GuruAdChecker.detectPlatform();
      sendResponse({ success: !!username, username, platform });
      break;
    }

    case 'AD_TRANSPARENCY_RESULT':
      clearToasts();
      showAdTransparencyToast(message.data);
      break;
  }
  return true; // Keep message channel open for async
});


// ===== TOAST HELPERS =====
function showScanToast(data) {
  const scoreColor = data.iq_score >= 75 ? '#22c55e' : data.iq_score >= 50 ? '#f59e0b' : '#ef4444';
  const verdictEmoji = data.verdict === 'safe' ? '✅' : data.verdict === 'suspicious' ? '⚠️' : '🚨';

  const content = `
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
            <div style="font-size:28px;font-weight:800;color:${scoreColor};">${data.iq_score}</div>
            <div>
                <div style="font-weight:600;">IQ Score</div>
                <div style="font-size:11px;opacity:0.7;">${verdictEmoji} ${data.verdict?.toUpperCase()}</div>
            </div>
        </div>
        <div style="font-size:11px;opacity:0.7;margin-bottom:6px;">${truncateUrl(data.url)}</div>
    `;
  showToast(content, data.verdict === 'safe' ? 'success' : 'warning', 8000);
}

function showAIToast(data) {
  const score = data.ai_probability || data.score || 0;
  const color = score >= 70 ? '#ef4444' : score >= 40 ? '#f59e0b' : '#22c55e';
  const verdict = score >= 70 ? '🤖 Likely AI' : score >= 40 ? '🤔 Possibly AI' : '✍️ Likely Human';
  const content = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
      <div style="font-size:28px;font-weight:800;color:${color};">${score}%</div>
      <div>
        <div style="font-weight:600;">AI Detection</div>
        <div style="font-size:11px;opacity:0.7;">${verdict}</div>
      </div>
    </div>
  `;
  showToast(content, score >= 70 ? 'warning' : 'success', 8000);
}

function showEmailToast(data) {
  const verdictEmoji = data.verdict === 'deliverable' ? '✅' : data.verdict === 'risky' ? '⚠️' : '❌';
  const content = `
    <div style="display:flex;align-items:center;gap:8px;">
      <span style="font-size:20px;">${verdictEmoji}</span>
      <div>
        <div style="font-weight:600;">${data.email || ''}</div>
        <div style="font-size:11px;opacity:0.7;">${data.verdict?.toUpperCase()} · Score: ${data.score || 0}/100</div>
      </div>
    </div>
  `;
  showToast(content, data.verdict === 'deliverable' ? 'success' : 'warning', 6000);
}

function showDropshipToast(data) {
  const isDropship = data.likelihood >= 60;
  const color = isDropship ? '#f59e0b' : '#22c55e';
  const emoji = isDropship ? '⚠️' : '✅';
  const content = `
    <div style="margin-bottom:8px;">
      <div style="font-weight:700;font-size:14px;">${emoji} Dropship Check</div>
    </div>
    <div style="font-size:12px;">
      <div><strong>Likelihood:</strong> <span style="color:${color};font-weight:700;">${data.likelihood}%</span></div>
      ${data.estimated_source_price ? `<div><strong>Est. Source Price:</strong> $${data.estimated_source_price.toFixed(2)}</div>` : ''}
      ${data.markup_multiplier ? `<div><strong>Markup:</strong> ${data.markup_multiplier.toFixed(1)}x</div>` : ''}
      ${data.search_url ? `<div style="margin-top:6px;"><a href="${data.search_url}" target="_blank" style="color:#6366f1;text-decoration:underline;">🔍 Search on AliExpress</a></div>` : ''}
    </div>
  `;
  showToast(content, isDropship ? 'warning' : 'success', 12000);
}

function showRugPullToast(data) {
  const isHoneypot = data.isHoneypot;
  const highTax = data.sellTax > 10 || data.buyTax > 10;
  const color = isHoneypot ? '#ef4444' : highTax ? '#f59e0b' : '#22c55e';
  const emoji = isHoneypot ? '🔴' : highTax ? '🟡' : '🟢';
  const addr = data.address ? `${data.address.slice(0, 6)}...${data.address.slice(-4)}` : '';

  const content = `
    <div style="margin-bottom:8px;">
      <div style="font-weight:700;font-size:14px;">${emoji} Contract Analysis</div>
      <div style="font-size:11px;opacity:0.7;font-family:monospace;">${addr}</div>
    </div>
    <div style="font-size:12px;">
      <div><strong>Verdict:</strong> <span style="color:${color};font-weight:700;">${data.verdict || (isHoneypot ? 'HONEYPOT' : 'OK')}</span></div>
      <div><strong>Buy Tax:</strong> ${data.buyTax}% · <strong>Sell Tax:</strong> ${data.sellTax}%</div>
      ${data.liquidity ? `<div><strong>Liquidity:</strong> $${Number(data.liquidity).toLocaleString()}</div>` : ''}
      ${data.lpLocked ? `<div><strong>LP Locked:</strong> ✅ Yes</div>` : '<div><strong>LP Locked:</strong> ❌ No</div>'}
    </div>
  `;
  showToast(content, isHoneypot ? 'error' : highTax ? 'warning' : 'success', 10000);
}

function showDeepfakeToast(data) {
  const prob = data.ai_probability || 0;
  const color = prob >= 70 ? '#ef4444' : prob >= 40 ? '#f59e0b' : '#22c55e';
  const emoji = prob >= 70 ? '🤖' : prob >= 40 ? '🤔' : '✅';
  const verdict = prob >= 70 ? 'Likely AI-Generated' : prob >= 40 ? 'Possibly AI-Generated' : 'Likely Real';

  const content = `
    <div style="margin-bottom:8px;">
      <div style="font-weight:700;font-size:14px;">${emoji} Profile Picture Analysis</div>
    </div>
    <div style="font-size:12px;">
      <div><strong>AI Probability:</strong> <span style="color:${color};font-weight:700;">${prob}%</span></div>
      <div><strong>Verdict:</strong> ${verdict}</div>
      ${data.indicators?.length ? `<div style="margin-top:4px;font-size:11px;opacity:0.8;">Indicators: ${data.indicators.join(', ')}</div>` : ''}
    </div>
  `;
  showToast(content, prob >= 70 ? 'warning' : 'success', 10000);
}

function showAdTransparencyToast(data) {
  const isRunning = data.is_running_ads;
  const content = `
    <div style="margin-bottom:8px;">
      <div style="font-weight:700;font-size:14px;">${isRunning ? '⚠️' : '✅'} Ad Transparency</div>
      <div style="font-size:11px;opacity:0.7;">@${data.username || 'unknown'}</div>
    </div>
    <div style="font-size:12px;">
      ${isRunning
      ? `<div style="color:#f59e0b;font-weight:600;">This user is spending money to target you with ads.</div>
           <div><strong>Active Ads:</strong> ${data.ad_count || 'Unknown'}</div>
           <div><strong>Platforms:</strong> ${data.ad_platforms?.join(', ') || 'Unknown'}</div>`
      : '<div style="color:#22c55e;">No active ads detected for this user.</div>'
    }
      ${data.funnel_indicators?.length
      ? `<div style="margin-top:4px;font-size:11px;opacity:0.8;">🚩 Funnel Flags: ${data.funnel_indicators.join(', ')}</div>`
      : ''
    }
      ${data.ad_library_url
      ? `<div style="margin-top:6px;"><a href="${data.ad_library_url}" target="_blank" style="color:#6366f1;text-decoration:underline;">📖 View in Ad Library</a></div>`
      : ''
    }
    </div>
  `;
  showToast(content, isRunning ? 'warning' : 'success', 12000);
}

function truncateUrl(url, maxLen = 50) {
  if (!url) return '';
  return url.length > maxLen ? url.substring(0, maxLen) + '...' : url;
}


// ===== AUTO-INITIALIZATION =====
// Auto-detect Shopify and inject badge on product pages
(function autoInit() {
  setTimeout(() => {
    if (DropshipDetector.isShopify()) {
      const product = DropshipDetector.extractProduct();
      if (product && product.title) {
        DropshipDetector.injectBadge(product);
      }
    }
  }, 2000);

  // Auto-scan for contract addresses on crypto-heavy sites
  const host = window.location.hostname;
  const cryptoSites = ['etherscan.io', 'bscscan.com', 'dexscreener.com', 'dextools.io'];
  if (cryptoSites.some(s => host.includes(s)) || host.includes('twitter.com') || host.includes('x.com')) {
    setTimeout(() => {
      const matches = RugPullScanner.scanPage();
      matches.forEach(m => {
        chrome.runtime.sendMessage({
          type: 'RUG_PULL_AUTO_CHECK',
          address: m.address,
          chain: m.chain
        });
      });
    }, 3000);
  }
})();
