import re
from datetime import datetime

class BillParser:
    @staticmethod
    def parse(text: str):
        alipay_patterns = [
            r"支付宝?(?:您于)?(.*\d{2}日\d{2}:\d{2})消费支付(\d+\.?\d*)元",
            r"支付宝：成功支付(\d+\.?\d*)元"
        ]
        wechat_patterns = [
            r"微信支付?支付金额(\d+\.?\d*)元，收款方?(.*)",
            r"微信支付?(?:.*)支付(\d+\.?\d*)元"
        ]
        bank_patterns = [
            r"【(?:招商银行|工商银行)】(.*)支出(?:人民币)?(\d+\.?\d*)元"
        ]

        result = {
            "source": "Unknown",
            "amount": 0.0,
            "description": "No details",
            "timestamp": datetime.now().isoformat()
        }

        for p in alipay_patterns:
            match = re.search(p, text)
            if match:
                result["source"] = "Alipay"
                if len(match.groups()) == 2:
                    result["amount"] = float(match.group(2))
                    result["description"] = f"Spent via Alipay {match.group(1)}"
                else:
                    result["amount"] = float(match.group(1))
                return result

        for p in wechat_patterns:
            match = re.search(p, text)
            if match:
                result["source"] = "WeChat"
                result["amount"] = float(match.group(1))
                if len(match.groups()) == 2:
                    result["description"] = f"Paid to: {match.group(2)}"
                return result

        for p in bank_patterns:
            match = re.search(p, text)
            if match:
                result["source"] = "Bank"
                result["amount"] = float(match.group(2))
                result["description"] = f"Bank Transaction: {match.group(1)}"
                return result

        return result
