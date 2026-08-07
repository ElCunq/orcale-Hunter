import requests
from typing import Dict, Any

def send_telegram_test(bot_token: str, chat_id: str) -> Dict[str, Any]:
    if not bot_token or not chat_id:
        return {"success": False, "message": "Bot Token and Chat ID are required."}
    
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": "🧪 Oracle A1 Hunter: Web Arayüzü Test Mesajı!\n\nTelegram bildirim ayarlarınız başarıyla doğrulandı. 🚀"
    }
    
    try:
        resp = requests.post(url, data=payload, timeout=10)
        if resp.status_code == 200:
            return {"success": True, "message": "Test message sent to Telegram successfully!"}
        else:
            return {"success": False, "message": f"Telegram API error ({resp.status_code}): {resp.text}"}
    except Exception as e:
        return {"success": False, "message": f"Network error sending Telegram message: {str(e)}"}
