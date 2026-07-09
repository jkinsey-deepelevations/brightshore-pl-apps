#!/bin/sh

set -e

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

/bin/sh "$REPO_ROOT/ci_scripts/ci_post_clone.sh"
