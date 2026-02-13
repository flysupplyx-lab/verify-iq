/**
 * Verify.IQ - Social Media Authenticity Analyzer V2 (Server-Side)
 * Mirror of extension/socialAnalyzer.js for API endpoint usage
 */

const SocialAnalyzer = {
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

        // HEURISTIC 1: Follower/Following Ratio
        if (following > 1000) {
            const ratio = followers / following;
            if (ratio < 0.05) {
                score -= 45;
                penalties.push({ reason: 'Extreme Bot Ratio', weight: -45 });
                flags.push('Mass-follow bot behavior');
            } else if (ratio < 0.1) {
                score -= 35;
                penalties.push({ reason: 'Suspicious Follower/Following Ratio', weight: -35 });
            } else if (ratio < 0.5) {
                score -= 15;
                penalties.push({ reason: 'Low Follower/Following Ratio', weight: -15 });
            }
        }

        // HEURISTIC 2: Engagement Mismatch
        if (followers > 5000) {
            let engagementRate = 0;
            if (avgLikes > 0) {
                engagementRate = (avgLikes / followers) * 100;
            } else if (totalLikes > 0) {
                engagementRate = totalLikes / followers < 1 ? 0.01 : 1;
            }

            if (engagementRate > 0 && engagementRate < 0.05) {
                score -= 35;
                penalties.push({ reason: 'Critical Engagement Mismatch', weight: -35 });
                flags.push('Bought followers detected');
            } else if (engagementRate > 0 && engagementRate < 0.3) {
                score -= 15;
                penalties.push({ reason: 'Low Engagement', weight: -15 });
            }
        }

        // HEURISTIC 3: Engagement Variance
        if (recentLikes.length >= 3) {
            const mean = recentLikes.reduce((a, b) => a + b, 0) / recentLikes.length;
            const variance = recentLikes.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recentLikes.length;
            const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
            if (cv < 0.05 && mean > 100) {
                score -= 15;
                penalties.push({ reason: 'Suspiciously uniform engagement', weight: -15 });
                flags.push('Bot farm engagement pattern');
            }
        }

        // HEURISTIC 4: Comment Quality
        if (comments.length > 0) {
            const analysis = SocialAnalyzer.analyzeComments(comments);
            if (analysis.lowQualityPct > 0.6) {
                score -= 25;
                penalties.push({ reason: `${Math.round(analysis.lowQualityPct * 100)}% spam comments`, weight: -25 });
                flags.push('Comment section is bot spam');
            } else if (analysis.lowQualityPct > 0.4) {
                score -= 12;
                penalties.push({ reason: 'High generic comments', weight: -12 });
            }

            if (analysis.botUsernamePct > 0.5) {
                score -= 20;
                penalties.push({ reason: `${Math.round(analysis.botUsernamePct * 100)}% bot usernames`, weight: -20 });
                flags.push('Bot usernames in comments');
            }

            if (analysis.duplicatePct > 0.3) {
                score -= 15;
                penalties.push({ reason: 'Duplicate comments detected', weight: -15 });
            }
        }

        // HEURISTIC 5: Bio Red Flags
        if (bio) {
            const bioFlags = SocialAnalyzer.analyzeBio(bio);
            if (bioFlags.length > 0) {
                const bioWeight = Math.min(bioFlags.length * 5, 15);
                score -= bioWeight;
                penalties.push({ reason: `Bio: ${bioFlags.length} promo indicator(s)`, weight: -bioWeight });
                flags.push(...bioFlags);
            }
        }

        // HEURISTIC 6: Account Age
        if (creationDate) {
            const ageMs = Date.now() - new Date(creationDate).getTime();
            const ageMonths = ageMs / (1000 * 60 * 60 * 24 * 30);
            if (ageMonths < 1) {
                score -= 20;
                penalties.push({ reason: 'Account < 1 month old', weight: -20 });
                flags.push('Brand new account');
            } else if (ageMonths < 3) {
                score -= 10;
                penalties.push({ reason: 'Account < 3 months old', weight: -10 });
            } else if (ageMonths > 24) {
                score += 5;
                bonuses.push({ reason: 'Account > 2 years', weight: 5 });
            }
        }

        // HEURISTIC 7: Verification
        if (isVerified) {
            score += 10;
            bonuses.push({ reason: 'Platform Verified', weight: 10 });
        }

        score = Math.max(0, Math.min(100, score));

        return {
            score,
            verdict: score > 80 ? 'Authentic' : score > 60 ? 'Plausible' : score > 40 ? 'Suspicious' : 'Bot/Fake',
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

    analyzeComments: (comments) => {
        if (!comments || comments.length === 0) return { lowQualityPct: 0, botUsernamePct: 0, duplicatePct: 0 };

        const lowQualityPats = [
            /^[\p{Emoji}\s]+$/u, /^(nice|wow|great|cool|fire|love|amazing|awesome|beautiful|perfect|best|good|yes|no|ok|omg|lol|lmao|haha)!*\.?$/i,
            /^.{1,3}$/, /^(follow me|check my|link in|dm me|sub4sub)/i, /^(first|second|third|1st|2nd|3rd)!*$/i
        ];
        const botNamePats = [/^user[_\d]+$/i, /\d{4,}$/, /^[a-z]+\d{3,}[a-z]*$/i, /(.)\1{3,}/, /^(bot|fake|spam|follow|gain)/i];

        let low = 0, bots = 0, dupes = 0;
        const seen = new Set();

        comments.forEach(c => {
            const text = (c.text || '').trim().toLowerCase();
            const user = (c.username || '').trim();
            if (lowQualityPats.some(p => p.test(text)) || text.length < 4) low++;
            if (botNamePats.some(p => p.test(user))) bots++;
            if (seen.has(text)) dupes++;
            seen.add(text);
        });

        return { lowQualityPct: low / comments.length, botUsernamePct: bots / comments.length, duplicatePct: dupes / comments.length };
    },

    analyzeBio: (bio) => {
        if (!bio) return [];
        const flags = [];
        const patterns = [
            { p: /link in bio|linktree|beacons\.ai/i, f: 'Multi-link aggregator' },
            { p: /dm (me|for|to)/i, f: 'DM solicitation' },
            { p: /free (course|masterclass|ebook|guide|training)/i, f: 'Free course funnel' },
            { p: /limited (spots|time|offer|seats)/i, f: 'Scarcity tactics' },
            { p: /make \$|earn \$|passive income|financial freedom/i, f: 'Money claims' },
            { p: /collab|promo|sponsor|shoutout/i, f: 'Promo solicitation' },
            { p: /not financial advice|nfa|dyor/i, f: 'Financial disclaimer' }
        ];
        patterns.forEach(({ p, f }) => { if (p.test(bio)) flags.push(f); });
        return flags;
    }
};

module.exports = SocialAnalyzer;
