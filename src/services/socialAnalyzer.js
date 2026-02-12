/**
 * Verify.IQ - Social Media Authenticity Analyzer
 * Core logic for calculating "Realness Score" based on profile metrics.
 */

const SocialAnalyzer = {
    /**
     * Calculates the Integrity Score (0-100) for a social media profile.
     * @param {Object} profileData - The extracted profile data.
     * @param {number} profileData.followers - Number of followers.
     * @param {number} profileData.following - Number of accounts following.
     * @param {number} profileData.avgLikes - Average likes per post (from recent posts).
     * @param {boolean} profileData.isVerified - Whether the account has a verified badge.
     * @param {string} profileData.creationDate - Account creation date (optional string).
     * @returns {Object} Score result with breakdown.
     */
    calculateIntegrityScore: (profileData) => {
        let score = 100;
        const penalties = [];
        const bonuses = [];

        const { followers, following, avgLikes, isVerified, creationDate } = profileData;

        // --- HEURISTIC 1: Follower/Following Ratio (The "Bot" Ratio) ---
        // Penalty if they follow many but have few followers.
        if (following > 1000) {
            const ratio = followers / following;
            if (ratio < 0.1) {
                // e.g. Following 5000, Followers 100 => Ratio 0.02
                score -= 40;
                penalties.push({ reason: 'Suspicious Follower/Following Ratio', weight: -40 });
            } else if (ratio < 0.5) {
                score -= 15;
                penalties.push({ reason: 'Low Follower/Following Ratio', weight: -15 });
            }
        }

        // --- HEURISTIC 2: Engagement Mismatch (Bought Followers) ---
        // Penalty if high followers but low engagement.
        if (followers > 10000) {
            const engagementRate = (avgLikes / followers) * 100;
            // Typical engagement rates vary, but < 0.1% for <100k is very suspicious for "influencers"
            if (engagementRate < 0.05) {
                score -= 30;
                penalties.push({ reason: 'Critical Engagement Mismatch (Possible Bought Followers)', weight: -30 });
            } else if (engagementRate < 0.5) {
                score -= 10;
                penalties.push({ reason: 'Low Engagement for Follower Count', weight: -10 });
            }
        }

        // --- HEURISTIC 3: Account Age (if available) ---
        if (creationDate) {
            const created = new Date(creationDate);
            const now = new Date();
            const ageInMonths = (now - created) / (1000 * 60 * 60 * 24 * 30);

            if (ageInMonths < 1) {
                score -= 20;
                penalties.push({ reason: 'New Account (< 1 month)', weight: -20 });
            } else if (ageInMonths > 12) {
                // Small bonus for longevity? Or just no penalty.
                // Let's give a trust bump for > 1 year
                score += 5;
                bonuses.push({ reason: 'Account Age > 1 Year', weight: 5 });
            }
        }

        // --- HEURISTIC 4: Verification Badge ---
        if (isVerified) {
            // Verified accounts get a trust floor or bonus
            score += 10;
            bonuses.push({ reason: 'Platform Verified', weight: 10 });
        }

        // Clamp score
        score = Math.max(0, Math.min(100, score));

        return {
            score,
            verdict: score > 80 ? 'Authentic' : score > 50 ? 'Suspicious' : 'Bot/Fake',
            details: { penalties, bonuses }
        };
    }
};

// Export for use in extension
if (typeof module !== 'undefined') {
    module.exports = SocialAnalyzer;
}
