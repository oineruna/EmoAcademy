from __future__ import annotations

import argparse
import os
import subprocess
from pathlib import Path

from huggingface_hub import HfApi
from huggingface_hub.errors import LocalTokenNotFoundError


ROOT = Path(__file__).resolve().parents[1]
PUBLIC_ENV_KEYS = (
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_EMOTION_API_URL",
)


def load_local_env() -> dict[str, str]:
    values: dict[str, str] = {}
    for env_path in (ROOT / ".env.local", ROOT / ".env.hf.local"):
        if not env_path.exists():
            continue
        for raw_line in env_path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key in PUBLIC_ENV_KEYS and value:
                values[key] = value
    for key in PUBLIC_ENV_KEYS:
        if os.environ.get(key):
            values[key] = os.environ[key]
    return values


def main() -> None:
    parser = argparse.ArgumentParser(description="Deploy EmoAcademy to a Hugging Face Space.")
    parser.add_argument("--space-name", default="emo-academy", help="Space name when --space-id is omitted.")
    parser.add_argument("--space-id", help="Full Space repo id, for example username/emo-academy.")
    parser.add_argument("--private", action="store_true", help="Create the Space as private.")
    args = parser.parse_args()

    api = HfApi()
    try:
        whoami = api.whoami()
    except LocalTokenNotFoundError as exc:
        raise SystemExit(
            "Hugging Faceにログインしてください: hf auth login\n"
            "または HF_TOKEN 環境変数を設定してください。"
        ) from exc

    username = whoami.get("name")
    if not username and whoami.get("orgs"):
        username = whoami["orgs"][0]["name"]
    if not username:
        raise SystemExit("Hugging Faceユーザー名を取得できませんでした。")

    repo_id = args.space_id or f"{username}/{args.space_name}"
    out_dir = ROOT / "out"

    print(f"Creating or updating Space: {repo_id}")
    api.create_repo(
        repo_id=repo_id,
        repo_type="space",
        space_sdk="docker",
        private=args.private,
        exist_ok=True,
    )

    env_values = load_local_env()
    for key in PUBLIC_ENV_KEYS:
        value = env_values.get(key)
        if value:
            api.add_space_variable(repo_id=repo_id, key=key, value=value)
            print(f"Set Space variable: {key}")
        else:
            print(f"Skipped missing Space variable: {key}")

    print("Building static export...")
    subprocess.run(["npm", "run", "build"], cwd=ROOT, check=True, shell=os.name == "nt")

    api.upload_folder(
        repo_id=repo_id,
        repo_type="space",
        folder_path=str(ROOT),
        path_in_repo=".",
        commit_message="Deploy EmoAcademy static Space",
        ignore_patterns=[
            ".git/*",
            ".next/*",
            ".vercel/*",
            "node_modules/*",
            "out/*",
            "build/*",
            ".env",
            ".env.*",
            "!/.env.example",
            "*.tsbuildinfo",
            ".specstory/*",
        ],
    )

    if not (out_dir / "index.html").exists():
        raise SystemExit("Static export was not generated: out/index.html")

    api.upload_folder(
        repo_id=repo_id,
        repo_type="space",
        folder_path=str(out_dir),
        path_in_repo=".",
        commit_message="Upload EmoAcademy static export",
    )

    space_url = f"https://{repo_id.replace('/', '-')}.hf.space"
    print(f"Done: {space_url}")
    print("Supabase Redirect URLsに以下を追加してください:")
    print(f"{space_url}/auth/callback")
    print(f"{space_url}/reset-password")


if __name__ == "__main__":
    main()
