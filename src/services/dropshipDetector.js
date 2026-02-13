/**
 * Verify.IQ - Dropship Detector Service
 * Detects Shopify storefronts and estimates dropship likelihood
 * with AliExpress/Alibaba search URL generation.
 */

// Known dropship indicators and typical markup ranges
const SHOPIFY_INDICATORS = [
    'cdn.shopify.com', 'myshopify.com', 'shopify-checkout',
    'Shopify.shop', '/cart.js'
];

const KNOWN_DROPSHIP_CATEGORIES = {
    watches: { aliRange: [1, 15], typicalMarkup: 5 },
    jewelry: { aliRange: [0.5, 10], typicalMarkup: 6 },
    sunglasses: { aliRange: [1, 8], typicalMarkup: 4 },
    clothing: { aliRange: [3, 20], typicalMarkup: 3 },
    electronics: { aliRange: [5, 50], typicalMarkup: 2.5 },
    'phone cases': { aliRange: [0.5, 5], typicalMarkup: 6 },
    bags: { aliRange: [3, 25], typicalMarkup: 4 },
    shoes: { aliRange: [5, 30], typicalMarkup: 3 },
    beauty: { aliRange: [1, 10], typicalMarkup: 4 },
    fitness: { aliRange: [2, 20], typicalMarkup: 3.5 },
    home: { aliRange: [2, 30], typicalMarkup: 3 },
    toys: { aliRange: [1, 15], typicalMarkup: 4 },
    pet: { aliRange: [1, 12], typicalMarkup: 4 }
};

// Keyword-to-category mapping
const CATEGORY_KEYWORDS = {
    watches: ['watch', 'timepiece', 'wristwatch', 'chronograph'],
    jewelry: ['necklace', 'bracelet', 'ring', 'earring', 'pendant', 'chain', 'jewelry'],
    sunglasses: ['sunglasses', 'shades', 'eyewear', 'glasses'],
    clothing: ['shirt', 'dress', 'hoodie', 'jacket', 'pants', 'leggings', 'sweater', 'tee'],
    electronics: ['charger', 'cable', 'speaker', 'headphones', 'earbuds', 'led', 'lamp', 'gadget'],
    'phone cases': ['phone case', 'iphone case', 'samsung case', 'cover'],
    bags: ['bag', 'backpack', 'purse', 'wallet', 'clutch', 'tote'],
    shoes: ['sneaker', 'shoe', 'boot', 'sandal', 'slipper'],
    beauty: ['serum', 'cream', 'brush', 'makeup', 'skincare', 'mascara', 'foundation'],
    fitness: ['resistance band', 'yoga', 'gym', 'dumbbell', 'exercise', 'fitness'],
    home: ['pillow', 'blanket', 'organizer', 'storage', 'kitchen', 'decor'],
    toys: ['toy', 'puzzle', 'fidget', 'game', 'plush'],
    pet: ['pet', 'dog', 'cat', 'leash', 'collar', 'bowl']
};

