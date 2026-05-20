import asyncio
import json
import logging
from typing import Dict, List
from fastapi import WebSocket
import redis.asyncio as aioredis
from app.core.config import settings

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages active WebSocket connections subscribed to real-time job progress."""

    def __init__(self):
        # Maps job_id -> list of active WebSockets
        self.active_connections: Dict[str, List[WebSocket]] = {}
        # Tracks active background listener tasks: job_id -> asyncio.Task
        self.pubsub_tasks: Dict[str, asyncio.Task] = {}

    async def connect(self, websocket: WebSocket, job_id: str):
        await websocket.accept()
        if job_id not in self.active_connections:
            self.active_connections[job_id] = []
        self.active_connections[job_id].append(websocket)
        logger.info(f"WebSocket client connected to job {job_id}")

        # Start Redis PubSub listener for this job if not already running
        if job_id not in self.pubsub_tasks:
            self.pubsub_tasks[job_id] = asyncio.create_task(
                self._redis_pubsub_listener(job_id)
            )

    async def disconnect(self, websocket: WebSocket, job_id: str):
        if job_id in self.active_connections:
            if websocket in self.active_connections[job_id]:
                self.active_connections[job_id].remove(websocket)
                logger.info(f"WebSocket client disconnected from job {job_id}")
            
            # Clean up empty connections
            if not self.active_connections[job_id]:
                del self.active_connections[job_id]
                # Cancel Redis PubSub listener if no one is listening
                if job_id in self.pubsub_tasks:
                    self.pubsub_tasks[job_id].cancel()
                    del self.pubsub_tasks[job_id]
                    logger.info(f"Cancelled PubSub listener for job {job_id} (no active listeners)")

    async def broadcast_to_job(self, job_id: str, message: dict):
        """Broadcasts structured data as JSON string to all clients subscribed to a job."""
        if job_id in self.active_connections:
            message_str = json.dumps(message)
            disconnected_sockets = []
            for connection in self.active_connections[job_id]:
                try:
                    await connection.send_text(message_str)
                except Exception as e:
                    logger.error(f"Failed to send websocket update: {str(e)}")
                    disconnected_sockets.append(connection)
            
            # Clean up failed connections
            for ws in disconnected_sockets:
                await self.disconnect(ws, job_id)

    async def _redis_pubsub_listener(self, job_id: str):
        """Listens to Redis PubSub messages for job_id and forwards them to WebSocket clients."""
        redis_client = aioredis.from_url(settings.REDIS_URL)
        pubsub = redis_client.pubsub()
        channel_name = f"job_progress_{job_id}"
        
        try:
            await pubsub.subscribe(channel_name)
            logger.info(f"Subscribed to Redis channel {channel_name}")
            
            while True:
                try:
                    message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                    if message:
                        data = json.loads(message["data"].decode("utf-8"))
                        await self.broadcast_to_job(job_id, data)
                except asyncio.CancelledError:
                    break
                except Exception as e:
                    logger.error(f"Error in Redis PubSub subscription for job {job_id}: {str(e)}")
                    await asyncio.sleep(1)
        finally:
            await pubsub.unsubscribe(channel_name)
            await redis_client.close()
            logger.info(f"Cleaned up Redis connection for channel {channel_name}")


manager = ConnectionManager()
