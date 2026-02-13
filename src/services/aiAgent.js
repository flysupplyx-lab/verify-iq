
const OpenAI = require('openai');

class AiAgent {
    constructor() {
        this.openai = null;
        this.initialized = false;
    }

    initialize() {
        if (process.env.OPENAI_API_KEY) {
            this.openai = new OpenAI({
                apiKey: process.env.OPENAI_API_KEY,
            });
            this.initialized = true;
            console.log('OpenAI Agent initialized.');
        } else {
            console.warn('OpenAI API Key not found. AI Agent features will be disabled.');
        }
    }

    async analyzeContext(contextType, data) {
        if (!this.initialized) {
            this.initialize();
            if (!this.initialized) {
                return {
                    error: 'AI Agent not configured',
                    message: 'Please add OPENAI_API_KEY to your .env file'
                };
            }
        }

        const prompts = {
            'general_risk': `Analyze the following website context for potential risks, scams, or fraudulent activity. Return a JSON object with { risk_score: 0-100, verdict: string, specific_concerns: string[] }.`,
            'dropshipping': `Analyze the following product details to determine if it is likely a dropshipped item from AliExpress/Temu. Return a JSON object with { probability: 0-100, reasoning: string, estimated_China_price: number }.`,
            'social_audit': `Analyze this social media profile for signs of fake followers, engagement farming, or scams. Return a JSON object with { authenticity_score: 0-100, flags: string[], verdict: string }.`
        };

        const systemPrompt = prompts[contextType] || prompts['general_risk'];

        try {
            const completion = await this.openai.chat.completions.create({
                messages: [
                    { role: "system", content: systemPrompt + " Always respond in valid JSON." },
                    { role: "user", content: JSON.stringify(data) }
                ],
                model: "gpt-4o",
                response_format: { type: "json_object" },
            });

            const content = completion.choices[0].message.content;
            return JSON.parse(content);
        } catch (error) {
            console.error('AI Agent Error:', error);
            throw new Error('Failed to analyze with AI Agent');
        }
    }
}

module.exports = new AiAgent();
