/**
 * Verify.IQ - Social Media Authenticity Analyzer V2
 * Enhanced scoring with comment analysis, bio flags, username patterns,
 * and posting cadence heuristics.
 */

const SocialAnalyzer = {
    /**
     * Calculates the Integrity Score (0-100) for a social media profile.
     * @param {Object} profileData
     * @param {number} profileData.followers
     * @param {number} profileData.following
     * @param {number} profileData.avgLikes
     * @param {number} profileData.totalLikes (TikTok)
     * @param {boolean} profileData.isVerified
     * @param {string} profileData.creationDate
     * @param {Array} profileData.comments - Array of { text, username }
     * @param {string} profileData.bio - Bio text
     * @param {Array} profileData.recentLikes - Array of like counts
     * @returns {Object} Score result with detailed breakdown.
     */
    calculateIntegrityScore: (profileData) => {
        let score = 100;
        const penalties = [];
        const bonuses = [];
        const flags = [];

        const {
            followers = 0, following = 0, avgLikes = 0,
            totalLikes = 0, isVerified = false, creationDate = null,
            comments = [], bio = '', recentLikes = []
        } = profileData;

        // --- HEURISTIC 1: Follower/Following Ratio (The "Bot" Ratio) ---
        if (following > 1000) {
            const ratio = followers / following;
            if (ratio < 0.05) {
                score -= 45;
                penalties.push({ reason: 'Extreme Bot Ratio (following >> followers)', weight: -45 });
                flags.push('🤖 Mass-follow bot behavior');
            } else if (ratio < 0.1) {
                score -= 35;
                penalties.push({ reason: 'Suspicious Follower/Following Ratio', weight: -35 });
            } else if (ratio < 0.5) {
                score -= 15;
                penalties.push({ reason: 'Low Follower/Following Ratio', weight: -15 });
            }
        }

        // --- HEURISTIC 2: Engagement Mismatch (Bought Followers) ---
        if (followers > 5000) {
            let engagementRate = 0;
            if (avgLikes > 0) {
                engagementRate = (avgLikes / followers) * 100;
            } else if (totalLikes > 0) {
                const likesPerFollower = totalLikes / followers;
                engagementRate = likesPerFollower < 1 ? 0.01 : 1;
            }

            if (engagementRate > 0 && engagementRate < 0.05) {
                score -= 35;
                penalties.push({ reason: 'Critical Engagement Mismatch — likely bought followers', weight: -35 });
                flags.push('💰 Bought followers detected');
            } else if (engagementRate > 0 && engagementRate < 0.3) {
                score -= 15;
                penalties.push({ reason: 'Low Engagement for Follower Count', weight: -15 });
            }
        }

        // --- HEURISTIC 3: Engagement Variance (if recent likes available) ---
        if (recentLikes.length >= 3) {
            const mean = recentLikes.reduce((a, b) => a + b, 0) / recentLikes.length;
            const variance = recentLikes.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recentLikes.length;
            const stdDev = Math.sqrt(variance);
            const cv = mean > 0 ? stdDev / mean : 0; // Coefficient of variation

            // Very low variance = suspiciously uniform engagement (bot farms give same likes)
            if (cv < 0.05 && mean > 100) {
                score -= 15;
                penalties.push({ reason: 'Suspiciously uniform engagement (bot farm pattern)', weight: -15 });
                flags.push('📊 Identical engagement = bot farm');
            }
        }

        // --- HEURISTIC 4: Comment Quality Analysis ---
        if (comments.length > 0) {
            const commentAnalysis = SocialAnalyzer.analyzeComments(comments);

            if (commentAnalysis.lowQualityPct > 0.6) {
                score -= 25;
                penalties.push({ reason: `${Math.round(commentAnalysis.lowQualityPct * 100)}% low-quality comments (emoji/generic spam)`, weight: -25 });
                flags.push('💬 Comment section is bot spam');
            } else if (commentAnalysis.lowQualityPct > 0.4) {
                score -= 12;
                penalties.push({ reason: 'High percentage of generic/low-effort comments', weight: -12 });
            }

            if (commentAnalysis.botUsernamePct > 0.5) {
                score -= 20;
                penalties.push({ reason: `${Math.round(commentAnalysis.botUsernamePct * 100)}% bot-pattern usernames`, weight: -20 });
                flags.push('🤖 Bot usernames in comments');
            }

            if (commentAnalysis.duplicatePct > 0.3) {
                score -= 15;
                penalties.push({ reason: 'Duplicate/copy-paste comments detected', weight: -15 });
            }
        }

        // --- HEURISTIC 5: Bio Red Flags ---
        if (bio) {
            const bioFlags = SocialAnalyzer.analyzeBio(bio);
            if (bioFlags.length > 0) {
                const bioWeight = Math.min(bioFlags.length * 5, 15);
                score -= bioWeight;
                penalties.push({ reason: `Bio contains ${bioFlags.length} promo/funnel indicator(s)`, weight: -bioWeight });
                flags.push(...bioFlags.map(f => `📝 ${f}`));
            }
        }

        // --- HEURISTIC 6: Account Age ---
        if (creationDate) {
            const created = new Date(creationDate);
            const now = new Date();
            const ageInMonths = (now - created) / (1000 * 60 * 60 * 24 * 30);

            if (ageInMonths < 1) {
                score -= 20;
                penalties.push({ reason: 'Account created less than 1 month ago', weight: -20 });
                flags.push('🆕 Brand new account');
            } else if (ageInMonths < 3) {
                score -= 10;
                penalties.push({ reason: 'Account less than 3 months old', weight: -10 });
            } else if (ageInMonths > 24) {
                score += 5;
                bonuses.push({ reason: 'Account Age > 2 Years', weight: 5 });
            }
        }

        // --- HEURISTIC 7: Verification Badge ---
        if (isVerified) {
            score += 10;
            bonuses.push({ reason: 'Platform Verified Badge', weight: 10 });
        }

        // Clamp score
        score = Math.max(0, Math.min(100, score));

        let verdict;
        if (score > 80) verdict = 'Authentic';
        else if (score > 60) verdict = 'Plausible';
        else if (score > 40) verdict = 'Suspicious';
        else verdict = 'Bot/Fake';

        return {
            score,
            verdict,
            flags,
            details: { penalties, bonuses },
            analysis: {
                follower_following_ratio: following > 0 ? (followers / following).toFixed(2) : 'N/A',
                engagement_rate: followers > 0 ? ((avgLikes / followers) * 100).toFixed(2) + '%' : 'N/A',
                comments_analyzed: comments.length,
                bio_flags: bio ? SocialAnalyzer.analyzeBio(bio).length : 0
            }
        };
    },

    /**
     * Analyze comments for quality indicators
     */
    analyzeComments: (comments) => {
        if (!comments || comments.length === 0) {
            return { lowQualityPct: 0, botUsernamePct: 0, duplicatePct: 0 };
        }

        const lowQualityPatterns = [
            /^[\p{Emoji}\s]+$/u,              // Emoji-only
            /^(nice|wow|great|cool|fire|love|amazing|awesome|beautiful|perfect|best|good|yes|no|ok|omg|lol|lmao|haha)!*\.?$/i,
            /^.{1,3}$/,                        // 1-3 characters
            /^(follow me|check my|link in|dm me|sub4sub)/i,
            /^(first|second|third|1st|2nd|3rd)!*$/i
        ];

        const botUsernamePatterns = [
            /^user[_\d]+$/i,
            /\d{4,}$/,                         // Ends with 4+ digits
            /^[a-z]+\d{3,}[a-z]*$/i,          // name + 3+ digits
            /(.)\1{3,}/,                       // Same char repeated 4+ times
            /^(bot|fake|spam|follow|gain)/i,
            /^[a-z]{2,4}\d{5,}/i              // Short letters + many digits
        ];

        let lowQuality = 0;
        let botUsernames = 0;
        const textSet = new Set();
        let duplicates = 0;

        comments.forEach(c => {
            const text = (c.text || '').trim().toLowerCase();
            const username = (c.username || '').trim();

            // Check low quality
            if (lowQualityPatterns.some(p => p.test(text)) || text.length < 4) {
                lowQuality++;
            }

            // Check bot usernames
            if (botUsernamePatterns.some(p => p.test(username))) {
                botUsernames++;
            }

            // Check duplicates
            if (textSet.has(text)) {
                duplicates++;
            }
            textSet.add(text);
        });

        return {
            lowQualityPct: lowQuality / comments.length,
            botUsernamePct: botUsernames / comments.length,
            duplicatePct: duplicates / comments.length
        };
    },

    /**
     * Analyze bio text for promo/funnel indicators
     */
    analyzeBio: (bio) => {
        if (!bio) return [];
        const lower = bio.toLowerCase();
        const flags = [];

        const funnelPatterns = [
            { pattern: /link in bio|linktree|linktr\.ee|beacons\.ai/i, flag: 'Multi-link aggregator' },
            { pattern: /dm (me|for|to)/i, flag: '"DM me" solicitation' },
            { pattern: /free (course|masterclass|ebook|guide|training)/i, flag: 'Free course funnel' },
            { pattern: /limited (spots|time|offer|seats)/i, flag: 'Scarcity/urgency tactics' },
            { pattern: /make \$|earn \$|passive income|financial freedom/i, flag: 'Money-making claims' },
            { pattern: /collab|promo|sponsor|shoutout/i, flag: 'Promo solicitation' },
            { pattern: /click (the|my) link|tap (the|my) link/i, flag: 'Link click bait' },
            { pattern: /💰|🤑|💸|💵|🔥.*link|👇.*link|⬇️.*link/i, flag: 'Money emoji + link bait' },
            { pattern: /join (my|our|the) (community|group|discord|telegram)/i, flag: 'Community funnel' },
            { pattern: /not financial advice|nfa|dyor/i, flag: 'Financial disclaimer (often precedes scam)' }
        ];

        funnelPatterns.forEach(({ pattern, flag }) => {
            if (pattern.test(bio)) flags.push(flag);
        });

        return flags;
    }
};

// Export for use in extension or Node.js
if (typeof module !== 'undefined') {
    module.exports = SocialAnalyzer;
}
