#!/bin/sh
cd test/helpers/docker
export BITCOIN_NETWORK="simnet"
docker-compose up -d "btcd"
docker-compose up -d "alice"
cd ..
node ./startMining.js
