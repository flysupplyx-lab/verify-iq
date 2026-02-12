const { v4: uuidv4 } = require('uuid');

// In-memory API key store (in production, use a database)
const API_KEYS = new Map();

// Default usage counters
const DEFAULT_USAGE = {
    email_verify: 0, ai_detect: 0, url_scan: 0, darkweb_scan: 0,
    supplier_score: 0, audit_engagement: 0, trading_shield: 0, bulk_scan: 0,
};

// Tier limits
const TIER_LIMITS = {
    free: {
        email_verify: 50, ai_detect: 10, url_scan: 999999, darkweb_scan: 999999,
        supplier_score: 0, audit_engagement: 0, trading_shield: 0, bulk_scan: 0,
    },
    pro: {
        email_verify: 1000, ai_detect: 100, url_scan: 999999, darkweb_scan: 999999,
        supplier_score: 500, audit_engagement: 500, trading_shield: 500, bulk_scan: 100,
    },
    business: {
        email_verify: 10000, ai_detect: 1000, url_scan: 999999, darkweb_scan: 999999,
        supplier_score: 5000, audit_engagement: 5000, trading_shield: 5000, bulk_scan: 1000,
    },
};

// Create a demo key
const DEMO_KEY = 'viq_demo_' + 'a1b2c3d4e5f6';
API_KEYS.set(DEMO_KEY, {
    id: 'demo',
    name: 'Demo Key',
    tier: 'free',
    limits: { ...TIER_LIMITS.free },
    usage: { ...DEFAULT_USAGE },
    created: new Date().toISOString(),
});

/**
 * Generate a new API key
 */
function generateKey(name = 'Unnamed', tier = 'free') {
    const key = `viq_${tier}_${uuidv4().replace(/-/g, '').substring(0, 16)}`;

    API_KEYS.set(key, {
        id: uuidv4(),
        name,
        tier,
        limits: { ...(TIER_LIMITS[tier] || TIER_LIMITS.free) },
        usage: { ...DEFAULT_USAGE },
        created: new Date().toISOString(),
    });

    return key;
}

/**
 * API Key authentication middleware
 */
function apiKeyAuth(service) {
    return (req, res, next) => {
        const apiKey = req.headers['x-api-key'] || req.query.api_key;

        // Allow requests from the extension (check origin/referer)
        const origin = req.headers.origin || req.headers.referer || '';
        const isExtension = origin.startsWith('chrome-extension://') ||
            req.headers['x-source'] === 'extension';

        if (isExtension) {
            req.apiKeyData = {
                tier: 'extension',
                limits: { ...TIER_LIMITS.pro },
                usage: { ...DEFAULT_USAGE },
            };
            return next();
        }

        if (!apiKey) {
            return res.status(401).json({
                error: 'API key required',
                message: 'Include your API key in the x-api-key header or api_key query parameter',
                docs: '/api/docs',
            });
        }

        const keyData = API_KEYS.get(apiKey);
        if (!keyData) {
            return res.status(403).json({
                error: 'Invalid API key',
                message: 'The provided API key is not valid',
            });
        }

        // Check rate limits (daily)
        const today = new Date().toISOString().split('T')[0];
        if (keyData.lastReset !== today) {
            keyData.usage = { ...DEFAULT_USAGE };
            keyData.lastReset = today;
        }

        // If this service isn't in limits, default to unlimited
        const limit = keyData.limits[service] ?? 999999;
        const used = keyData.usage[service] ?? 0;

        if (used >= limit) {
            const isProFeature = limit === 0;
            return res.status(isProFeature ? 403 : 429).json({
                error: isProFeature ? 'Pro feature' : 'Daily limit reached',
                message: isProFeature
                    ? `${service} requires a Pro subscription. Upgrade at /pricing`
                    : `You've used ${used}/${limit} ${service} requests today`,
                tier: keyData.tier,
                upgrade_url: '/pricing',
            });
        }

        keyData.usage[service] = (keyData.usage[service] || 0) + 1;
        req.apiKeyData = keyData;
        next();
    };
}

module.exports = { apiKeyAuth, generateKey, API_KEYS, DEMO_KEY };
