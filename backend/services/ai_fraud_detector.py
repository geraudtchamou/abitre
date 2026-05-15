"""
AI Fraud Detection & Risk Analysis Service
Uses heuristic analysis and pattern matching to detect fraud.
In production, this would integrate with Python/TensorFlow or external AI APIs.
"""

import re
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from enum import Enum

class RiskLevel(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

@dataclass
class FraudReport:
    target_type: str
    target_id: str
    risk_level: RiskLevel
    risk_score: float
    flags: List[str]
    model_version: str = "v1.0.0"
    timestamp: datetime = None

    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.utcnow()

class AIFraudDetector:
    """
    AI-powered fraud detection engine.
    Analyzes users, transactions, escrows, and messages for suspicious patterns.
    """

    def __init__(self):
        # Thresholds
        self.NEW_USER_TX_LIMIT = 1000.0
        self.HIGH_RISK_SCORE_THRESHOLD = 75.0
        self.CRITICAL_SCORE_THRESHOLD = 90.0
        
        # Patterns
        self.suspicious_keywords = [
            "wire transfer", "gift card", "bitcoin only", "outside platform",
            "urgent", "immediate", "confidential", "don't tell", "bypass"
        ]
        
    def analyze_user(self, user_data: Dict[str, Any]) -> FraudReport:
        """Analyze user profile for risk factors."""
        flags = []
        score = 0.0

        # Check account age
        created_at = user_data.get('created_at', datetime.utcnow())
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        
        account_age_days = (datetime.utcnow(timezone.utc) - created_at).days if created_at.tzinfo else (datetime.utcnow() - created_at).days
        
        if account_age_days < 1:
            flags.append("Brand new account (< 24h)")
            score += 30
        elif account_age_days < 7:
            flags.append("New account (< 7 days)")
            score += 15

        # Check verification status
        if not user_data.get('is_verified', False):
            flags.append("Unverified account")
            score += 10

        if not user_data.get('kyc_status') == 'verified':
            flags.append("KYC not completed")
            score += 15

        # Check trust score
        trust_score = user_data.get('trust_score', 0.0)
        if trust_score < 20:
            flags.append("Low trust score")
            score += 20

        # Check phone/email completeness
        if not user_data.get('phone'):
            flags.append("No phone number provided")
            score += 5

        return self._generate_report("user", user_data.get('id', 'unknown'), score, flags)

    def analyze_escrow(self, escrow_data: Dict[str, Any], buyer_data: Dict, seller_data: Dict) -> FraudReport:
        """Analyze escrow transaction for risk factors."""
        flags = []
        score = 0.0

        amount = float(escrow_data.get('amount', 0))
        
        # High value first transaction
        buyer_account_age = self._get_account_age(buyer_data)
        if buyer_account_age < 30 and amount > self.NEW_USER_TX_LIMIT:
            flags.append(f"High value (${amount}) from new buyer")
            score += 35

        # Price anomaly detection (if we have historical data)
        if amount > 10000:
            flags.append("High-value transaction")
            score += 10

        # Check for rapid creation
        if escrow_data.get('status') == 'draft' and amount > 5000:
            flags.append("Large draft escrow")
            score += 15

        # Cross-check buyer/seller relationship
        if buyer_data.get('id') == seller_data.get('id'):
            flags.append("Self-dealing detected")
            score += 80

        # Geographic risk (if location data available)
        # TODO: Add geo-IP risk scoring

        return self._generate_report("escrow", escrow_data.get('id', 'unknown'), score, flags)

    def analyze_message(self, message_content: str) -> FraudReport:
        """Analyze chat message for scam attempts and policy violations."""
        flags = []
        score = 0.0

        content_lower = message_content.lower()

        # Check for suspicious keywords
        found_keywords = [kw for kw in self.suspicious_keywords if kw in content_lower]
        if found_keywords:
            flags.append(f"Suspicious keywords: {', '.join(found_keywords)}")
            score += len(found_keywords) * 15

        # Check for contact info sharing (attempt to move off-platform)
        email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        phone_pattern = r'\b\d{10,}\b'
        
        if re.search(email_pattern, message_content):
            flags.append("Email address detected (off-platform risk)")
            score += 25

        if re.search(phone_pattern, message_content):
            flags.append("Phone number detected (off-platform risk)")
            score += 25

        # Check for urgency manipulation
        urgency_words = ['urgent', 'asap', 'immediately', 'now', 'hurry']
        urgency_count = sum(1 for word in urgency_words if word in content_lower)
        if urgency_count >= 2:
            flags.append("Urgency manipulation detected")
            score += 20

        # Check for payment method restrictions
        if 'crypto' in content_lower and 'only' in content_lower:
            flags.append("Restrictive payment method demand")
            score += 30

        return self._generate_report("message", "msg_" + str(hash(message_content))[:8], score, flags)

    def analyze_transaction_pattern(self, transactions: List[Dict]) -> FraudReport:
        """Analyze transaction history for money laundering patterns."""
        flags = []
        score = 0.0

        if not transactions:
            return self._generate_report("transaction_batch", "batch_empty", 0, ["No transactions to analyze"])

        # Structuring detection (multiple transactions just under reporting limits)
        amounts = [float(t.get('amount', 0)) for t in transactions]
        near_limit_count = sum(1 for amt in amounts if 9000 <= amt <= 10000)
        
        if near_limit_count >= 3:
            flags.append("Potential structuring (transactions near reporting limits)")
            score += 60

        # Rapid fire transactions
        timestamps = []
        for t in transactions:
            created = t.get('created_at')
            if created:
                if isinstance(created, str):
                    timestamps.append(datetime.fromisoformat(created.replace('Z', '+00:00')))
                else:
                    timestamps.append(created)
        
        if len(timestamps) >= 5:
            timestamps.sort()
            time_span = (timestamps[-1] - timestamps[0]).total_seconds()
            if time_span < 300:  # 5 transactions in 5 minutes
                flags.append("Rapid transaction burst")
                score += 40

        # Round number patterns
        round_amounts = sum(1 for amt in amounts if amt % 1000 == 0 and amt > 1000)
        if round_amounts >= 5:
            flags.append("Suspicious round-number pattern")
            score += 20

        return self._generate_report("transaction_pattern", "pattern_" + str(hash(str(amounts)))[:8], score, flags)

    def _get_account_age(self, user_data: Dict) -> int:
        """Calculate account age in days."""
        created_at = user_data.get('created_at', datetime.utcnow())
        if isinstance(created_at, str):
            try:
                created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
            except:
                created_at = datetime.utcnow()
        
        if created_at.tzinfo:
            return (datetime.utcnow(timezone.utc) - created_at).days
        else:
            return (datetime.utcnow() - created_at).days

    def _generate_report(self, target_type: str, target_id: str, score: float, flags: List[str]) -> FraudReport:
        """Generate standardized fraud report."""
        # Cap score at 100
        score = min(score, 100.0)
        
        # Determine risk level
        if score >= self.CRITICAL_SCORE_THRESHOLD:
            risk_level = RiskLevel.CRITICAL
        elif score >= self.HIGH_RISK_SCORE_THRESHOLD:
            risk_level = RiskLevel.HIGH
        elif score >= 40:
            risk_level = RiskLevel.MEDIUM
        else:
            risk_level = RiskLevel.LOW

        return FraudReport(
            target_type=target_type,
            target_id=target_id,
            risk_level=risk_level,
            risk_score=score,
            flags=flags,
            model_version="v1.0.0"
        )

    def get_recommendation(self, report: FraudReport) -> str:
        """Get recommended action based on fraud report."""
        if report.risk_level == RiskLevel.CRITICAL:
            return "BLOCK: Immediately freeze account/transaction and escalate to admin."
        elif report.risk_level == RiskLevel.HIGH:
            return "REVIEW: Flag for manual moderator review before proceeding."
        elif report.risk_level == RiskLevel.MEDIUM:
            return "MONITOR: Allow but increase monitoring frequency."
        else:
            return "ALLOW: No immediate action required."

# Singleton instance
fraud_detector = AIFraudDetector()
