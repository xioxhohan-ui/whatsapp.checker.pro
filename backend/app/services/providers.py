import aiohttp
import asyncio
import logging
from typing import Dict, Any, Tuple

logger = logging.getLogger(__name__)


class WhatsAppVerificationService:
    """
    Service to interact with real WhatsApp APIs to check if a number exists on WhatsApp.
    Supports:
    1. WhatsApp Cloud API (Meta Graph API)
    2. Twilio Lookup API (v2)
    3. UltraMsg API
    """

    @staticmethod
    async def check_whatsapp_cloud(phone_number: str, credentials: Dict[str, Any]) -> Tuple[str, str]:
        """
        Check presence using Meta WhatsApp Cloud API contacts endpoint.
        Credentials expected:
            - access_token: Meta Graph API User/System Token
            - phone_number_id: Meta Phone Number ID
        """
        access_token = credentials.get("access_token")
        phone_number_id = credentials.get("phone_number_id")
        
        if not access_token or not phone_number_id:
            raise ValueError("Missing access_token or phone_number_id for WhatsApp Cloud API")

        # Format number with plus sign for Meta API
        formatted_num = f"+{phone_number}"
        url = f"https://graph.facebook.com/v18.0/{phone_number_id}/contacts"
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        payload = {
            "blocking": "wait",
            "contacts": [formatted_num]
        }

        async with aiohttp.ClientSession() as session:
            for attempt in range(3):
                try:
                    async with session.post(url, json=payload, headers=headers, timeout=10) as response:
                        response_text = await response.text()
                        if response.status == 200:
                            data = await response.json()
                            contacts = data.get("contacts", [])
                            if contacts:
                                wa_status = contacts[0].get("status")
                                if wa_status == "valid":
                                    # Meta doesn't directly return business type here, defaults to valid
                                    return "valid", response_text
                                return "invalid", response_text
                            return "invalid", response_text
                        elif response.status == 429:
                            await asyncio.sleep(2 ** attempt)
                            continue
                        else:
                            return "failed", f"HTTP {response.status}: {response_text}"
                except Exception as e:
                    logger.error(f"Error checking WA Cloud API: {str(e)}")
                    if attempt == 2:
                        return "failed", str(e)
                    await asyncio.sleep(1)
            return "failed", "Max retries exceeded"

    @staticmethod
    async def check_twilio(phone_number: str, credentials: Dict[str, Any]) -> Tuple[str, str]:
        """
        Check presence using Twilio Lookups API v2 WhatsApp field.
        Credentials expected:
            - account_sid: Twilio Account SID
            - auth_token: Twilio Auth Token
        """
        account_sid = credentials.get("account_sid")
        auth_token = credentials.get("auth_token")

        if not account_sid or not auth_token:
            raise ValueError("Missing account_sid or auth_token for Twilio Lookup")

        formatted_num = f"+{phone_number}"
        # Twilio Lookup API v2
        url = f"https://lookups.twilio.com/v2/PhoneNumbers/{formatted_num}?Fields=whatsapp"
        auth = aiohttp.BasicAuth(account_sid, auth_token)

        async with aiohttp.ClientSession() as session:
            for attempt in range(3):
                try:
                    async with session.get(url, auth=auth, timeout=10) as response:
                        response_text = await response.text()
                        if response.status == 200:
                            data = await response.json()
                            whatsapp_data = data.get("whatsapp")
                            if whatsapp_data and whatsapp_data.get("registered"):
                                wa_type = whatsapp_data.get("type")
                                if wa_type == "business":
                                    return "business", response_text
                                return "valid", response_text
                            return "invalid", response_text
                        elif response.status == 429:
                            await asyncio.sleep(2 ** attempt)
                            continue
                        else:
                            return "failed", f"HTTP {response.status}: {response_text}"
                except Exception as e:
                    logger.error(f"Error checking Twilio API: {str(e)}")
                    if attempt == 2:
                        return "failed", str(e)
                    await asyncio.sleep(1)
            return "failed", "Max retries exceeded"

    @staticmethod
    async def check_ultramsg(phone_number: str, credentials: Dict[str, Any]) -> Tuple[str, str]:
        """
        Check presence using UltraMsg checkContact API.
        Credentials expected:
            - instance_id: UltraMsg Instance ID (e.g. instance12345)
            - token: UltraMsg Instance Token
        """
        instance_id = credentials.get("instance_id")
        token = credentials.get("token")

        if not instance_id or not token:
            raise ValueError("Missing instance_id or token for UltraMsg")

        # UltraMsg expects number with suffix @c.us or just number
        chat_id = f"{phone_number}@c.us"
        url = f"https://api.ultramsg.com/{instance_id}/contacts/check"
        params = {
            "token": token,
            "chatId": chat_id,
            "nocache": "1"
        }

        async with aiohttp.ClientSession() as session:
            for attempt in range(3):
                try:
                    async with session.get(url, params=params, timeout=10) as response:
                        response_text = await response.text()
                        if response.status == 200:
                            data = await response.json()
                            # Typical UltraMsg check structure: {"status":"valid","chatId":"...","isBusiness":true}
                            # check if response status says valid
                            status = data.get("status")
                            is_business = data.get("isBusiness", False)
                            
                            if status == "valid":
                                if is_business:
                                    return "business", response_text
                                return "valid", response_text
                            return "invalid", response_text
                        elif response.status == 429:
                            await asyncio.sleep(2 ** attempt)
                            continue
                        else:
                            return "failed", f"HTTP {response.status}: {response_text}"
                except Exception as e:
                    logger.error(f"Error checking UltraMsg API: {str(e)}")
                    if attempt == 2:
                        return "failed", str(e)
                    await asyncio.sleep(1)
            return "failed", "Max retries exceeded"

    @classmethod
    async def verify_number(cls, provider: str, phone_number: str, credentials: Dict[str, Any]) -> Tuple[str, str]:
        """
        Dispatches verification task to the configured provider.
        Returns: Tuple of (status, response_raw) where status is: 'valid', 'invalid', 'business', or 'failed'
        """
        p = provider.lower()
        if p == "whatsapp_cloud":
            return await cls.check_whatsapp_cloud(phone_number, credentials)
        elif p == "twilio":
            return await cls.check_twilio(phone_number, credentials)
        elif p == "ultramsg":
            return await cls.check_ultramsg(phone_number, credentials)
        else:
            return "failed", f"Unknown provider: {provider}"
