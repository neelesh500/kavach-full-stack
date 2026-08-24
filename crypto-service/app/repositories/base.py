from abc import ABC, abstractmethod
from typing import Dict, Any
import json

class IRepositoryAdapter(ABC):
    """
    Contract Interface encapsulating Database actions ensuring decoupled design.
    Ensures seamless plug-and-play with external databases (Mongo/Pg/Blockchain)
    by ONLY enforcing standard JSON schema compliance.
    """
    
    @abstractmethod
    def save_secure_blob(self, collection_name: str, payload_schema: Dict[str, Any]) -> str:
        """Persist strictly encrypted schema blobs."""
        pass
        
    @abstractmethod
    def retrieve_secure_blob(self, collection_name: str, item_id: str) -> Dict[str, Any]:
        """Fetch strict schema blob."""
        pass

class MockRepositoryAdapter(IRepositoryAdapter):
    """
    Temporary adapter for parallel development. Validates constraint.
    """
    def __init__(self):
        self.store = {}
        
    def save_secure_blob(self, collection_name: str, payload_schema: Dict[str, Any]) -> str:
        if collection_name not in self.store:
            self.store[collection_name] = []
            
        # 1. Enforce strict JSON compatibility for decoupled team
        try:
            json.dumps(payload_schema)
        except TypeError:
            raise ValueError("Payload violates Database Decoupling constraint. Schema must be entirely JSON serializable.")

    def retrieve_secure_blob(self, collection_name: str, item_id: str) -> Dict[str, Any]:
        """Fetch strict schema blob without violating plain text policies."""
        if collection_name in self.store:
            for item in self.store[collection_name]:
                if item["_id"] == item_id:
                    return item
        return {}

# Expose generic instance for cross-module consumption
repo = MockRepositoryAdapter()
