from __future__ import annotations

import base64
import hashlib
import hmac
import logging
import os
import secrets
from contextlib import closing
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field, field_validator
import psycopg
from psycopg.rows import dict_row


logging.basicConfig(level=logging.INFO, format="[backend] %(message)s")
logger = logging.getLogger("ervis-backend")

ROOT_DIR = Path(__file__).resolve().parent
ENV_FILES = [
    ROOT_DIR / ".env",
    ROOT_DIR / "frontend" / ".env",
    ROOT_DIR / ".env.local",
    ROOT_DIR / "frontend" / ".env.local",
]
EXPECTED_AUTH_TABLES = {
    "users",
    "auth_accounts",
    "auth_sessions",
    "auth_verification_tokens",
}
SCRYPT_N = 16_384
SCRYPT_R = 8
SCRYPT_P = 1
SCRYPT_KEY_LENGTH = 64
SCRYPT_MAXMEM = 32 * 1024 * 1024


def load_env_files() -> list[str]:
    loaded_files: list[str] = []

    for file_path in ENV_FILES:
        if not file_path.exists():
            continue

        loaded_files.append(str(file_path.relative_to(ROOT_DIR)))

        for raw_line in file_path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()

            if not line or line.startswith("#") or "=" not in line:
                continue

            key, raw_value = line.split("=", 1)
            key = key.strip()

            if not key:
                continue

            value = raw_value.strip()
            if (value.startswith('"') and value.endswith('"')) or (value.startswith("'") and value.endswith("'")):
                value = value[1:-1]

            os.environ[key] = value

    return loaded_files


LOADED_ENV_FILES = load_env_files()


def decode_base64url(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(f"{value}{padding}")


def encode_base64url(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("utf-8").rstrip("=")


def normalize_email(email: str) -> str:
    return email.strip().lower()


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    derived_key = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt,
        n=SCRYPT_N,
        r=SCRYPT_R,
        p=SCRYPT_P,
        maxmem=SCRYPT_MAXMEM,
        dklen=SCRYPT_KEY_LENGTH,
    )

    return "$".join(
        [
            "scrypt",
            str(SCRYPT_N),
            str(SCRYPT_R),
            str(SCRYPT_P),
            encode_base64url(salt),
            encode_base64url(derived_key),
        ]
    )


def verify_password(password: str, serialized_hash: str) -> bool:
    parts = serialized_hash.split("$")
    if len(parts) != 6:
        return False

    algorithm, raw_n, raw_r, raw_p, salt_value, expected_value = parts
    if algorithm != "scrypt":
        return False

    try:
        salt = decode_base64url(salt_value)
        expected = decode_base64url(expected_value)
        derived_key = hashlib.scrypt(
            password.encode("utf-8"),
            salt=salt,
            n=int(raw_n),
            r=int(raw_r),
            p=int(raw_p),
            maxmem=SCRYPT_MAXMEM,
            dklen=len(expected),
        )
    except (ValueError, TypeError):
        return False

    return hmac.compare_digest(derived_key, expected)


def build_runtime_database_url() -> str | None:
    direct_database_url = os.environ.get("DATABASE_URL")
    if direct_database_url:
        return direct_database_url

    user = os.environ.get("POSTGRES_USER")
    password = os.environ.get("POSTGRES_PASSWORD")
    database = os.environ.get("POSTGRES_DB")
    host = os.environ.get("POSTGRES_HOST", "127.0.0.1")
    port = os.environ.get("POSTGRES_PORT", "5432")

    if not user or not password or not database:
        return None

    return f"postgresql://{user}:{password}@{host}:{port}/{database}"


def normalize_database_url_for_psycopg(database_url: str) -> str:
    parsed = urlparse(database_url)
    query = parse_qs(parsed.query, keep_blank_values=True)
    query.pop("schema", None)

    normalized_query = urlencode(query, doseq=True)
    return urlunparse(parsed._replace(query=normalized_query))


@dataclass
class Settings:
    app_env: str
    database_url: str | None
    cors_origins: list[str]
    loaded_env_files: list[str]

    @property
    def database_target(self) -> dict[str, Any]:
        if not self.database_url:
            return {"configured": False}

        parsed = urlparse(self.database_url)
        query = parse_qs(parsed.query)

        return {
            "configured": True,
            "scheme": parsed.scheme,
            "host": parsed.hostname,
            "port": parsed.port,
            "database": parsed.path.lstrip("/"),
            "schema": query.get("schema", ["public"])[0],
        }


def build_settings() -> Settings:
    raw_origins = os.environ.get(
        "BACKEND_CORS_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000,http://localhost:80,http://127.0.0.1:80",
    )
    cors_origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]

    return Settings(
        app_env=os.environ.get("APP_ENV") or os.environ.get("NODE_ENV") or "development",
        database_url=build_runtime_database_url(),
        cors_origins=cors_origins,
        loaded_env_files=LOADED_ENV_FILES,
    )


