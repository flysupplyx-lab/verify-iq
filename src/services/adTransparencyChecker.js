/**
 * Verify.IQ - Ad Transparency Checker Service
 * Checks if influencers/profiles are actively running paid ads.
 * Uses Meta Ad Library search URLs + bio/funnel heuristic analysis.
 */

const https = require('https');

// Known funnel/guru indicators in bio text
const FUNNEL_PATTERNS = [
    { pattern: /free (course|masterclass|webinar|training|ebook|guide|workshop)/i, flag: 'Free lead magnet (course/webinar/ebook)' },
    { pattern: /limited (spots|seats|time|offer|availability)/i, flag: 'Scarcity/urgency tactics' },
    { pattern: /link in bio|linktree|linktr\.ee|beacons\.ai|stan\.store/i, flag: 'Multi-link aggregator (sales funnel)' },
    { pattern: /dm (me|for|to) (get|learn|start)/i, flag: 'DM-based sales funnel' },
    { pattern: /passive income|financial freedom|quit.*(job|9.to.5)|work from (home|anywhere)/i, flag: 'Income/lifestyle claims' },
    { pattern: /make \$|earn \$|\$\d+k|\d+k\/month|6.figure|7.figure/i, flag: 'Specific income claims' },
    { pattern: /coaching|mentoring|mentor|1.on.1|one.on.one/i, flag: 'Coaching/mentoring offer' },
    { pattern: /join (my|our|the) (community|academy|program|course|group)/i, flag: 'Community/program sales' },
    { pattern: /enroll|sign up|register|apply now|book a call/i, flag: 'CTA for enrollment' },
    { pattern: /testimonial|result|transformation|success stor/i, flag: 'Social proof language' },
    { pattern: /crypto|forex|trading|invest|nft/i, flag: 'Financial product promotion' },
    { pattern: /dropship|ecom|e-commerce|amazon fba|shopify/i, flag: 'Ecommerce course promotion' },
    { pattern: /smma|agency|client|freelanc/i, flag: 'Agency/freelance course pitch' },
    { pattern: /secret|hack|blueprint|formula|system|method/i, flag: 'Magic formula language' },
    { pattern: /🚀.*\$|💰.*link|💸.*dm|🔥.*(course|free)/i, flag: 'Emoji + sales combo' }
];

// Known advertising-heavy influencer categories
const GURU_CATEGORIES = [
    'business', 'entrepreneur', 'trading', 'crypto', 'forex',
    'real estate', 'coaching', 'motivation', 'self-improvement',
    'marketing', 'ecommerce', 'dropshipping', 'affiliate'
];

const AdTransparencyChecker = {
    /**
     * Check if a profile is running active ads
     * @param {string} username - Profile handle
     * @param {string} platform - Platform name
     * @param {string} [bio] - Optional bio text for analysis
     * @param {number} [followers] - Optional follower count
     * @returns {Object} Analysis result
     */
    analyze: async (username, platform = 'unknown', bio = '', followers = 0) => {
        const startTime = Date.now();

        // Analyze bio for funnel indicators
        const funnel_indicators = AdTransparencyChecker.analyzeFunnelIndicators(bio);

        // Generate ad library search URLs
        const adLibraryUrls = AdTransparencyChecker.getAdLibraryUrls(username, platform);

        // Heuristic: estimate ad likelihood based on bio + follower patterns
        let ad_likelihood = 0;
        const signals = [];

        // Funnel indicator scoring
        if (funnel_indicators.length >= 5) {
            ad_likelihood += 40;
            signals.push({ name: 'Heavy Funnel Bio', score: 40, detail: `${funnel_indicators.length} funnel indicators in bio` });
        } else if (funnel_indicators.length >= 3) {
            ad_likelihood += 25;
            signals.push({ name: 'Moderate Funnel Bio', score: 25, detail: `${funnel_indicators.length} funnel indicators in bio` });
        } else if (funnel_indicators.length >= 1) {
            ad_likelihood += 10;
            signals.push({ name: 'Some Funnel Signals', score: 10, detail: `${funnel_indicators.length} funnel indicator(s) in bio` });
        }

        // Follower count analysis (gurus typically have 10K-500K focused audiences)
        if (followers > 10000 && followers < 500000 && funnel_indicators.length > 0) {
            ad_likelihood += 15;
            signals.push({ name: 'Guru Follower Range', score: 15, detail: 'Follower count in typical guru/influencer ad range' });
        }

        // Platform-specific indicators
        if (platform === 'instagram' || platform === 'facebook') {
            ad_likelihood += 10; // Meta platforms have highest ad library visibility
            signals.push({ name: 'Meta Platform', score: 10, detail: 'Instagram/Facebook have comprehensive ad libraries' });
        }

        // Bio keyword category match
        const bioLower = (bio || '').toLowerCase();
        const matchedCategories = GURU_CATEGORIES.filter(cat => bioLower.includes(cat));
        if (matchedCategories.length > 0) {
            ad_likelihood += matchedCategories.length * 5;
            signals.push({ name: 'Guru Category Match', score: matchedCategories.length * 5, detail: `Matches: ${matchedCategories.join(', ')}` });
        }

        // Clamp
        ad_likelihood = Math.min(95, Math.max(0, ad_likelihood));

        // Determine if likely running ads
        const is_running_ads = ad_likelihood >= 40;

        // Estimate ad count (heuristic based on likelihood)
        const estimated_ad_count = is_running_ads
            ? Math.max(1, Math.round(ad_likelihood / 15))
            : 0;

        // Determine ad platforms
        const ad_platforms = [];
        if (platform === 'instagram' || platform === 'facebook') {
            ad_platforms.push('Meta (Facebook/Instagram)');
        }
        if (platform === 'tiktok') {
            ad_platforms.push('TikTok');
        }
        if (funnel_indicators.some(f => f.flag.includes('YouTube') || f.flag.includes('Google'))) {
            ad_platforms.push('Google/YouTube');
        }
        // Default
        if (ad_platforms.length === 0 && is_running_ads) {
            ad_platforms.push('Meta (Facebook/Instagram)'); // Most common
        }

        let verdict;
        if (ad_likelihood >= 70) verdict = 'This user is very likely spending money on ads to target you';
        else if (ad_likelihood >= 40) verdict = 'This user shows signs of active ad spending';
        else if (ad_likelihood >= 20) verdict = 'Some promotional indicators detected';
        else verdict = 'No strong ad indicators detected';

        return {
            username,
            platform,
            is_running_ads,
            ad_likelihood,
            ad_count: estimated_ad_count,
            ad_platforms,
            verdict,
            funnel_indicators: funnel_indicators.map(f => f.flag),
            signals,
            ad_library_url: adLibraryUrls.meta,
            tiktok_creative_url: adLibraryUrls.tiktok,
            manual_check_urls: adLibraryUrls,
            processing_time_ms: Date.now() - startTime
        };
    },

    /**
     * Analyze bio text for funnel/guru patterns
     */
    analyzeFunnelIndicators: (bio) => {
        if (!bio) return [];
        return FUNNEL_PATTERNS.filter(({ pattern }) => pattern.test(bio));
    },

    /**
     * Generate ad library search URLs for different platforms
     */
    getAdLibraryUrls: (username, platform) => {
        const encodedName = encodeURIComponent(username);
        return {
            meta: `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&q=${encodedName}`,
            tiktok: `https://library.tiktok.com/ads?region=all&keyword=${encodedName}`,
            google: `https://adstransparency.google.com/?search=${encodedName}`,
        };
    }
};

module.exports = AdTransparencyChecker;
