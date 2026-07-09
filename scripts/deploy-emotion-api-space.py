from __future__ import annotations

import argparse
from pathlib import Path

from huggingface_hub import HfApi
from huggingface_hub.errors import LocalTokenNotFoundError, RepositoryNotFoundError


ROOT = Path(__file__).resolve().parents[1]
SPACE_DIR = ROOT / "hf-emotion-api"


def main() -> None:
    parser = argparse.ArgumentParser(description="Deploy the EmoAcademy emotion API to Hugging Face Spaces.")
    parser.add_argument("--space-id", default="emoacademy/emotion-api")
    parser.add_argument("--private", action="store_true")
    args = parser.parse_args()

    api = HfApi()
    try:
        api.whoami()
    except LocalTokenNotFoundError as exc:
        raise SystemExit("Hugging Face token is missing. Set HF_TOKEN or run hf auth login.") from exc

    try:
        api.repo_info(repo_id=args.space_id, repo_type="space")
    except RepositoryNotFoundError:
        api.create_repo(
            repo_id=args.space_id,
            repo_type="space",
            space_sdk="docker",
            private=args.private,
            exist_ok=True,
        )
    api.upload_folder(
        repo_id=args.space_id,
        repo_type="space",
        folder_path=str(SPACE_DIR),
        path_in_repo=".",
        commit_message="Deploy EmoAcademy emotion API",
    )

    print(f"Done: https://{args.space_id.replace('/', '-')}.hf.space")


if __name__ == "__main__":
    main()
