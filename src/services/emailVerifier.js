const dns = require('dns');
const { promisify } = require('util');
const { DISPOSABLE_DOMAINS, FREE_PROVIDERS, ROLE_PREFIXES } = require('../data/disposable-domains');

const resolveMx = promisify(dns.resolveMx);
const resolveTxt = promisify(dns.resolveTxt);
const resolve4 = promisify(dns.resolve4);

// Common domain typos and their corrections
const DOMAIN_TYPOS = {
    'gmial.com': 'gmail.com', 'gmal.com': 'gmail.com', 'gmaill.com': 'gmail.com',
    'gamil.com': 'gmail.com', 'gnail.com': 'gmail.com', 'gmail.co': 'gmail.com',
    'gmail.con': 'gmail.com', 'gmai.com': 'gmail.com', 'gmil.com': 'gmail.com',
    'yahooo.com': 'yahoo.com', 'yaho.com': 'yahoo.com', 'yaoo.com': 'yahoo.com',
    'yahoo.co': 'yahoo.com', 'yahoo.con': 'yahoo.com',
    'hotmal.com': 'hotmail.com', 'hotmial.com': 'hotmail.com',
    'hotmil.com': 'hotmail.com', 'hotmail.co': 'hotmail.com',
    'outlok.com': 'outlook.com', 'outloo.com': 'outlook.com',
    'outlook.co': 'outlook.com', 'outlookcom': 'outlook.com',
    'icloud.co': 'icloud.com', 'iclod.com': 'icloud.com',
    'protonmal.com': 'protonmail.com', 'protonmail.co': 'protonmail.com',
};

class EmailVerifier {

    /**
     * Full email verification pipeline
     */
    async verify(email) {
        const startTime = Date.now();
        const result = {
            email: email?.trim()?.toLowerCase(),
            timestamp: new Date().toISOString(),
            checks: {},
            score: 0,
            verdict: 'unknown',
            risk_level: 'unknown',
            suggestions: [],
        };

        if (!result.email) {
            result.verdict = 'invalid';
            result.risk_level = 'critical';
            result.checks.syntax = { valid: false, reason: 'Empty email provided' };
            result.processing_time_ms = Date.now() - startTime;
            return result;
        }

        // 1. Syntax Check
        result.checks.syntax = this.checkSyntax(result.email);
        if (!result.checks.syntax.valid) {
            result.verdict = 'invalid';
            result.risk_level = 'critical';
            result.score = 0;
            result.processing_time_ms = Date.now() - startTime;
            return result;
        }

        const [localPart, domain] = result.email.split('@');

        // 2. Typo Detection
        result.checks.typo = this.checkTypo(domain);
        if (result.checks.typo.has_typo) {
            result.suggestions.push(`Did you mean ${localPart}@${result.checks.typo.suggested_domain}?`);
        }

        // 3. Disposable Email Detection
        result.checks.disposable = this.checkDisposable(domain);

        // 4. Free Provider Detection
        result.checks.free_provider = this.checkFreeProvider(domain);

        // 5. Role-Based Detection
        result.checks.role_based = this.checkRoleBased(localPart);

        // 6. DNS / MX Record Check
        result.checks.dns = await this.checkDNS(domain);

        // 7. Domain Reputation Signals
        result.checks.domain = await this.checkDomainReputation(domain);

        // 8. Local Part Quality
        result.checks.local_part = this.checkLocalPart(localPart);

        // Calculate final score
        const scoring = this.calculateScore(result.checks);
        result.score = scoring.score;
        result.verdict = scoring.verdict;
        result.risk_level = scoring.risk_level;
        result.risk_factors = scoring.risk_factors;
        result.processing_time_ms = Date.now() - startTime;

        return result;
    }

