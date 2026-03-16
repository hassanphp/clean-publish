#!/usr/bin/env python3
"""Quick test that Replicate API works with your token. Run from ai-backend: python scripts/test_replicate.py"""
import os
import sys

# Load .env
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv
load_dotenv()

def main():
    token = os.getenv("REPLICATE_API_TOKEN")
    if not token:
        print("ERROR: REPLICATE_API_TOKEN not set in .env")
        sys.exit(1)
    print("Token found (starts with", token[:10] + "...)")

    import replicate
    # Minimal test: run a tiny model to verify auth
    print("Testing Replicate API...")
    try:
        # Use a simple, fast model - flux-schnell generates an image from text (no input image)
        output = replicate.run(
            "black-forest-labs/flux-schnell",
            input={"prompt": "a red car", "num_outputs": 1},
        )
        print("SUCCESS: Replicate API works. Output type:", type(output))
        if hasattr(output, "__iter__") and not isinstance(output, str):
            for i, item in enumerate(output):
                print(f"  Output[{i}]:", type(item), getattr(item, "url", item)[:50] if hasattr(item, "url") else str(item)[:50])
    except Exception as e:
        print("FAILED:", type(e).__name__, str(e))
        sys.exit(1)

if __name__ == "__main__":
    main()
