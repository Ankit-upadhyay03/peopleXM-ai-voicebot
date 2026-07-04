"""Logging configuration and utilities."""

import logging
import logging.config
from pathlib import Path


def setup_logger(name: str = __name__) -> logging.Logger:
    """Setup and return a configured logger."""
    logger = logging.getLogger(name)
    
    if not logger.handlers:
        handler = logging.StreamHandler()
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
    
    return logger


# Create module-level logger
logger = setup_logger(__name__)