SETTINGS = build_settings()


class RegisterRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str | None = Field(default=None, max_length=60)
    email: str
    password: str
    confirmPassword: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = normalize_email(value)
        if "@" not in normalized or "." not in normalized.split("@")[-1]:
            raise ValueError("Enter a valid email address.")
        return normalized

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if len(value) < 8:
            raise ValueError("Password should be at least 8 characters.")
        if not any(character.isalpha() for character in value):
            raise ValueError("Password should include at least one letter.")
        if not any(character.isdigit() for character in value):
            raise ValueError("Password should include at least one number.")
        return value

    @field_validator("confirmPassword")
    @classmethod
    def validate_confirm_password(cls, value: str) -> str:
        if not value:
            raise ValueError("Please confirm your password.")
        return value


class LoginRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    email: str
    password: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = normalize_email(value)
        if "@" not in normalized or "." not in normalized.split("@")[-1]:
            raise ValueError("Enter a valid email address.")
        return normalized

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if len(value) < 8:
            raise ValueError("Password should be at least 8 characters.")
        return value


class PromptDraftRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    promptId: str | None = Field(default=None, min_length=4, max_length=120)
    content: str = Field(min_length=1, max_length=8000)
    title: str | None = Field(default=None, min_length=1, max_length=120)


class PromptActionRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    draftId: str = Field(min_length=4, max_length=120)


class PromptDryRunRequest(PromptActionRequest):
    sampleInput: str = Field(min_length=1, max_length=4000)


class PromptRollbackRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    targetVersion: int | None = Field(default=None, ge=1)


PROMPT_STORE: dict[str, dict[str, Any]] = {}


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def ensure_prompt(prompt_id: str) -> dict[str, Any]:
    prompt = PROMPT_STORE.get(prompt_id)
    if not prompt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": "Prompt not found.", "promptId": prompt_id},
        )
    return prompt


def ensure_prompt_draft(prompt: dict[str, Any], draft_id: str) -> dict[str, Any]:
    draft = prompt["drafts"].get(draft_id)
    if not draft:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": "Draft not found for prompt.", "draftId": draft_id, "promptId": prompt["id"]},
        )
    return draft


def summarize_prompt(prompt: dict[str, Any]) -> dict[str, Any]:
    return {
        "promptId": prompt["id"],
        "title": prompt.get("title"),
        "status": prompt["status"],
        "publishedVersion": prompt.get("publishedVersion"),
        "updatedAt": prompt["updatedAt"],
    }


def draft_validation_errors(content: str) -> list[str]:
    errors: list[str] = []
    if "{{input}}" not in content:
        errors.append("Prompt content must include the '{{input}}' placeholder.")
    if len(content) < 10:
        errors.append("Prompt content should be at least 10 characters.")
    return errors


app = FastAPI(title="Ervis Local Backend", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=SETTINGS.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def ensure_database_url() -> str:
    if not SETTINGS.database_url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "message": "DATABASE_URL is not configured for the backend runtime.",
                "loadedEnvFiles": SETTINGS.loaded_env_files,
            },
        )

    return SETTINGS.database_url


def open_connection():
    database_url = normalize_database_url_for_psycopg(ensure_database_url())
    return psycopg.connect(database_url, row_factory=dict_row)


