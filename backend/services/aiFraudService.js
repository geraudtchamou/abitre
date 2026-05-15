const { OpenAI } = require('openai');
const db = require('../config/database');

class AIFraudService {
  constructor() {
    this.openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
    this.riskThreshold = 0.7;
  }

  async analyzeTransactionRisk(transactionData) {
    const prompt = `Analyze this transaction for fraud. Amount: ${transactionData.amount}, Trust: ${transactionData.userTrustScore}. Return JSON: { "riskScore": 0-1, "riskLevel": "LOW|MEDIUM|HIGH", "flags": [] }`;

    try {
      if (!this.openai) return this.mockRiskAnalysis(transactionData);

      const completion = await this.openai.chat.completions.create({
        messages: [{ role: "system", content: "Financial fraud expert." }, { role: "user", content: prompt }],
        model: "gpt-4-turbo-preview",
        response_format: { type: "json_object" }
      });

      const analysis = JSON.parse(completion.choices[0].message.content);
      
      await db.query(
        `INSERT INTO fraud_reports (entity_id, entity_type, risk_score, risk_level, flags, reasoning, status)
         VALUES ($1, 'transaction', $2, $3, $4, $5, 'pending_review')`,
        [transactionData.id, analysis.riskScore, analysis.riskLevel, JSON.stringify(analysis.flags), analysis.reasoning || 'AI analyzed']
      );

      return analysis;
    } catch (error) {
      console.error('AI Fraud Error:', error);
      return { riskScore: 0.5, riskLevel: 'MEDIUM', flags: ['analysis_failed'], reasoning: 'Service unavailable' };
    }
  }

  async analyzeChatContent(message) {
    const scamKeywords = ['bitcoin', 'gift card', 'outside platform', 'telegram'];
    const hasScam = scamKeywords.some(k => message.toLowerCase().includes(k));
    return { toxic: false, scamLikelihood: hasScam ? 0.8 : 0.1, flag: hasScam ? 'potential_scam' : null };
  }

  mockRiskAnalysis(data) {
    let score = 0.1, flags = [];
    if (data.amount > 10000) { score += 0.3; flags.push('high_value'); }
    if (data.daysSinceRegistration < 7) { score += 0.4; flags.push('new_account'); }
    if (data.userTrustScore < 50) { score += 0.2; flags.push('low_trust'); }
    
    return {
      riskScore: Math.min(score, 1.0),
      riskLevel: score > 0.7 ? 'HIGH' : score > 0.4 ? 'MEDIUM' : 'LOW',
      flags,
      reasoning: 'Heuristic analysis.'
    };
  }
}

module.exports = new AIFraudService();
