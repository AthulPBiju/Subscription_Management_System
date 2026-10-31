from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./brightloop.db"
    SECRET_KEY: str = "dev-only-change-this-secret-key"
    ACCESS_TOKEN_MINUTES: int = 720
    FRONTEND_ORIGIN: str = "http://localhost:5173"

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

