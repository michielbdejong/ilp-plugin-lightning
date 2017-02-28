#!/bin/sh
export BITCOIN_NETWORK="simnet"
echo Stopping:
docker ps
docker stop `docker ps -q`
echo Removing:
docker ps -a
docker rm `docker ps -qa`
echo Starting up:
cd test/helpers/
node ./startMining.js
cd ..
node payment_test.js
