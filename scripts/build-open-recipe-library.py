"""Build a deterministic text-only CC BY-SA library from the pinned Wikibooks dump.

No network, database writes, image imports, generated instructions or safety claims.
"""
import argparse
import hashlib
import json
import re
import uuid
from pathlib import Path
from urllib.parse import urlsplit

SOURCE_SHA256 = "67fd704a6d9280742d2f217ad9f9e4f50921b84fcdefdff9bac749a518c4d46b"
DATASET_URL = "https://huggingface.co/datasets/gossminn/wikibooks-cookbook"
LICENSE_URL = "https://creativecommons.org/licenses/by-sa/4.0/"


def build(source: Path, destination: Path):
    raw = source.read_bytes()
    if hashlib.sha256(raw).hexdigest() != SOURCE_SHA256:
        raise ValueError("Source differs from the reviewed dataset; review before updating the pin")
    pages = json.loads(raw.decode("utf-8"))
    accepted, rejected, seen_urls, seen_content = [], {}, set(), set()

    def reject(reason):
        rejected[reason] = rejected.get(reason, 0) + 1

    for page in pages:
        recipe = page["recipe_data"]
        url, title = recipe.get("url", ""), recipe.get("title", "").strip()
        parsed = urlsplit(url)
        if parsed.scheme != "https" or parsed.netloc != "en.wikibooks.org" or not parsed.path.startswith("/wiki/Cookbook:") or parsed.query or parsed.fragment:
            reject("invalid_source_url")
            continue
        lines = recipe.get("text_lines", [])
        ingredients = [line["text"].strip() for line in lines if line.get("section") == "Ingredients" and line.get("line_type") in ("ul", "ol") and line.get("text", "").strip()]
        steps = [line["text"].strip() for line in lines if re.fullmatch(r"(?:Procedure[s]?|Preparation|Instructions|Process)(?:\[\d+\])?:?", line.get("section") or "", re.I) and line.get("line_type") == "ol" and line.get("text", "").strip()]
        text = "\n".join([title, *ingredients, *steps])
        if not title or len(ingredients) < 2 or not steps or sum(map(len, steps)) < 60:
            reject("incomplete_recipe")
            continue
        if "\ufffd" in text or any(ord(char) < 32 and char not in "\n\t\r" for char in text):
            reject("invalid_text")
            continue
        if len(ingredients) > 100 or len(steps) > 100 or len(text) > 40000:
            reject("oversized_recipe")
            continue
        fingerprint = hashlib.sha256("\n".join(ingredients + steps).casefold().encode()).hexdigest()
        if url in seen_urls or fingerprint in seen_content:
            reject("duplicate")
            continue
        seen_urls.add(url)
        seen_content.add(fingerprint)
        info = recipe.get("infobox") or {}
        accepted.append({
            "id": str(uuid.uuid5(uuid.NAMESPACE_URL, url)),
            "title": title, "ingredients": ingredients, "steps": steps,
            "sourceUrl": url, "sourceAuthor": "Wikibooks contributors",
            "sourceSiteName": "Wikibooks Cookbook", "license": "CC-BY-SA-4.0",
            "licenseUrl": LICENSE_URL,
            "attribution": f"{title} — Wikibooks contributors ({url}), CC BY-SA 4.0.",
            "modifications": "Selected ingredient and procedure sections; normalized whitespace; images and other sections omitted.",
            "sourceMetadata": {key: info.get(key) for key in ("servings", "time", "difficulty", "category")},
            "reviewStatus": "structurally-validated-not-cooking-tested",
        })
    accepted.sort(key=lambda item: (item["title"].casefold(), item["sourceUrl"]))
    destination.mkdir(parents=True, exist_ok=True)
    output = {"schemaVersion": 1, "license": "CC-BY-SA-4.0", "licenseUrl": LICENSE_URL,
              "sourceDataset": DATASET_URL, "sourceSha256": SOURCE_SHA256,
              "sourceSnapshotDate": "2024-07-31", "recipes": accepted}
    encoded = (json.dumps(output, ensure_ascii=False, indent=2) + "\n").encode()
    (destination / "recipes.json").write_bytes(encoded)
    report = {"inputPages": len(pages), "acceptedRecipes": len(accepted), "rejections": rejected,
              "librarySha256": hashlib.sha256(encoded).hexdigest(), "libraryBytes": len(encoded),
              "imagesIncluded": False, "databaseWritten": False, "cookingTested": False}
    (destination / "build-report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    build(args.source, args.destination)
