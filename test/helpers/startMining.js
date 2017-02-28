const spawn = require('child_process').spawn;

const pubkeys = {};

function doCmd(cmd, args, opts) {
  console.log('doCmd', {cmd, args, opts });
  const cmd1 = spawn(cmd, args, opts);
  return new Promise((resolve, reject) => {
    var outStr = '';
    cmd1.stdout.on('data', (chunk) => {
      console.log(`stdout: ${chunk}`);
      outStr += chunk;
    });

    cmd1.stderr.on('data', (data) => {
      console.log(`stderr: ${data}`);
    });
    
    cmd1.on('close', (code) => {
      try {
        outObj = JSON.parse(outStr);
      } catch(e) {
        console.log('non-json output');
        resolve(outStr);
        return;
      }
      if (code !== 0) {
        reject(new Error(`child process exited with code ${code}`));
        return;
      }
      resolve(outObj);
    });
  });
}

function retryCmd(cmd, args, opts, test) {
  return doCmd(cmd, args, opts).then(obj => {
    if (test(obj)) {
      return obj;
    }
    return new Promise(resolve => {
      setTimeout(function() {
        resolve(retryCmd(cmd, args, opts, test));
      }, 1000);
      console.log('Retrying...');
    });
  });
}

function waitForBalance(person, biggerThan = 0) {
  return retryCmd('docker', ['exec', person, 'lncli', 'walletbalance', '--witness_only=true'], undefined, obj => {
    return ((typeof obj === 'object') && (typeof obj.balance === 'number') && (obj.balance > biggerThan));
  });
}

function findPubKeys(players) {
  if (players.length === 0) {
    return Promise.resolve();
  }
  var person = players[0];
  return retryCmd('docker', ['exec', person, 'lncli', 'getinfo'], undefined, obj => {
    if ((typeof obj === 'object') && (typeof obj.identityPubkey === 'string')) {
      console.log(`${person}'s pubkey: ${obj.identityPubkey}`);
      pubkeys[person] = obj.identityPubkey;
      return true;
    }
    return false;
  }).then(() => {
    return findPubKeys(players.slice(1));
  });
}

function createWallet(person) {
  return retryCmd('docker', ['exec', person, 'lncli', 'newaddress', 'np2wkh'], undefined, obj => {
    return ((typeof obj === 'object') && (typeof obj.address === 'string'));
  }).then(obj => {
    return obj.address;
  });
}

function bringUp(container, opts) {
  if (typeof opts === 'undefined') {
    opts = { env: process.env, cwd: './docker' };
  }
  return doCmd('docker-compose',  ['up', '-d', container], opts);
}

function bringUpPlayers(players) {
  if (players.length === 0) {
    return Promise.resolve();
  }
  return bringUp(players[0]).then(() => {
    return bringUpPlayers(players.splice(1));
  });
}

// (first player becomes miner)
function bringUpSegwit(players) {
  return Promise.resolve().then(() => {
    return bringUp(players[0]);
  }).then(() => {
    return bringUp('btcd');
  }).then(() => {
    return createWallet(players[0]);
  }).then(address => {
    var env = process.env;
    env.MINING_ADDRESS = address;
    return bringUp('btcd', {
      env,
      cwd: './docker',
    });
  }).then(() => {
    return doCmd('docker-compose',  ['run', 'btcctl', 'generate', '400'], { env: process.env, cwd: './docker' });
  }).then(() => {
    return doCmd('docker-compose',  ['run', 'btcctl', 'getblockchaininfo'], { env: process.env, cwd: './docker' });
  }).then(obj => {
    if (obj.bip9_softforks.segwit.status === 'active') {
      console.log('segwit ole!');
    } else {
      throw new Error('failed to get segwit :(');
    }
    return doCmd('docker-compose', ['stop', players[0]], { env: process.env, cwd: './docker' });
  }).then(() => {
    return doCmd('docker-compose', ['up', '--no-recreate', '-d', players[0]], { env: process.env, cwd: './docker' });
  }).then(() => {
    return bringUpPlayers(players.splice(1));
  });
}

function createPeers(from, to) {
  console.log('createPeers', { from, to });
  return Promise.resolve().then(() => {
    return retryCmd('docker', ['inspect', to], undefined, obj => {
      console.log('testing', obj);
      return (Array.isArray(obj) &&
        typeof obj[0].NetworkSettings === 'object' &&
        typeof obj[0].NetworkSettings.Networks === 'object' &&
        typeof obj[0].NetworkSettings.Networks.docker_default === 'object' &&
        typeof obj[0].NetworkSettings.Networks.docker_default.IPAddress === 'string');
    });
  }).then(obj => {
    console.log(`${to} container inspect`, obj);
    return `${pubkeys[to]}@${obj[0].NetworkSettings.Networks.docker_default.IPAddress}:10011`;
  }).then(toAddr => {
    console.log(`Connecting ${from} to ${toAddr}`);
    return doCmd('docker', ['exec', from, 'lncli', 'connect', toAddr]);
  }).then(() => {
    return doCmd('docker', ['exec', from, 'lncli', 'listpeers']);
  }).then(obj => {
    console.log(`${from} peers`, obj);
    if (obj.peers[0].pubKey !== pubkeys[to]) {
      throw new Error(`${from} not peered to ${to}`);
    }
    return doCmd('docker', ['exec', to, 'lncli', 'listpeers']);
  }).then(obj => {
    console.log(`${to} peers`, obj);
    if (obj.peers[0].pubKey !== pubkeys[from]) {
      throw new Error(`${to} not peered to ${from}`);
    }
  });
}

function createChannel(from, to) {
  console.log('createChannel', { from, to });
  return Promise.resolve().then(() => {
    console.log({ pubkeys }, `${from} will now open the channel`);
    return retryCmd('docker', ['exec', from, 'lncli', 'openchannel', `--node_key=${pubkeys[to]}`, '--num_confs=1', '--local_amt=1000000'], undefined, obj => {
      return ((typeof obj === 'object') && (typeof obj.funding_txid === 'string'));
    });
  }).then(() => {
     return doCmd('docker-compose', ['run', 'btcctl', 'generate', '1'], { env: process.env, cwd: './docker' });
  }).then(() => {
    return retryCmd('docker', ['exec', from, 'lncli', 'listchannels'], undefined, obj => {
      return ((typeof obj === 'object') && Array.isArray(obj.channels));
    });
  }).then(obj => {
    console.log(`${from} channels`, obj);
    if (obj.channels[0].remotePubkey !== pubkeys.bob) {
      throw new Error(`No Channel to ${to}`);
    } else {
      console.log('channel ole!');
    }
  });
}


//...
return Promise.resolve().then(() => {
  return bringUpSegwit(['alice', 'bob']);
}).then(() => {
  return findPubKeys(['alice', 'bob']);
}).then(() => {
  return createPeers('alice', 'bob');
}).then(() => {
  return waitForBalance('alice');
}).then(() => {
  return createChannel('alice', 'bob');
});