def fetch_required_tables() -> dict[str, Any]:
    with closing(open_connection()) as connection, connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            """
        )
        discovered = {row["table_name"] for row in cursor.fetchall()}

    missing = sorted(EXPECTED_AUTH_TABLES - discovered)

    return {
        "available": sorted(discovered),
        "missing": missing,
        "ready": not missing,
    }


def build_user_payload(user_row: dict[str, Any]) -> dict[str, Any]:
    email_verified = user_row.get("emailVerified")

    return {
        "id": user_row["id"],
        "email": user_row["email"],
        "name": user_row.get("name"),
        "image": user_row.get("image"),
        "emailVerified": email_verified.isoformat() if email_verified else None,
    }


@app.on_event("startup")
def log_runtime_summary() -> None:
    logger.info("starting backend in %s", SETTINGS.app_env)
    logger.info("loaded env files: %s", ", ".join(SETTINGS.loaded_env_files) if SETTINGS.loaded_env_files else "none")
    logger.info("database target: %s", SETTINGS.database_target)


@app.get("/healthz")
def healthz() -> dict[str, Any]:
    return {
        "status": "ok",
        "service": "ervis-backend",
        "environment": SETTINGS.app_env,
        "databaseTarget": SETTINGS.database_target,
    }


@app.get("/readyz")
def readyz() -> dict[str, Any]:
    try:
        table_status = fetch_required_tables()
    except HTTPException:
        raise
    except Exception as error:
        logger.exception("readiness check failed")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "message": "Backend could not reach the configured database.",
                "databaseTarget": SETTINGS.database_target,
                "error": str(error),
            },
        ) from error

    if not table_status["ready"]:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "message": "Required auth tables are missing for backend local auth flows.",
                "databaseTarget": SETTINGS.database_target,
                "missingTables": table_status["missing"],
            },
        )

    return {
        "status": "ready",
        "databaseTarget": SETTINGS.database_target,
        "requiredTables": table_status,
    }


@app.post("/api/auth/register")
def register(payload: RegisterRequest) -> dict[str, Any]:
    if payload.password != payload.confirmPassword:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "Please fix the highlighted fields and try again.",
                "fieldErrors": {"confirmPassword": "Passwords must match."},
            },
        )

    try:
        table_status = fetch_required_tables()
        if not table_status["ready"]:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail={
                    "message": "Backend auth tables are missing in the configured database.",
                    "databaseTarget": SETTINGS.database_target,
                    "missingTables": table_status["missing"],
                },
            )

        user_id = f"usr_{secrets.token_hex(12)}"
        password_hash = hash_password(payload.password)

        with closing(open_connection()) as connection, connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO users ("id", "name", "email", "passwordHash", "updatedAt")
                VALUES (%s, %s, %s, %s, NOW())
                RETURNING "id", "name", "email", "image", "emailVerified"
                """,
                (user_id, payload.name or None, payload.email, password_hash),
            )
            created_user = cursor.fetchone()
            connection.commit()

    except HTTPException:
        raise
    except psycopg.errors.UniqueViolation as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "An account already exists for this email address.",
                "fieldErrors": {"email": "Use a different email or sign in instead."},
            },
        ) from error
    except Exception as error:
        logger.exception("user registration failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "message": "Backend user creation failed.",
                "databaseTarget": SETTINGS.database_target,
                "error": str(error),
            },
        ) from error

    return {"ok": True, "user": build_user_payload(created_user)}


