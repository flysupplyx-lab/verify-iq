/**
 * VerifyIQ V2 — URL Scanner Service
 * Performs comprehensive URL analysis:
 * - Domain WHOIS / age lookup
 * - SSL certificate validation
 * - DNS record analysis
 * - Safe browsing / threat detection
 * - Overall IQ Score computation
 */

const dns = require('dns').promises;
const https = require('https');
const http = require('http');
const { URL } = require('url');
const tls = require('tls');

// ============================================
// CONFIGURATION
// ============================================

const WHOIS_API_KEY = process.env.WHOIS_API_KEY || '';
const SAFE_BROWSING_KEY = process.env.SAFE_BROWSING_KEY || '';
const IPQS_KEY = process.env.IPQS_KEY || '';

// Known suspicious TLDs (higher risk)
const SUSPICIOUS_TLDS = new Set([
    '.xyz', '.top', '.club', '.work', '.click', '.loan', '.win',
    '.gq', '.ml', '.cf', '.ga', '.tk', '.buzz', '.icu', '.monster',
    '.quest', '.rest', '.surf', '.cam', '.bar', '.hair',
]);

// Known legitimate TLDs (lower risk)
const TRUSTED_TLDS = new Set([
    '.com', '.org', '.net', '.edu', '.gov', '.mil', '.int',
    '.co.uk', '.co', '.io', '.dev', '.app', '.ai', '.us',
]);

// Known phishing / scam patterns
const PHISHING_PATTERNS = [
    /paypal.*\.(?!com)/i,
    /amazon.*\.(?!com)/i,
    /apple.*\.(?!com)/i,
    /google.*\.(?!com)/i,
    /microsoft.*\.(?!com)/i,
    /facebook.*\.(?!com)/i,
    /login.*secure.*\./i,
    /account.*verify.*\./i,
    /update.*billing.*\./i,
    /free.*crypto.*\./i,
    /claim.*reward.*\./i,
];

// ============================================
// MAIN SCAN FUNCTION
// ============================================

async function scanUrl(url) {
    const startTime = Date.now();

    let parsedUrl;
    try {
        parsedUrl = new URL(url);
    } catch (e) {
        return {
            iq_score: 0,
            verdict: 'dangerous',
            error: 'Invalid URL format',
            url,
            processing_time_ms: Date.now() - startTime,
        };
    }

    const domain = parsedUrl.hostname;

    // Run all checks concurrently
    const [
        domainAgeResult,
        sslResult,
        dnsResult,
        safeBrowsingResult,
        whoisResult,
        reputationResult,
    ] = await Promise.allSettled([
        checkDomainAge(domain),
        checkSSL(domain, parsedUrl.protocol === 'https:'),
        checkDNS(domain),
        checkSafeBrowsing(url),
        checkWhois(domain),
        checkReputation(url, domain),
    ]);

    const checks = {
        domain_age: domainAgeResult.status === 'fulfilled' ? domainAgeResult.value : { error: 'Check failed', age_days: 0 },
        ssl: sslResult.status === 'fulfilled' ? sslResult.value : { valid: false, error: 'Check failed' },
        dns: dnsResult.status === 'fulfilled' ? dnsResult.value : { has_records: false, error: 'Check failed' },
        safe_browsing: safeBrowsingResult.status === 'fulfilled' ? safeBrowsingResult.value : { safe: true, fallback: true },
        whois: whoisResult.status === 'fulfilled' ? whoisResult.value : { registered: false, error: 'Check failed' },
        reputation: reputationResult.status === 'fulfilled' ? reputationResult.value : { score: 50 },
    };

    // Compute IQ Score
    const iq_score = computeIQScore(checks, url, domain);

    // Determine verdict
    let verdict;
    if (iq_score >= 75) verdict = 'safe';
    else if (iq_score >= 50) verdict = 'suspicious';
    else verdict = 'dangerous';

    return {
        iq_score,
        verdict,
        url,
        domain,
        checks,
        processing_time_ms: Date.now() - startTime,
    };
}

// ============================================
// CHECK: Domain Age
// ============================================

async function checkDomainAge(domain) {
    // Strip subdomains to get root domain
    const rootDomain = getRootDomain(domain);

    // Try WHOIS API if key is available
    if (WHOIS_API_KEY) {
        try {
            const response = await fetchJSON(
                `https://www.whoisxmlapi.com/whoisserver/WhoisService?apiKey=${WHOIS_API_KEY}&domainName=${rootDomain}&outputFormat=JSON`
            );
            if (response?.WhoisRecord?.createdDate) {
                const created = new Date(response.WhoisRecord.createdDate);
                const ageDays = Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24));
                return {
                    age_days: ageDays,
                    created_date: response.WhoisRecord.createdDate,
                    source: 'whoisxml',
                };
            }
        } catch (e) {
            // Fall through to heuristic
        }
    }

    // Fallback: DNS-based heuristic
    try {
        const records = await dns.resolveNs(rootDomain);
        const hasEstablishedNS = records.some(ns =>
            ns.includes('cloudflare') || ns.includes('awsdns') ||
            ns.includes('google') || ns.includes('domaincontrol') ||
            ns.includes('registrar')
        );

        return {
            age_days: hasEstablishedNS ? 365 : 30,
            estimated: true,
            nameservers: records.slice(0, 3),
            source: 'dns_heuristic',
        };
    } catch (e) {
        return { age_days: 0, error: 'Could not determine domain age' };
    }
}

