/**
 * AI Content Detector
 * Uses statistical text analysis to determine if content is AI-generated.
 * 
 * Heuristics used:
 * 1. Sentence length uniformity (AI text has more uniform sentence lengths)
 * 2. Vocabulary diversity (Type-Token Ratio)
 * 3. Transition word density (AI uses more transition/filler phrases)
 * 4. Punctuation patterns
 * 5. Paragraph structure consistency
 * 6. Burstiness (variation in complexity)
 * 7. Repetition patterns
 * 8. Passive voice frequency
 * 9. Lexical sophistication
 */

// Common AI transition phrases and filler words
const AI_TRANSITION_PHRASES = [
    'additionally', 'furthermore', 'moreover', 'in addition', 'consequently',
    'as a result', 'therefore', 'thus', 'hence', 'accordingly',
    'in conclusion', 'to summarize', 'in summary', 'overall',
    'it is important to note', 'it is worth noting', 'it should be noted',
    'in this context', 'in this regard', 'with regard to',
    'on the other hand', 'conversely', 'nevertheless', 'nonetheless',
    'however', 'in contrast', 'alternatively',
    'specifically', 'particularly', 'notably', 'significantly',
    'essentially', 'fundamentally', 'ultimately', 'effectively',
    'in today\'s world', 'in the modern era', 'in recent years',
    'it is essential', 'it is crucial', 'it is vital', 'it is imperative',
    'plays a crucial role', 'plays a significant role', 'plays a vital role',
    'a wide range of', 'a variety of', 'a multitude of',
    'in order to', 'serves as a', 'continues to be',
    'landscape', 'leverage', 'delve', 'delve into', 'tapestry',
    'multifaceted', 'nuanced', 'comprehensive', 'robust',
    'streamline', 'facilitate', 'foster', 'cultivate',
    'paramount', 'pivotal', 'indispensable',
    'embark on', 'navigate', 'realm', 'encompasses',
];

// Hedging phrases commonly overused by AI
const HEDGING_PHRASES = [
    'it is worth mentioning', 'it can be argued', 'some might say',
    'one could argue', 'it seems that', 'it appears that',
    'generally speaking', 'broadly speaking', 'by and large',
    'for the most part', 'to a certain extent', 'in many cases',
    'tends to', 'may or may not', 'could potentially',
];

class AIDetector {

    /**
     * Analyze text and return AI detection results
     */
    analyze(text) {
        const startTime = Date.now();

        if (!text || typeof text !== 'string' || text.trim().length < 50) {
            return {
                error: 'Text must be at least 50 characters long for accurate analysis',
                ai_probability: null,
                verdict: 'insufficient_text',
                processing_time_ms: Date.now() - startTime,
            };
        }

        const cleanText = text.trim();
        const sentences = this.extractSentences(cleanText);
        const words = this.extractWords(cleanText);
        const paragraphs = cleanText.split(/\n\s*\n/).filter(p => p.trim().length > 0);

        if (sentences.length < 3) {
            return {
                error: 'Text must contain at least 3 sentences for accurate analysis',
                ai_probability: null,
                verdict: 'insufficient_text',
                processing_time_ms: Date.now() - startTime,
            };
        }

        // Run all analysis modules
        const metrics = {
            sentence_uniformity: this.analyzeSentenceUniformity(sentences),
            vocabulary_diversity: this.analyzeVocabularyDiversity(words),
            transition_density: this.analyzeTransitionDensity(cleanText, words.length),
            punctuation_patterns: this.analyzePunctuation(cleanText, sentences),
            burstiness: this.analyzeBurstiness(sentences),
            repetition: this.analyzeRepetition(sentences, words),
            passive_voice: this.analyzePassiveVoice(sentences),
            hedging: this.analyzeHedging(cleanText, sentences.length),
            paragraph_structure: this.analyzeParagraphStructure(paragraphs),
            lexical_sophistication: this.analyzeLexicalSophistication(words),
        };

        // Calculate weighted AI probability
        const probability = this.calculateProbability(metrics);
        const verdict = this.getVerdict(probability);

        return {
            text_length: cleanText.length,
            word_count: words.length,
            sentence_count: sentences.length,
            paragraph_count: paragraphs.length,
            ai_probability: Math.round(probability * 100) / 100,
            verdict: verdict.label,
            confidence: verdict.confidence,
            risk_level: verdict.risk_level,
            metrics: metrics,
            signals: this.getTopSignals(metrics),
            timestamp: new Date().toISOString(),
            processing_time_ms: Date.now() - startTime,
        };
    }