    /**
     * Validate email syntax using RFC 5322 simplified pattern
     */
    checkSyntax(email) {
        const result = { valid: false, reason: '' };

        if (!email || typeof email !== 'string') {
            result.reason = 'Email must be a non-empty string';
            return result;
        }

        if (email.length > 254) {
            result.reason = 'Email exceeds maximum length of 254 characters';
            return result;
        }

        const parts = email.split('@');
        if (parts.length !== 2) {
            result.reason = 'Email must contain exactly one @ symbol';
            return result;
        }

        const [localPart, domain] = parts;

        if (localPart.length === 0 || localPart.length > 64) {
            result.reason = 'Local part must be between 1 and 64 characters';
            return result;
        }

        if (domain.length === 0 || domain.length > 253) {
            result.reason = 'Domain must be between 1 and 253 characters';
            return result;
        }

        // Check for valid characters in local part
        const localRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/;
        if (!localRegex.test(localPart)) {
            result.reason = 'Local part contains invalid characters';
            return result;
        }

        // Check local part doesn't start or end with a dot
        if (localPart.startsWith('.') || localPart.endsWith('.') || localPart.includes('..')) {
            result.reason = 'Local part has invalid dot placement';
            return result;
        }

        // Check domain format
        const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
        if (!domainRegex.test(domain)) {
            result.reason = 'Domain format is invalid';
            return result;
        }

        result.valid = true;
        result.reason = 'Syntax is valid';
        return result;
    }

    /**
     * Check for common domain typos
     */
    checkTypo(domain) {
        const suggested = DOMAIN_TYPOS[domain.toLowerCase()];
        return {
            has_typo: !!suggested,
            suggested_domain: suggested || null,
        };
    }

    /**
     * Check if domain is a disposable email service
     */
    checkDisposable(domain) {
        const isDisposable = DISPOSABLE_DOMAINS.has(domain.toLowerCase());
        return {
            is_disposable: isDisposable,
            description: isDisposable
                ? 'This is a known disposable/temporary email service'
                : 'Not a known disposable email service',
        };
    }

    /**
     * Check if domain is a free email provider
     */
    checkFreeProvider(domain) {
        const isFree = FREE_PROVIDERS.has(domain.toLowerCase());
        return {
            is_free: isFree,
            description: isFree ? 'Free email provider' : 'Custom/business domain',
        };
    }

    /**
     * Check if email uses a role-based prefix
     */
    checkRoleBased(localPart) {
        const prefix = localPart.toLowerCase().split(/[.+_-]/)[0];
        const isRole = ROLE_PREFIXES.has(prefix);
        return {
            is_role_based: isRole,
            description: isRole
                ? `"${prefix}" is a role-based email prefix (not a personal inbox)`
                : 'Appears to be a personal email address',
        };
    }

    /**
     * DNS verification - check MX records
     */
    async checkDNS(domain) {
        const result = {
            has_mx: false,
            has_a: false,
            mx_records: [],
            valid: false,
        };

        try {
            const mxRecords = await resolveMx(domain);
            if (mxRecords && mxRecords.length > 0) {
                result.has_mx = true;
                result.mx_records = mxRecords
                    .sort((a, b) => a.priority - b.priority)
                    .slice(0, 5)
                    .map(r => ({ priority: r.priority, exchange: r.exchange }));
                result.valid = true;
            }
        } catch (err) {
            // MX lookup failed
        }

        try {
            const aRecords = await resolve4(domain);
            if (aRecords && aRecords.length > 0) {
                result.has_a = true;
                if (!result.valid) result.valid = true; // A record can accept mail as fallback
            }
        } catch (err) {
            // A record lookup failed
        }

        result.description = result.valid
            ? `Domain has valid mail configuration (${result.mx_records.length} MX records)`
            : 'Domain has no mail server configured - cannot receive email';

        return result;
    }

