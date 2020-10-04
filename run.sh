#!/usr/bin/env bash

set -o errexit -o nounset -o pipefail
readonly repo="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

function main {
  cd "$repo"

  command -v docker > /dev/null 2>&1 || { echo >&2 "I require docker but it's not installed. Aborting."; exit 1; }
  docker ps > /dev/null 2>&1 || { echo >&2 "Running 'docker ps' failed. Is docker daemon running? Aborting."; exit 1; }

  docker-compose up -d

  export NVM_DIR="${NVM_DIR:-$HOME/.cache/nvm}"
  source "$repo/nvm.sh"
  nvm install "14.12.0" || nvm use "14.12.0"

  npx ts-node main.ts
}

main "$@"
