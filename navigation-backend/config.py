import os
from pathlib import Path
from pydantic_settings import BaseSettings

# Look for .env in current folder or parent folder
env_path = ".env" if os.path.exists(".env") else ("../.env" if os.path.exists("../.env") else None)

class Settings(BaseSettings):
    PROJECT_NAME: str = "S37 Accessibility Digital Twin"
    MOCK_MODE: bool = False
    GEMINI_API_KEY: str = os.environ.get("GEMINI_API_KEY", "")
    
    CONFIDENCE_THRESHOLD: float = 0.35
    MAX_IMAGE_SIZE_MB: int = 10
    DEMO_IMAGES_PATH: str = "data/demo_images"

    class Config:
        env_file = env_path
        extra = "ignore"

settings = Settings()