// ============================================
// CHECK: SSL Certificate
// ============================================

async function checkSSL(domain, isHttps) {
    if (!isHttps) {
        return { valid: false, error: 'Site does not use HTTPS' };
    }

    return new Promise((resolve) => {
        const socket = tls.connect(443, domain, { servername: domain, timeout: 5000 }, () => {
            const cert = socket.getPeerCertificate();
            socket.end();

            if (!cert || !cert.subject) {
                resolve({ valid: false, error: 'No certificate found' });
                return;
            }

            const now = new Date();
            const validFrom = new Date(cert.valid_from);
            const validTo = new Date(cert.valid_to);
            const daysLeft = Math.floor((validTo - now) / (1000 * 60 * 60 * 24));

            resolve({
                valid: now >= validFrom && now <= validTo,
                issuer: cert.issuer?.O || cert.issuer?.CN || 'Unknown',
                subject: cert.subject?.CN || domain,
                valid_from: cert.valid_from,
                valid_to: cert.valid_to,
                days_remaining: daysLeft,
                fingerprint: cert.fingerprint256?.substring(0, 20) + '...',
            });
        });

        socket.on('error', (err) => {
            resolve({ valid: false, error: err.message || 'SSL connection failed' });
        });

        socket.setTimeout(5000, () => {
            socket.destroy();
            resolve({ valid: false, error: 'SSL check timed out' });
        });
    });
}

// ============================================
// CHECK: DNS Records
// ============================================

async function checkDNS(domain) {
    const results = { has_records: false, mx_count: 0, a_count: 0, ns_count: 0 };

    const checks = await Promise.allSettled([
        dns.resolve(domain, 'A'),
        dns.resolve(domain, 'MX'),
        dns.resolve(domain, 'NS'),
        dns.resolve(domain, 'TXT'),
    ]);

    // A records
    if (checks[0].status === 'fulfilled') {
        results.a_records = checks[0].value;
        results.a_count = checks[0].value.length;
        results.has_records = true;
    }

    // MX records
    if (checks[1].status === 'fulfilled') {
        results.mx_records = checks[1].value.map(r => r.exchange).slice(0, 3);
        results.mx_count = checks[1].value.length;
        results.has_records = true;
    }

    // NS records
    if (checks[2].status === 'fulfilled') {
        results.ns_records = checks[2].value.slice(0, 3);
        results.ns_count = checks[2].value.length;
        results.has_records = true;
    }

    // TXT records (look for SPF/DMARC)
    if (checks[3].status === 'fulfilled') {
        const txts = checks[3].value.flat();
        results.has_spf = txts.some(t => t.includes('v=spf1'));
        results.has_dmarc = txts.some(t => t.includes('v=DMARC1'));
    }

    return results;
}

// ============================================
// CHECK: Safe Browsing
// ============================================

async function checkSafeBrowsing(url) {
    // Google Safe Browsing API
    if (SAFE_BROWSING_KEY) {
        try {
            const response = await fetchJSON(
                `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${SAFE_BROWSING_KEY}`,
                {
                    method: 'POST',
                    body: JSON.stringify({
                        client: { clientId: 'verifyiq', clientVersion: '2.0.0' },
                        threatInfo: {
                            threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
                            platformTypes: ['ANY_PLATFORM'],
                            threatEntryTypes: ['URL'],
                            threatEntries: [{ url }],
                        },
                    }),
                }
            );

            if (response?.matches && response.matches.length > 0) {
                return {
                    safe: false,
                    threats: response.matches.map(m => m.threatType),
                    source: 'google_safe_browsing',
                };
            }
            return { safe: true, source: 'google_safe_browsing' };
        } catch (e) {
            // Fall through to pattern matching
        }
    }

    // Fallback: Pattern-based detection
    const isPhishing = PHISHING_PATTERNS.some(pattern => pattern.test(url));

    return {
        safe: !isPhishing,
        threats: isPhishing ? ['PATTERN_MATCH'] : [],
        source: 'pattern_heuristic',
    };
}

// ============================================
// CHECK: WHOIS Registration
// ============================================

async function checkWhois(domain) {
    const rootDomain = getRootDomain(domain);

    if (WHOIS_API_KEY) {
        try {
            const response = await fetchJSON(
                `https://www.whoisxmlapi.com/whoisserver/WhoisService?apiKey=${WHOIS_API_KEY}&domainName=${rootDomain}&outputFormat=JSON`
            );
            const record = response?.WhoisRecord;
            if (record) {
                return {
                    registered: true,
                    registrar: record.registrarName || 'Unknown',
                    created_date: record.createdDate,
                    expires_date: record.expiresDate,
                    country: record.registrant?.country || null,
                    source: 'whoisxml',
                };
            }
        } catch (e) {
            // Fall through
        }
    }

    // Fallback: Check if domain resolves
    try {
        await dns.resolve(rootDomain, 'A');
        return {
            registered: true,
            registrar: 'Unknown (no WHOIS key)',
            source: 'dns_fallback',
        };
    } catch (e) {
        return { registered: false, error: 'Domain does not resolve' };
    }
}