const DropshipDetector = {
    /**
     * Analyze a product for dropship likelihood
     * @param {Object} params
     * @param {string} params.product_title - Product title
     * @param {number} params.price - Listed price
     * @param {string} params.image_url - Product image URL
     * @param {string} params.store_url - Store URL
     * @param {string} [params.currency='USD'] - Currency code
     * @returns {Object} Analysis result
     */
    analyze: ({ product_title, price, image_url, store_url, currency = 'USD' }) => {
        const startTime = Date.now();
        let likelihood = 0;
        const signals = [];
        const flags = [];

        // 1. Detect Shopify
        const isShopifyUrl = store_url && SHOPIFY_INDICATORS.some(ind => store_url.toLowerCase().includes(ind));
        if (isShopifyUrl) {
            likelihood += 20;
            signals.push({ name: 'Shopify Platform', score: 20, detail: 'Store runs on Shopify — commonly used by dropshippers' });
        }

        // 2. Detect product category
        const titleLower = (product_title || '').toLowerCase();
        let detectedCategory = null;
        for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
            if (keywords.some(kw => titleLower.includes(kw))) {
                detectedCategory = cat;
                break;
            }
        }

        // 3. Price analysis
        let estimated_source_price = null;
        let markup_multiplier = null;

        if (detectedCategory && KNOWN_DROPSHIP_CATEGORIES[detectedCategory]) {
            const catData = KNOWN_DROPSHIP_CATEGORIES[detectedCategory];
            const avgAliPrice = (catData.aliRange[0] + catData.aliRange[1]) / 2;
            markup_multiplier = price > 0 ? price / avgAliPrice : 0;
            estimated_source_price = avgAliPrice;

            if (markup_multiplier > 5) {
                likelihood += 30;
                signals.push({ name: 'Extreme Markup', score: 30, detail: `${markup_multiplier.toFixed(1)}x markup vs typical source price` });
                flags.push(`⚠️ Price is ${markup_multiplier.toFixed(1)}x the typical AliExpress range ($${catData.aliRange[0]}-$${catData.aliRange[1]})`);
            } else if (markup_multiplier > 3) {
                likelihood += 20;
                signals.push({ name: 'High Markup', score: 20, detail: `${markup_multiplier.toFixed(1)}x markup` });
            } else if (markup_multiplier > 2) {
                likelihood += 10;
                signals.push({ name: 'Moderate Markup', score: 10, detail: `${markup_multiplier.toFixed(1)}x markup` });
            }
        }

        // 4. Title pattern analysis (dropship naming conventions)
        const dropshipTitlePatterns = [
            { pattern: /\b(2024|2025|2026|new|hot|best)\b/i, weight: 5, flag: 'Generic trend keywords in title' },
            { pattern: /\b(luxury|premium|high quality)\b/i, weight: 5, flag: 'Aspirational keywords (common in dropship)' },
            { pattern: /\b(free shipping|fast shipping)\b/i, weight: 5, flag: 'Shipping emphasis (typical dropship)' },
            { pattern: /\b(unisex|men women|for men|for women)\b/i, weight: 3, flag: 'Broad targeting language' },
            { pattern: /\b(minimalist|fashion|casual|elegant)\b/i, weight: 3, flag: 'Generic style descriptors' }
        ];

        dropshipTitlePatterns.forEach(({ pattern, weight, flag }) => {
            if (pattern.test(product_title)) {
                likelihood += weight;
                signals.push({ name: 'Title Pattern', score: weight, detail: flag });
            }
        });

        // 5. Store URL patterns
        if (store_url) {
            const storeLower = store_url.toLowerCase();
            if (storeLower.includes('myshopify.com')) {
                likelihood += 10;
                signals.push({ name: 'Default Shopify Domain', score: 10, detail: 'Using myshopify.com subdomain (not custom domain)' });
                flags.push('No custom domain — typical of new/low-effort stores');
            }
        }

        // Clamp likelihood
        likelihood = Math.min(100, Math.max(0, likelihood));

        // Generate AliExpress search URL
        const searchQuery = encodeURIComponent(product_title || '');
        const aliexpressSearchUrl = `https://www.aliexpress.com/wholesale?SearchText=${searchQuery}`;
        const alibabSearchUrl = `https://www.alibaba.com/trade/search?SearchText=${searchQuery}`;

        // Verdict
        let verdict;
        if (likelihood >= 70) verdict = 'Highly likely dropshipped product';
        else if (likelihood >= 40) verdict = 'Possible dropship — check source pricing';
        else verdict = 'Low dropship indicators';

        return {
            likelihood,
            verdict,
            product_title,
            store_price: price,
            currency,
            estimated_source_price,
            markup_multiplier,
            category: detectedCategory || 'unknown',
            signals,
            flags,
            search_url: aliexpressSearchUrl,
            alibaba_url: alibabSearchUrl,
            processing_time_ms: Date.now() - startTime
        };
    }
};

module.exports = DropshipDetector;
