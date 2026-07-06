#!/bin/sh

set -e

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

"$REPO_ROOT/ci_scripts/ci_post_clone.sh"
