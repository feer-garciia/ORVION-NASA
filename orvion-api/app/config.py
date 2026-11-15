from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # variables que esperamos del .env
    earthdata_token: str = ""
    
    # leer el archivo .env
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()