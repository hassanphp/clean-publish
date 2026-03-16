"""Redis client for job update Pub/Sub."""

import json
import logging
import os
from typing import Any, AsyncIterator

logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
JOB_UPDATES_PREFIX = "job_updates:"

_redis_client = None


def get_redis():
    """Get Redis client (lazy init). Returns None if Redis unavailable."""
    global _redis_client
    if _redis_client is not None:
        return _redis_client
    try:
        import redis.asyncio as redis
        _redis_client = redis.from_url(REDIS_URL, decode_responses=True)
        return _redis_client
    except Exception as e:
        logger.warning("Redis unavailable: %s", e)
        return None


async def publish_job_update(job_id: str, event: str, data: dict[str, Any]) -> bool:
    """Publish an event to the job's Redis channel. Returns True if published."""
    client = get_redis()
    if not client:
        return False
    try:
        channel = f"{JOB_UPDATES_PREFIX}{job_id}"
        payload = json.dumps({"event": event, "data": data})
        await client.publish(channel, payload)
        return True
    except Exception as e:
        logger.warning("Redis publish failed: %s", e)
        return False


async def subscribe_job_updates(job_id: str) -> AsyncIterator[tuple[str, dict]]:
    """Subscribe to job updates. Yields (event, data) tuples."""
    client = get_redis()
    if not client:
        return
    channel = f"{JOB_UPDATES_PREFIX}{job_id}"
    pubsub = client.pubsub()
    try:
        await pubsub.subscribe(channel)
        async for message in pubsub.listen():
            if message["type"] == "message":
                try:
                    payload = json.loads(message["data"])
                    event = payload.get("event", "update")
                    data = payload.get("data", {})
                    yield event, data
                except json.JSONDecodeError:
                    pass
    finally:
        try:
            await pubsub.unsubscribe(channel)
            await pubsub.close()
        except Exception:
            pass