// ============================================
// CHECK: URL Reputation
// ============================================

async function checkReputation(url, domain) {
    // IPQualityScore check
    if (IPQS_KEY) {
        try {
            const encodedUrl = encodeURIComponent(url);
            const response = await fetchJSON(
                `https://ipqualityscore.com/api/json/url/${IPQS_KEY}/${encodedUrl}`
            );
            if (response && typeof response.risk_score === 'number') {
                return {
                    score: 100 - response.risk_score,
                    phishing: response.phishing || false,
                    malware: response.malware || false,
                    suspicious: response.suspicious || false,
                    category: response.category || 'Unknown',
                    source: 'ipqualityscore',
                };
            }
        } catch (e) {
            // Fall through
        }
    }

    // Fallback: Heuristic reputation scoring
    let score = 70; // Start neutral-positive

    // TLD analysis
    const tld = '.' + domain.split('.').pop();
    if (TRUSTED_TLDS.has(tld)) score += 10;
    if (SUSPICIOUS_TLDS.has(tld)) score -= 25;

    // Domain length
    const rootDomain = getRootDomain(domain);
    if (rootDomain.length > 30) score -= 10;
    if (rootDomain.length < 6) score += 5;

    // Suspicious characters
    if (domain.includes('-') && domain.split('-').length > 3) score -= 15;
    if (/\d{4,}/.test(domain)) score -= 10;

    // Subdomain depth
    const subdomainCount = domain.split('.').length - 2;
    if (subdomainCount > 2) score -= 10;

    // Phishing patterns
    if (PHISHING_PATTERNS.some(p => p.test(url))) score -= 30;

    score = Math.max(0, Math.min(100, score));

    return {
        score,
        source: 'heuristic',
    };
}

// ============================================
// IQ SCORE COMPUTATION
// ============================================

function computeIQScore(checks, url, domain) {
    let score = 0;
    let totalWeight = 0;

    // Domain Age — Weight: 25
    const ageWeight = 25;
    totalWeight += ageWeight;
    if (checks.domain_age.age_days > 730) score += ageWeight; // 2+ years
    else if (checks.domain_age.age_days > 365) score += ageWeight * 0.8;
    else if (checks.domain_age.age_days > 180) score += ageWeight * 0.6;
    else if (checks.domain_age.age_days > 30) score += ageWeight * 0.3;
    else score += ageWeight * 0.1;

    // SSL — Weight: 15
    const sslWeight = 15;
    totalWeight += sslWeight;
    if (checks.ssl.valid) {
        score += sslWeight;
        // Bonus for long-lived certs
        if (checks.ssl.days_remaining > 90) score += 2;
    }

    // Safe Browsing — Weight: 30
    const sbWeight = 30;
    totalWeight += sbWeight;
    if (checks.safe_browsing.safe) score += sbWeight;

    // DNS — Weight: 10
    const dnsWeight = 10;
    totalWeight += dnsWeight;
    if (checks.dns.has_records) {
        score += dnsWeight * 0.5;
        if (checks.dns.mx_count > 0) score += dnsWeight * 0.2;
        if (checks.dns.has_spf) score += dnsWeight * 0.15;
        if (checks.dns.has_dmarc) score += dnsWeight * 0.15;
    }

    // WHOIS — Weight: 10
    const whoisWeight = 10;
    totalWeight += whoisWeight;
    if (checks.whois.registered) {
        score += whoisWeight * 0.6;
        if (checks.whois.registrar && checks.whois.registrar !== 'Unknown (no WHOIS key)') {
            score += whoisWeight * 0.4;
        }
    }

    // Reputation — Weight: 10
    const repWeight = 10;
    totalWeight += repWeight;
    score += (checks.reputation.score / 100) * repWeight;

    // Normalize to 0-100
    const iqScore = Math.round(Math.max(0, Math.min(100, (score / totalWeight) * 100)));

    return iqScore;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function getRootDomain(domain) {
    const parts = domain.split('.');
    if (parts.length <= 2) return domain;
    // Handle co.uk, com.au, etc.
    const slds = ['co', 'com', 'net', 'org', 'gov', 'edu', 'ac'];
    if (parts.length >= 3 && slds.includes(parts[parts.length - 2])) {
        return parts.slice(-3).join('.');
    }
    return parts.slice(-2).join('.');
}

function fetchJSON(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const transport = urlObj.protocol === 'https:' ? https : http;

        const reqOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port,
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'VerifyIQ/2.0',
                ...(options.headers || {}),
            },
            timeout: 8000,
        };

        const req = transport.request(reqOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error('Invalid JSON response'));
                }
            });
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timed out'));
        });

        if (options.body) {
            req.write(options.body);
        }
        req.end();
    });
}

module.exports = { scanUrl };
