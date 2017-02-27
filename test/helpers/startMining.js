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
      }
      if (code !== 0) {
        reject(new Error(`child process exited with code ${code}`));
      }
      resolve(outObj);
    });
  });
}

//...
Promise.resolve().then(() => {
  return doCmd('docker', ['exec', 'alice', 'lncli', 'newaddress', 'np2wkh']);
}).then(obj => {
  var env = process.env;
  env.MINING_ADDRESS = obj.address;
  return doCmd('docker-compose',  ['up', '-d', 'btcd'], {
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
  return doCmd('docker-compose', ['stop', 'alice'], { env: process.env, cwd: './docker' });
}).then(() => {
  return doCmd('docker-compose', ['up', '--no-recreate', '-d', 'alice'], { env: process.env, cwd: './docker' });
}).then(() => {
  return new Promise(resolve => {
    console.log('Giving Alice some time to start up');
    setTimeout(resolve, 2500);
  });
}).then(() => {
  return doCmd('docker', ['exec', 'alice', 'lncli', 'walletbalance', '--witness_only=true']);
}).then(obj => {
  console.log('Alice balance', obj.balance);
  return doCmd('docker-compose', ['up', '--no-recreate', '-d', 'alice'], { env: process.env, cwd: './docker' });
}).then(() => {
  return doCmd('docker', ['exec', 'alice', 'lncli', 'getinfo']);
}).then(obj => {
  console.log('Alice pubkey', obj.identityPubkey);
  pubkeys.alice = obj.identityPubkey;
  return doCmd('docker', ['exec', 'bob', 'lncli', 'getinfo']);
}).then(obj => {
  console.log('Bob pubkey', obj.identityPubkey);
  pubkeys.bob = obj.identityPubkey;
  return doCmd('docker', ['inspect', 'bob']);
}).then(obj => {
  console.log('Bob container inspect', obj);
  return `${pubkeys.bob}@${obj[0].NetworkSettings.Networks.docker_default.IPAddress}:10011`;
}).then(bobAddr => {
  console.log('Connecting Alice to', bobAddr);
  return doCmd('docker', ['exec', 'alice', 'lncli', 'connect', bobAddr]);
}).then(() => {

// // REPEAT
//   return doCmd('docker', ['exec', 'alice', 'lncli', 'getinfo']);
// }).then(obj => {
//   console.log('Alice pubkey', obj.identityPubkey);
//   pubkeys.alice = obj.identityPubkey;
//   return doCmd('docker', ['exec', 'bob', 'lncli', 'getinfo']);
// }).then(obj => {
//   console.log('Bob pubkey', obj.identityPubkey);
//   pubkeys.bob = obj.identityPubkey;
// // END REPEAT


  return doCmd('docker', ['exec', 'alice', 'lncli', 'listpeers']);
}).then(obj => {
  console.log('Alice peers', obj);
  if (obj.peers[0].pubKey !== pubkeys.bob) {
    throw new Error('Alice not peered to Bob');
  }
  return doCmd('docker', ['exec', 'bob', 'lncli', 'listpeers']);
}).then(obj => {
  console.log('Bob peers', obj);
  if (obj.peers[0].pubKey !== pubkeys.alice) {
    throw new Error('Bob not peered to Alice');
  }
  console.log({ pubkeys }, 'alice will now open the channel');

  return doCmd('docker', ['exec', 'alice', 'lncli', 'openchannel', `--node_key=${pubkeys.bob}`, '--num_confs=1', '--local_amt=1000000']);
}).then(() => {
   return doCmd('docker-compose', ['run', 'btcctl', 'generate', '1'], { env: process.env, cwd: './docker' });
}).then(() => {
  return doCmd('docker', ['exec', 'alice', 'lncli', 'listchannels']);
}).then(obj => {
  console.log('Alice channels', obj);
  if (obj.channels[0].remotePubkey !== pubkeys.bob) {
    throw new Error('No Channel to Bob');
  } else {
    console.log('channel ole!');
  }
});