    /**
     * Extract sentences from text
     */
    extractSentences(text) {
        // Split on sentence boundaries, handling abbreviations
        return text
            .replace(/([.!?])\s+/g, '$1|||')
            .split('|||')
            .map(s => s.trim())
            .filter(s => s.length > 5);
    }

    /**
     * Extract words from text
     */
    extractWords(text) {
        return text
            .toLowerCase()
            .replace(/[^a-z\s'-]/g, '')
            .split(/\s+/)
            .filter(w => w.length > 0);
    }

    /**
     * Analyze sentence length uniformity
     * AI text tends to have very uniform sentence lengths
     */
    analyzeSentenceUniformity(sentences) {
        const lengths = sentences.map(s => s.split(/\s+/).length);
        const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
        const variance = lengths.reduce((sum, l) => sum + Math.pow(l - mean, 2), 0) / lengths.length;
        const stdDev = Math.sqrt(variance);
        const coeffOfVariation = mean > 0 ? stdDev / mean : 0;

        // AI text typically has CV between 0.15-0.35
        // Human text typically has CV between 0.40-0.80+
        const aiScore = coeffOfVariation < 0.25 ? 0.85
            : coeffOfVariation < 0.35 ? 0.65
                : coeffOfVariation < 0.45 ? 0.40
                    : coeffOfVariation < 0.55 ? 0.25
                        : 0.10;

        return {
            mean_length: Math.round(mean * 10) / 10,
            std_deviation: Math.round(stdDev * 10) / 10,
            coeff_of_variation: Math.round(coeffOfVariation * 100) / 100,
            ai_signal: aiScore,
            description: coeffOfVariation < 0.35
                ? 'Sentence lengths are very uniform (AI pattern)'
                : coeffOfVariation < 0.50
                    ? 'Moderate sentence length variation'
                    : 'Natural sentence length variation (human pattern)',
        };
    }

    /**
     * Analyze vocabulary diversity using Type-Token Ratio
     */
    analyzeVocabularyDiversity(words) {
        if (words.length === 0) return { ttr: 0, ai_signal: 0.5 };

        // Use a moving window TTR for longer texts (more accurate)
        const windowSize = Math.min(100, words.length);
        let totalTTR = 0;
        let windows = 0;

        for (let i = 0; i <= words.length - windowSize; i += Math.floor(windowSize / 2)) {
            const window = words.slice(i, i + windowSize);
            const uniqueWords = new Set(window);
            totalTTR += uniqueWords.size / window.length;
            windows++;
        }

        const avgTTR = windows > 0 ? totalTTR / windows : new Set(words).size / words.length;

        // AI text typically has TTR between 0.45-0.60
        // Human text typically has more varied TTR
        const aiScore = avgTTR < 0.40 ? 0.70  // Very repetitive
            : avgTTR < 0.55 ? 0.55              // AI-typical range
                : avgTTR < 0.65 ? 0.35              // More diverse
                    : 0.15;                              // Very diverse (human)

        return {
            type_token_ratio: Math.round(avgTTR * 100) / 100,
            unique_words: new Set(words).size,
            total_words: words.length,
            ai_signal: aiScore,
            description: avgTTR < 0.50
                ? 'Low vocabulary diversity (potentially AI-generated)'
                : avgTTR < 0.65
                    ? 'Moderate vocabulary diversity'
                    : 'High vocabulary diversity (human-like)',
        };
    }

    /**
     * Analyze density of AI-typical transition phrases
     */
    analyzeTransitionDensity(text, wordCount) {
        const lowerText = text.toLowerCase();
        let transitionCount = 0;
        const foundPhrases = [];

        for (const phrase of AI_TRANSITION_PHRASES) {
            const regex = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
            const matches = lowerText.match(regex);
            if (matches) {
                transitionCount += matches.length;
                foundPhrases.push({ phrase, count: matches.length });
            }
        }

        const density = wordCount > 0 ? transitionCount / wordCount : 0;

        // AI text typically has transition density > 0.03
        const aiScore = density > 0.06 ? 0.90
            : density > 0.04 ? 0.75
                : density > 0.025 ? 0.50
                    : density > 0.015 ? 0.30
                        : 0.10;

        return {
            transition_count: transitionCount,
            density: Math.round(density * 1000) / 1000,
            top_phrases: foundPhrases.sort((a, b) => b.count - a.count).slice(0, 5),
            ai_signal: aiScore,
            description: density > 0.04
                ? 'High density of AI-typical transition phrases'
                : density > 0.02
                    ? 'Moderate transition phrase usage'
                    : 'Natural transition word usage',
        };
    }

    /**
     * Analyze punctuation patterns
     */
    analyzePunctuation(text, sentences) {
        const exclamations = (text.match(/!/g) || []).length;
        const questions = (text.match(/\?/g) || []).length;
        const semicolons = (text.match(/;/g) || []).length;
        const dashes = (text.match(/[—–-]{2,}|—/g) || []).length;
        const ellipsis = (text.match(/\.{3}|…/g) || []).length;
        const commasPerSentence = (text.match(/,/g) || []).length / sentences.length;

        // AI text tends to use fewer exclamations, questions, and informal punctuation
        // but more semicolons and commas
        const informalPunctuation = exclamations + ellipsis + dashes;
        const formalPunctuation = semicolons + (commasPerSentence > 2 ? 1 : 0);

        const aiScore = informalPunctuation === 0 && formalPunctuation > 0 ? 0.65
            : informalPunctuation === 0 ? 0.50
                : informalPunctuation > 3 ? 0.15
                    : 0.35;

        return {
            exclamations, questions, semicolons, dashes, ellipsis,
            commas_per_sentence: Math.round(commasPerSentence * 10) / 10,
            ai_signal: aiScore,
            description: informalPunctuation === 0
                ? 'Formal punctuation only (AI pattern)'
                : 'Mix of formal and informal punctuation',
        };
    }

    /**
     * Analyze burstiness - variation in sentence complexity
     * AI text tends to be consistently medium complexity
     */
    analyzeBurstiness(sentences) {
        const complexities = sentences.map(s => {
            const words = s.split(/\s+/);
            const avgWordLen = words.reduce((sum, w) => sum + w.length, 0) / words.length;
            const commas = (s.match(/,/g) || []).length;
            return avgWordLen * (1 + commas * 0.3) * Math.log(words.length + 1);
        });

        const mean = complexities.reduce((a, b) => a + b, 0) / complexities.length;
        const variance = complexities.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) / complexities.length;
        const burstiness = mean > 0 ? Math.sqrt(variance) / mean : 0;

        // Low burstiness = AI-like consistency
        const aiScore = burstiness < 0.20 ? 0.80
            : burstiness < 0.35 ? 0.55
                : burstiness < 0.50 ? 0.35
                    : 0.15;

        return {
            burstiness_score: Math.round(burstiness * 100) / 100,
            ai_signal: aiScore,
            description: burstiness < 0.30
                ? 'Low burstiness - consistent complexity (AI pattern)'
                : burstiness < 0.50
                    ? 'Moderate burstiness'
                    : 'High burstiness - varied complexity (human pattern)',
        };
    }

    /**
     * Analyze repetition patterns
     */
    analyzeRepetition(sentences, words) {
        // Check for repeated sentence starters
        const starters = sentences.map(s => {
            const firstWords = s.split(/\s+/).slice(0, 2).join(' ').toLowerCase();
            return firstWords;
        });

        const starterCounts = {};
        starters.forEach(s => { starterCounts[s] = (starterCounts[s] || 0) + 1; });
        const maxStarterRepeat = Math.max(...Object.values(starterCounts));
        const starterRepeatRatio = sentences.length > 0 ? maxStarterRepeat / sentences.length : 0;

        // Check for repeated n-grams (3-word phrases)
        const trigrams = [];
        for (let i = 0; i < words.length - 2; i++) {
            trigrams.push(words.slice(i, i + 3).join(' '));
        }
        const trigramCounts = {};
        trigrams.forEach(t => { trigramCounts[t] = (trigramCounts[t] || 0) + 1; });
        const repeatedTrigrams = Object.values(trigramCounts).filter(c => c > 2).length;
        const trigramRepeatRatio = trigrams.length > 0 ? repeatedTrigrams / trigrams.length : 0;

        const aiScore = (starterRepeatRatio > 0.3 ? 0.3 : 0) +
            (trigramRepeatRatio > 0.02 ? 0.3 : trigramRepeatRatio > 0.01 ? 0.15 : 0) +
            0.2; // baseline

        return {
            max_starter_repeats: maxStarterRepeat,
            repeated_trigrams: repeatedTrigrams,
            ai_signal: Math.min(0.90, aiScore),
            description: starterRepeatRatio > 0.3 || trigramRepeatRatio > 0.02
                ? 'Notable repetition patterns detected'
                : 'Natural variation in phrasing',
        };
    }

    /**
     * Analyze passive voice usage
     */
    analyzePassiveVoice(sentences) {
        const passivePatterns = [
            /\b(is|are|was|were|been|being|be)\s+([\w]+ed|[\w]+en)\b/gi,
            /\b(has|have|had)\s+been\s+[\w]+/gi,
        ];

        let passiveCount = 0;
        for (const sentence of sentences) {
            for (const pattern of passivePatterns) {
                pattern.lastIndex = 0;
                if (pattern.test(sentence)) {
                    passiveCount++;
                    break;
                }
            }
        }

        const passiveRatio = sentences.length > 0 ? passiveCount / sentences.length : 0;

        // AI tends to use more passive voice
        const aiScore = passiveRatio > 0.4 ? 0.70
            : passiveRatio > 0.25 ? 0.50
                : passiveRatio > 0.15 ? 0.35
                    : 0.20;

        return {
            passive_sentences: passiveCount,
            passive_ratio: Math.round(passiveRatio * 100) / 100,
            ai_signal: aiScore,
            description: passiveRatio > 0.3
                ? 'High passive voice usage (AI pattern)'
                : 'Normal passive voice usage',
        };
    }

    /**
     * Analyze hedging phrase usage
     */
    analyzeHedging(text, sentenceCount) {
        const lowerText = text.toLowerCase();
        let hedgeCount = 0;

        for (const phrase of HEDGING_PHRASES) {
            const regex = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
            const matches = lowerText.match(regex);
            if (matches) hedgeCount += matches.length;
        }

        const hedgeDensity = sentenceCount > 0 ? hedgeCount / sentenceCount : 0;

        const aiScore = hedgeDensity > 0.3 ? 0.80
            : hedgeDensity > 0.15 ? 0.60
                : hedgeDensity > 0.05 ? 0.35
                    : 0.15;

        return {
            hedge_count: hedgeCount,
            density: Math.round(hedgeDensity * 100) / 100,
            ai_signal: aiScore,
            description: hedgeDensity > 0.2
                ? 'High hedging phrase density (AI pattern)'
                : 'Normal hedging usage',
        };
    }

    /**
     * Analyze paragraph structure
     */
    analyzeParagraphStructure(paragraphs) {
        if (paragraphs.length < 2) {
            return { ai_signal: 0.5, description: 'Insufficient paragraphs for analysis' };
        }

        const lengths = paragraphs.map(p => p.split(/\s+/).length);
        const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
        const variance = lengths.reduce((sum, l) => sum + Math.pow(l - mean, 2), 0) / lengths.length;
        const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;

        // AI tends to create very uniform paragraph lengths
        const aiScore = cv < 0.20 ? 0.75
            : cv < 0.35 ? 0.50
                : cv < 0.50 ? 0.30
                    : 0.15;

        return {
            paragraph_count: paragraphs.length,
            mean_length: Math.round(mean),
            coeff_of_variation: Math.round(cv * 100) / 100,
            ai_signal: aiScore,
            description: cv < 0.25
                ? 'Very uniform paragraph lengths (AI pattern)'
                : 'Natural paragraph length variation',
        };
    }

    /**
     * Analyze lexical sophistication
     */
    analyzeLexicalSophistication(words) {
        // Simple heuristic: average word length and long word ratio
        const avgLen = words.reduce((sum, w) => sum + w.length, 0) / words.length;
        const longWordRatio = words.filter(w => w.length > 8).length / words.length;

        // AI text tends toward medium-length words consistently
        const aiScore = avgLen > 4.5 && avgLen < 5.5 && longWordRatio > 0.10 && longWordRatio < 0.20
            ? 0.65  // AI sweet spot
            : avgLen > 5.5 || longWordRatio > 0.25
                ? 0.30 // More sophisticated (academic human writing)
                : avgLen < 4.0
                    ? 0.25 // Simple (casual human writing)
                    : 0.45;

        return {
            avg_word_length: Math.round(avgLen * 10) / 10,
            long_word_ratio: Math.round(longWordRatio * 100) / 100,
            ai_signal: aiScore,
            description: avgLen > 4.5 && avgLen < 5.5
                ? 'Medium lexical complexity (AI-typical range)'
                : avgLen > 5.5
                    ? 'High lexical complexity'
                    : 'Simple vocabulary',
        };
    }

    /**
     * Calculate weighted AI probability from all metrics
     */
    calculateProbability(metrics) {
        const weights = {
            sentence_uniformity: 0.18,
            vocabulary_diversity: 0.10,
            transition_density: 0.18,
            burstiness: 0.15,
            repetition: 0.08,
            passive_voice: 0.06,
            hedging: 0.10,
            punctuation_patterns: 0.05,
            paragraph_structure: 0.05,
            lexical_sophistication: 0.05,
        };

        let weightedSum = 0;
        let totalWeight = 0;

        for (const [key, weight] of Object.entries(weights)) {
            if (metrics[key] && typeof metrics[key].ai_signal === 'number') {
                weightedSum += metrics[key].ai_signal * weight;
                totalWeight += weight;
            }
        }

        const probability = totalWeight > 0 ? (weightedSum / totalWeight) * 100 : 50;

        return Math.max(0, Math.min(100, probability));
    }

    /**
     * Get verdict label from probability
     */
    getVerdict(probability) {
        if (probability >= 75) {
            return { label: 'ai_generated', confidence: 'high', risk_level: 'high' };
        } else if (probability >= 55) {
            return { label: 'likely_ai', confidence: 'medium', risk_level: 'medium' };
        } else if (probability >= 40) {
            return { label: 'mixed', confidence: 'low', risk_level: 'low' };
        } else {
            return { label: 'likely_human', confidence: 'medium', risk_level: 'minimal' };
        }
    }

    /**
     * Get top signals for the user
     */
    getTopSignals(metrics) {
        const signals = [];

        for (const [key, metric] of Object.entries(metrics)) {
            if (metric && typeof metric.ai_signal === 'number') {
                signals.push({
                    name: key.replace(/_/g, ' '),
                    score: Math.round(metric.ai_signal * 100),
                    description: metric.description,
                    is_ai_signal: metric.ai_signal > 0.55,
                });
            }
        }

        return signals.sort((a, b) => b.score - a.score);
    }
}

module.exports = new AIDetector();
