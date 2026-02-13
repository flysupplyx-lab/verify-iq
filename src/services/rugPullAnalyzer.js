/**
 * Verify.IQ - Rug Pull / Honeypot Analyzer
 * Checks smart contract addresses against HoneyPot.is API
 * and applies tokenomics heuristics.
 */

const https = require('https');
const http = require('http');

// Known safe tokens (whitelisted)
const KNOWN_SAFE = new Set([
    '0xdac17f958d2ee523a2206206994597c13d831ec7', // USDT
    '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC
    '0x6b175474e89094c44da98b954eedeac495271d0f', // DAI
    '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // WETH
    '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', // WBTC
    '0x514910771af9ca656af840dff83e8264ecf986ca', // LINK
    '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984', // UNI
    '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9', // AAVE
    '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce', // SHIB
]);

// Known scam patterns
const SCAM_NAME_PATTERNS = [
    /elon/i, /musk/i, /trump/i, /pepe.*2/i, /doge.*inu/i,
    /safe.*moon/i, /baby.*doge/i, /floki/i, /100x/i, /1000x/i,
    /moon.*shot/i, /gem.*find/i
];

const RugPullAnalyzer = {
    /**
     * Analyze a contract address for honeypot/rug pull risk
     * @param {string} address - Contract address (0x...)
     * @param {string} [chain='ethereum'] - Blockchain name
     * @returns {Promise<Object>} Analysis result
     */
    analyze: async (address, chain = 'ethereum') => {
        const startTime = Date.now();
        const normalizedAddr = address.toLowerCase().trim();

        // Quick check: known safe token
        if (KNOWN_SAFE.has(normalizedAddr)) {
            return {
                address,
                chain,
                isHoneypot: false,
                buyTax: 0,
                sellTax: 0,
                verdict: 'SAFE — Whitelisted Token',
                risk_level: 'safe',
                liquidity: 'High',
                lpLocked: true,
                signals: [{ name: 'Whitelisted', detail: 'This is a well-known, established token' }],
                processing_time_ms: Date.now() - startTime
            };
        }

        // Try HoneyPot.is API (free, no key needed)
        let honeypotData = null;
        try {
            honeypotData = await RugPullAnalyzer.checkHoneypotIs(normalizedAddr, chain);
        } catch (e) {
            console.warn('HoneyPot.is API unavailable, using heuristic fallback:', e.message);
        }

        if (honeypotData) {
            return {
                address,
                chain,
                isHoneypot: honeypotData.isHoneypot,
                buyTax: honeypotData.buyTax,
                sellTax: honeypotData.sellTax,
                verdict: honeypotData.verdict,
                risk_level: honeypotData.risk_level,
                liquidity: honeypotData.liquidity,
                lpLocked: honeypotData.lpLocked,
                tokenName: honeypotData.tokenName,
                tokenSymbol: honeypotData.tokenSymbol,
                signals: honeypotData.signals,
                processing_time_ms: Date.now() - startTime
            };
        }

        // Fallback: Heuristic analysis based on address patterns
        return RugPullAnalyzer.heuristicAnalysis(address, chain, startTime);
    },

    /**
     * Call HoneyPot.is API
     */
    checkHoneypotIs: (address, chain) => {
        return new Promise((resolve, reject) => {
            const chainIdMap = {
                ethereum: 1, bsc: 56, polygon: 137,
                arbitrum: 42161, base: 8453, avalanche: 43114
            };
            const chainId = chainIdMap[chain] || 1;

            const url = `https://api.honeypot.is/v2/IsHoneypot?address=${address}&chainID=${chainId}`;

            https.get(url, { timeout: 8000 }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        const isHoneypot = json.honeypotResult?.isHoneypot || false;
                        const buyTax = Math.round((json.simulationResult?.buyTax || 0) * 100) / 100;
                        const sellTax = Math.round((json.simulationResult?.sellTax || 0) * 100) / 100;

                        const signals = [];
                        let risk_level = 'safe';

                        if (isHoneypot) {
                            risk_level = 'critical';
                            signals.push({ name: 'HONEYPOT', detail: 'Token cannot be sold — your funds will be trapped' });
                        }

                        if (sellTax > 50) {
                            risk_level = 'critical';
                            signals.push({ name: 'Extreme Sell Tax', detail: `${sellTax}% sell tax — effectively unsellable` });
                        } else if (sellTax > 10) {
                            risk_level = risk_level === 'safe' ? 'high' : risk_level;
                            signals.push({ name: 'High Sell Tax', detail: `${sellTax}% sell tax` });
                        }

                        if (buyTax > 10) {
                            risk_level = risk_level === 'safe' ? 'medium' : risk_level;
                            signals.push({ name: 'High Buy Tax', detail: `${buyTax}% buy tax` });
                        }

                        // Pair/liquidity info
                        const pairs = json.pair || {};
                        const liquidity = pairs.liquidity || 0;
                        const lpLocked = pairs.liquidityLocked || false;

                        if (liquidity < 1000) {
                            risk_level = risk_level === 'safe' ? 'high' : risk_level;
                            signals.push({ name: 'Low Liquidity', detail: `Only $${liquidity.toLocaleString()} in liquidity` });
                        }

                        if (!lpLocked) {
                            signals.push({ name: 'LP Not Locked', detail: 'Liquidity is not locked — rug pull possible' });
                        }

                        // Token name scam check
                        const tokenName = json.token?.name || '';
                        const tokenSymbol = json.token?.symbol || '';
                        if (SCAM_NAME_PATTERNS.some(p => p.test(tokenName) || p.test(tokenSymbol))) {
                            signals.push({ name: 'Suspicious Name', detail: `"${tokenName}" matches common scam token naming patterns` });
                        }

                        let verdict;
                        if (isHoneypot) verdict = 'HONEYPOT — Cannot sell this token';
                        else if (risk_level === 'critical') verdict = 'DANGEROUS — Extreme tax makes token unsellable';
                        else if (risk_level === 'high') verdict = 'HIGH RISK — Proceed with extreme caution';
                        else if (risk_level === 'medium') verdict = 'CAUTION — Elevated tax detected';
                        else verdict = 'SAFE — No honeypot detected';

                        resolve({
                            isHoneypot, buyTax, sellTax, verdict, risk_level,
                            liquidity, lpLocked, tokenName, tokenSymbol, signals
                        });
                    } catch (e) {
                        reject(new Error('Failed to parse HoneyPot.is response'));
                    }
                });
            }).on('error', reject).on('timeout', () => reject(new Error('Timeout')));
        });
    },

    /**
     * Heuristic fallback when API is unavailable
     */
    heuristicAnalysis: (address, chain, startTime) => {
        const signals = [];
        let risk_score = 50; // Start neutral

        // Check against known scam address patterns
        // Addresses that are very "round" (lots of 0s) are sometimes test/scam
        const zeroCount = (address.match(/0/g) || []).length;
        if (zeroCount > 20) {
            risk_score += 15;
            signals.push({ name: 'Unusual address pattern', detail: 'High zero-count in address' });
        }

        // Without API, we can't determine exact tax
        const estimatedBuyTax = 0;
        const estimatedSellTax = 0;

        let verdict = 'UNKNOWN — Unable to verify via API. Check manually on HoneyPot.is';
        let risk_level = 'unknown';

        return {
            address,
            chain,
            isHoneypot: false,
            buyTax: estimatedBuyTax,
            sellTax: estimatedSellTax,
            verdict,
            risk_level,
            liquidity: null,
            lpLocked: false,
            signals,
            manual_check_url: `https://honeypot.is/?address=${address}`,
            processing_time_ms: Date.now() - startTime
        };
    }
};

module.exports = RugPullAnalyzer;