@app.post("/api/auth/login")
def login(payload: LoginRequest) -> dict[str, Any]:
    try:
        with closing(open_connection()) as connection, connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT "id", "name", "email", "image", "emailVerified", "passwordHash"
                FROM users
                WHERE email = %s
                LIMIT 1
                """,
                (payload.email,),
            )
            user_row = cursor.fetchone()

    except HTTPException:
        raise
    except Exception as error:
        logger.exception("user login failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "message": "Backend login failed while reading from the configured database.",
                "databaseTarget": SETTINGS.database_target,
                "error": str(error),
            },
        ) from error

    if not user_row or not user_row.get("passwordHash") or not verify_password(payload.password, user_row["passwordHash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"message": "Email or password is incorrect."},
        )

    return {"ok": True, "user": build_user_payload(user_row)}


@app.post("/api/prompts/draft")
def create_prompt_draft(payload: PromptDraftRequest) -> dict[str, Any]:
    prompt_id = payload.promptId or f"prm_{secrets.token_hex(8)}"
    prompt = PROMPT_STORE.get(prompt_id)
    now = utcnow_iso()

    if not prompt:
        prompt = {
            "id": prompt_id,
            "title": payload.title,
            "status": "draft",
            "publishedVersion": None,
            "publishedContent": None,
            "publishedAt": None,
            "drafts": {},
            "history": [],
            "updatedAt": now,
        }
        PROMPT_STORE[prompt_id] = prompt
    elif payload.title:
        prompt["title"] = payload.title

    draft_id = f"drf_{secrets.token_hex(8)}"
    prompt["drafts"][draft_id] = {
        "id": draft_id,
        "content": payload.content,
        "createdAt": now,
        "validation": {"isValid": False, "errors": ["Draft has not been validated yet."]},
        "dryRun": {"passed": False, "sampleInput": None, "output": None, "executedAt": None},
    }
    prompt["updatedAt"] = now

    return {"ok": True, "prompt": summarize_prompt(prompt), "draftId": draft_id}


@app.post("/api/prompts/{prompt_id}/validate")
def validate_prompt_draft(prompt_id: str, payload: PromptActionRequest) -> dict[str, Any]:
    prompt = ensure_prompt(prompt_id)
    draft = ensure_prompt_draft(prompt, payload.draftId)

    errors = draft_validation_errors(draft["content"])
    is_valid = not errors
    draft["validation"] = {"isValid": is_valid, "errors": errors}
    draft["validatedAt"] = utcnow_iso()
    prompt["updatedAt"] = draft["validatedAt"]

    return {
        "ok": True,
        "prompt": summarize_prompt(prompt),
        "draftId": draft["id"],
        "validation": draft["validation"],
    }


@app.post("/api/prompts/{prompt_id}/dry-run")
def dry_run_prompt(prompt_id: str, payload: PromptDryRunRequest) -> dict[str, Any]:
    prompt = ensure_prompt(prompt_id)
    draft = ensure_prompt_draft(prompt, payload.draftId)

    rendered_output = draft["content"].replace("{{input}}", payload.sampleInput)
    passed = "{{input}}" in draft["content"] and len(rendered_output.strip()) > 0
    dry_run_result = {
        "passed": passed,
        "sampleInput": payload.sampleInput,
        "output": rendered_output,
        "executedAt": utcnow_iso(),
    }
    draft["dryRun"] = dry_run_result
    prompt["updatedAt"] = dry_run_result["executedAt"]

    return {"ok": True, "prompt": summarize_prompt(prompt), "draftId": draft["id"], "dryRun": dry_run_result}


@app.post("/api/prompts/{prompt_id}/publish")
def publish_prompt(prompt_id: str, payload: PromptActionRequest) -> dict[str, Any]:
    prompt = ensure_prompt(prompt_id)
    draft = ensure_prompt_draft(prompt, payload.draftId)
    validation = draft.get("validation", {})
    dry_run = draft.get("dryRun", {})

    if not validation.get("isValid"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"message": "Draft must pass validation before publish.", "draftId": payload.draftId},
        )

    if not dry_run.get("passed"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"message": "Dry-run test must pass before publish.", "draftId": payload.draftId},
        )

    if prompt.get("publishedVersion"):
        prompt["history"].append(
            {
                "version": prompt["publishedVersion"],
                "content": prompt["publishedContent"],
                "publishedAt": prompt["publishedAt"],
            }
        )

    next_version = (prompt.get("publishedVersion") or 0) + 1
    now = utcnow_iso()
    prompt["publishedVersion"] = next_version
    prompt["publishedContent"] = draft["content"]
    prompt["publishedAt"] = now
    prompt["status"] = "published"
    prompt["updatedAt"] = now

    return {
        "ok": True,
        "prompt": summarize_prompt(prompt),
        "published": {
            "version": prompt["publishedVersion"],
            "publishedAt": prompt["publishedAt"],
            "content": prompt["publishedContent"],
        },
    }


@app.post("/api/prompts/{prompt_id}/rollback")
def rollback_prompt(prompt_id: str, payload: PromptRollbackRequest) -> dict[str, Any]:
    prompt = ensure_prompt(prompt_id)
    history = prompt.get("history", [])

    if payload.targetVersion is not None:
        history_item = next((item for item in reversed(history) if item["version"] == payload.targetVersion), None)
        if not history_item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"message": "Requested targetVersion not found in prompt history."},
            )
    else:
        history_item = history[-1] if history else None

    if not history_item:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"message": "No published history exists to rollback."},
        )

    now = utcnow_iso()
    prompt["publishedVersion"] = history_item["version"]
    prompt["publishedContent"] = history_item["content"]
    prompt["publishedAt"] = now
    prompt["status"] = "published"
    prompt["updatedAt"] = now

    prompt["history"] = [item for item in history if item["version"] < history_item["version"]]

    return {
        "ok": True,
        "prompt": summarize_prompt(prompt),
        "rolledBackTo": {
            "version": prompt["publishedVersion"],
            "publishedAt": prompt["publishedAt"],
            "content": prompt["publishedContent"],
        },
    }