    /**
     * Additional domain reputation signals
     */
    async checkDomainReputation(domain) {
        const result = {
            has_spf: false,
            has_dmarc: false,
        };

        // Check SPF record
        try {
            const txtRecords = await resolveTxt(domain);
            for (const record of txtRecords) {
                const txt = record.join('');
                if (txt.startsWith('v=spf1')) {
                    result.has_spf = true;
                }
            }
        } catch (err) {
            // TXT lookup failed
        }

        // Check DMARC record
        try {
            const dmarcRecords = await resolveTxt(`_dmarc.${domain}`);
            for (const record of dmarcRecords) {
                const txt = record.join('');
                if (txt.startsWith('v=DMARC1')) {
                    result.has_dmarc = true;
                }
            }
        } catch (err) {
            // DMARC lookup failed
        }

        result.description = result.has_spf && result.has_dmarc
            ? 'Domain has proper email authentication (SPF + DMARC)'
            : result.has_spf
                ? 'Domain has SPF but missing DMARC'
                : 'Domain lacks email authentication records';

        return result;
    }

    /**
     * Analyze local part quality
     */
    checkLocalPart(localPart) {
        const result = {
            quality: 'normal',
            issues: [],
        };

        // Check for excessive numbers
        const numberRatio = (localPart.match(/\d/g) || []).length / localPart.length;
        if (numberRatio > 0.6) {
            result.issues.push('Excessive numbers in local part');
            result.quality = 'suspicious';
        }

        // Check for very short local part
        if (localPart.length <= 2) {
            result.issues.push('Very short local part');
            result.quality = 'suspicious';
        }

        // Check for random-looking strings
        const consonantCluster = /[^aeiou]{6,}/i;
        if (consonantCluster.test(localPart)) {
            result.issues.push('Appears to be randomly generated');
            result.quality = 'suspicious';
        }

        // Check for keyboard patterns
        const keyboardPatterns = ['qwerty', 'asdfgh', 'zxcvbn', 'qazwsx', '12345', 'abcdef'];
        for (const pattern of keyboardPatterns) {
            if (localPart.toLowerCase().includes(pattern)) {
                result.issues.push('Contains keyboard pattern');
                result.quality = 'suspicious';
                break;
            }
        }

        if (result.issues.length === 0) {
            result.description = 'Local part appears normal';
        } else {
            result.description = `Local part has ${result.issues.length} quality issue(s)`;
        }

        return result;
    }

    /**
     * Calculate final score and verdict
     */
    calculateScore(checks) {
        let score = 100;
        const riskFactors = [];

        // Syntax (critical)
        if (!checks.syntax.valid) {
            return { score: 0, verdict: 'invalid', risk_level: 'critical', risk_factors: ['Invalid syntax'] };
        }

        // DNS (critical)
        if (!checks.dns.valid) {
            score -= 50;
            riskFactors.push('No mail server found for domain');
        }

        // Disposable (high risk)
        if (checks.disposable.is_disposable) {
            score -= 40;
            riskFactors.push('Disposable/temporary email service');
        }

        // Typo detected
        if (checks.typo.has_typo) {
            score -= 20;
            riskFactors.push(`Possible typo - did you mean @${checks.typo.suggested_domain}?`);
        }

        // Role-based
        if (checks.role_based.is_role_based) {
            score -= 10;
            riskFactors.push('Role-based email address');
        }

        // Local part quality
        if (checks.local_part.quality === 'suspicious') {
            score -= 15;
            riskFactors.push('Suspicious local part format');
        }

        // Domain reputation bonuses
        if (checks.domain.has_spf && checks.domain.has_dmarc) {
            score = Math.min(100, score + 5);
        } else if (!checks.domain.has_spf) {
            score -= 5;
            riskFactors.push('Domain lacks SPF authentication');
        }

        // Free provider (slight penalty for B2B use cases)
        if (checks.free_provider.is_free) {
            score -= 3;
        }

        score = Math.max(0, Math.min(100, score));

        let verdict, risk_level;
        if (score >= 80) {
            verdict = 'deliverable';
            risk_level = 'low';
        } else if (score >= 60) {
            verdict = 'risky';
            risk_level = 'medium';
        } else if (score >= 30) {
            verdict = 'risky';
            risk_level = 'high';
        } else {
            verdict = 'undeliverable';
            risk_level = 'critical';
        }

        return { score, verdict, risk_level, risk_factors: riskFactors };
    }
}

module.exports = new EmailVerifier();
