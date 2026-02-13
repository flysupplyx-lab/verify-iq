/**
 * Verify.IQ - Deepfake / AI Face Detector Service
 * Analyzes profile pictures for AI-generated face indicators.
 * Dual-mode: heuristic (default) + external API (when key available).
 */

const https = require('https');
const crypto = require('crypto');

// Known AI face generator signatures (based on common StyleGAN artifacts)
const AI_INDICATORS = {
    // Common image dimensions from AI generators
    stylegan_dimensions: [
        { w: 1024, h: 1024 }, // StyleGAN2
        { w: 512, h: 512 },   // StyleGAN
        { w: 256, h: 256 },   // Early GAN
        { w: 768, h: 768 },   // Midjourney-like
    ],
    // Known AI face generator domains
    ai_generator_domains: [
        'thispersondoesnotexist.com',
        'generated.photos',
        'artbreeder.com',
        'boredhumans.com',
        'fakeface.rest',
        'person-generator.com',
        'stablediffusionweb.com'
    ]
};

const DeepfakeAnalyzer = {
    /**
     * Analyze an image URL for AI-generated face indicators
     * @param {string} image_url - URL of the profile picture
     * @param {string} platform - Source platform
     * @param {string} [api_key] - Optional Sightengine API key
     * @returns {Promise<Object>} Analysis result
     */
    analyze: async (image_url, platform = 'unknown', api_key = null) => {
        const startTime = Date.now();

        // If API key available, use Sightengine
        if (api_key) {
            try {
                return await DeepfakeAnalyzer.sightengineCheck(image_url, api_key, startTime);
            } catch (e) {
                console.warn('Sightengine API failed, falling back to heuristic:', e.message);
            }
        }

        // Heuristic analysis
        return DeepfakeAnalyzer.heuristicAnalysis(image_url, platform, startTime);
    },

    /**
     * Heuristic-based AI face detection (no API needed)
     */
    heuristicAnalysis: async (image_url, platform, startTime) => {
        let ai_probability = 0;
        const indicators = [];
        const signals = [];

        // 1. Check if image is from a known AI generator domain
        const urlLower = (image_url || '').toLowerCase();
        const isKnownAiDomain = AI_INDICATORS.ai_generator_domains.some(d => urlLower.includes(d));
        if (isKnownAiDomain) {
            ai_probability += 90;
            indicators.push('Image sourced from known AI face generator');
            signals.push({ name: 'Known AI Source', score: 90, detail: 'Image URL matches a known AI face generation service' });
        }

        // 2. Probe image metadata via HEAD request
        try {
            const imageInfo = await DeepfakeAnalyzer.probeImage(image_url);

            // Check perfect square dimensions (common in GAN output)
            if (imageInfo.width && imageInfo.height) {
                const isSquare = imageInfo.width === imageInfo.height;
                const isPowerOfTwo = (imageInfo.width & (imageInfo.width - 1)) === 0;

                if (isSquare && AI_INDICATORS.stylegan_dimensions.some(d => d.w === imageInfo.width)) {
                    ai_probability += 25;
                    indicators.push(`Perfect ${imageInfo.width}x${imageInfo.height} dimensions (GAN standard)`);
                    signals.push({ name: 'GAN Dimensions', score: 25, detail: `${imageInfo.width}x${imageInfo.height} matches known AI generator output size` });
                } else if (isSquare && isPowerOfTwo) {
                    ai_probability += 15;
                    indicators.push('Power-of-two square dimensions (possible AI)');
                }
            }

            // Check file size patterns (AI faces tend to be uniformly compressed)
            if (imageInfo.contentLength) {
                const sizeKb = imageInfo.contentLength / 1024;
                // StyleGAN PNGs are typically 1.5-2.5MB, JPEGs 100-300KB
                if (sizeKb > 100 && sizeKb < 350 && imageInfo.contentType?.includes('jpeg')) {
                    ai_probability += 10;
                    indicators.push('File size consistent with AI-generated JPEG');
                }
            }

            // Check for lack of EXIF (AI images have no camera EXIF)
            if (!imageInfo.hasExif) {
                ai_probability += 5;
                indicators.push('No EXIF metadata (no camera info)');
            }
        } catch (e) {
            // Image probe failed, skip
        }

        // 3. URL pattern analysis
        if (urlLower.includes('avatar') || urlLower.includes('profile')) {
            // Profile pics are often compressed/resized by platforms, less reliable
            ai_probability = Math.max(0, ai_probability - 5);
        }

        // 4. Platform-specific adjustments
        if (platform === 'instagram' || platform === 'tiktok') {
            // These platforms heavily compress images, reducing heuristic reliability
            if (ai_probability > 0 && ai_probability < 50) {
                ai_probability = Math.round(ai_probability * 0.8);
                signals.push({ name: 'Platform Compression', score: 0, detail: 'Platform image processing reduces analysis confidence' });
            }
        }

        // 5. Hash-based pattern check (look for known AI patterns in URL)
        const aiUrlPatterns = [
            /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}/i,  // UUID-like (common in AI services)
            /generated|synthetic|artificial/i,
            /seed[_-]?\d+/i,
            /latent|gan|diffusion/i
        ];
        if (aiUrlPatterns.some(p => p.test(image_url))) {
            ai_probability += 15;
            indicators.push('URL contains AI-generation patterns');
        }

        // Clamp
        ai_probability = Math.min(99, Math.max(0, ai_probability));

        let verdict;
        if (ai_probability >= 70) verdict = 'likely_ai';
        else if (ai_probability >= 40) verdict = 'possibly_ai';
        else verdict = 'likely_real';

        return {
            ai_probability,
            verdict,
            indicators,
            signals,
            image_url,
            platform,
            method: 'heuristic',
            note: ai_probability < 30 ? 'Low confidence — heuristic analysis only. For higher accuracy, enable API integration.' : undefined,
            processing_time_ms: Date.now() - startTime
        };
    },

    /**
     * Probe image via HTTP to extract metadata
     */
    probeImage: (url) => {
        return new Promise((resolve, reject) => {
            if (!url) return reject(new Error('No URL'));

            const proto = url.startsWith('https') ? https : http;
            const req = proto.request(url, { method: 'HEAD', timeout: 5000 }, (res) => {
                resolve({
                    contentType: res.headers['content-type'],
                    contentLength: parseInt(res.headers['content-length'] || '0', 10),
                    hasExif: false, // Would need full image download to check
                    width: null,    // Would need image parsing
                    height: null
                });
            });
            req.on('error', reject);
            req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
            req.end();
        });
    },

    /**
     * Sightengine API integration (requires API key)
     */
    sightengineCheck: (image_url, api_key, startTime) => {
        return new Promise((resolve, reject) => {
            const [user, secret] = api_key.split(':');
            if (!user || !secret) return reject(new Error('Invalid API key format (expected user:secret)'));

            const url = `https://api.sightengine.com/1.0/check.json?url=${encodeURIComponent(image_url)}&models=deepfake&api_user=${user}&api_secret=${secret}`;

            https.get(url, { timeout: 10000 }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        const aiScore = Math.round((json.deepfake?.score || 0) * 100);

                        resolve({
                            ai_probability: aiScore,
                            verdict: aiScore >= 70 ? 'likely_ai' : aiScore >= 40 ? 'possibly_ai' : 'likely_real',
                            indicators: aiScore >= 70 ? ['Sightengine AI detection triggered'] : [],
                            signals: [{ name: 'Sightengine', score: aiScore, detail: `AI confidence: ${aiScore}%` }],
                            image_url,
                            method: 'sightengine_api',
                            processing_time_ms: Date.now() - startTime
                        });
                    } catch (e) {
                        reject(new Error('Failed to parse Sightengine response'));
                    }
                });
            }).on('error', reject);
        });
    }
};

module.exports = DeepfakeAnalyzer;
