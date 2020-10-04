#!/usr/bin/env bash

set -o errexit -o nounset -o pipefail
readonly repo="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

function main {
  cd "$repo"
  docker-compose up -d

  export NVM_DIR="${NVM_DIR:-$HOME/.cache/nvm}"
  source "$repo/nvm.sh"
  nvm install "14.12.0" || nvm use "14.12.0"

  AWS_PROFILE="discord-prod" \
  AWS_REGION="eu-west-1" \
  npx ts-node main.ts
}

main "$@"
