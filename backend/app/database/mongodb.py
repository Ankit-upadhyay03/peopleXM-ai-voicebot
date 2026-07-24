"""MongoDB client for persistent storage.

Handles connection to MongoDB and provides access to the database.
Used for conversation logging, session persistence, and analytics.

Note: If MongoDB is not running, the client will fail gracefully
      on first use (not on import/startup).
"""

from pymongo import MongoClient
from pymongo.database import Database
from pymongo.errors import ConnectionFailure

from ..config import settings


class MongoDBClient:
    """MongoDB client with lazy connection."""

    def __init__(self):
        self._client = None
        self._db = None
        self._connected = None  # None = not tested, True/False = tested

    @property
    def client(self) -> MongoClient:
        """Lazy-initialize MongoDB connection on first use."""
        if self._client is None:
            self._client = MongoClient(
                settings.MONGODB_URI,
                serverSelectionTimeoutMS=5000,
            )
        return self._client

    @property
    def db(self) -> Database:
        """Get the database instance."""
        if self._db is None:
            self._db = self.client[settings.MONGODB_DB_NAME]
        return self._db

    @property
    def is_connected(self) -> bool:
        """Check if MongoDB is reachable. Re-checks each time if previously failed."""
        if self._connected is True:
            return True
        # Retry connection check if previously failed or untested
        try:
            self.client.admin.command("ping")
            self._connected = True
        except Exception:
            self._connected = False
        return self._connected

    def close(self):
        """Close MongoDB connection."""
        if self._client:
            self._client.close()
            self._client = None
            self._db = None
            self._connected = None


# Singleton instance
mongo_client = MongoDBClient()
