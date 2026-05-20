import logging
import redis

logger = logging.getLogger(__name__)

class InMemoryRedisMock:
    """An in-memory mock Redis client used for local host runs when no Redis instance exists."""
    
    def __init__(self):
        self.store = {}
        logger.info("Initializing in-memory Redis fallback...")
        
    def ping(self):
        return True
        
    def get(self, key):
        val = self.store.get(key)
        if val is not None:
            return val.encode("utf-8") if isinstance(val, str) else val
        return None
        
    def set(self, key, value, *args, **kwargs):
        self.store[key] = value
        return True
        
    def delete(self, key):
        self.store.pop(key, None)
        return True
        
    def rpush(self, key, *values):
        if key not in self.store:
            self.store[key] = []
        self.store[key].extend([v.encode("utf-8") if isinstance(v, str) else v for v in values])
        return len(values)
        
    def lpop(self, key):
        if key in self.store and self.store[key]:
            val = self.store[key].pop(0)
            return val
        return None
        
    def llen(self, key):
        if key in self.store:
            return len(self.store[key])
        return 0
        
    def sadd(self, key, *values):
        if key not in self.store:
            self.store[key] = set()
        added = 0
        for val in values:
            b_val = val.encode("utf-8") if isinstance(val, str) else val
            if b_val not in self.store[key]:
                self.store[key].add(b_val)
                added += 1
        return added
        
    def publish(self, channel, message):
        logger.info(f"[PubSub Broadcast -> {channel}]: {message}")
        return 1


_fallback_mock_instance = None

def get_redis_client(redis_url: str):
    """Attempt connection to Redis, fallback to InMemoryRedisMock if connection fails."""
    global _fallback_mock_instance
    try:
        client = redis.Redis.from_url(redis_url, socket_connect_timeout=1)
        client.ping()
        logger.info("Successfully connected to Redis server.")
        return client
    except Exception:
        if _fallback_mock_instance is None:
            _fallback_mock_instance = InMemoryRedisMock()
        logger.warning("Redis server connection failed. Falling back to shared InMemoryRedisMock.")
        return _fallback_mock_instance
