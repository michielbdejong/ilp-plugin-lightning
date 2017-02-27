const spawn = require('child_process').spawn;

function doCmd(cmd, args, opts) {
  console.log('doCmd', {cmd, args, opts });
  const cmd1 = spawn(cmd, args, opts);
  return new Promise((resolve, reject) => {
    var outObj;
    cmd1.stdout.on('data', (data) => {
      console.log(`stdout: ${data}`);
      try {
        outObj = JSON.parse(data);
      } catch(e) {
        console.log('non-json output');
      }
    });

    cmd1.stderr.on('data', (data) => {
      console.log(`stderr: ${data}`);
    });
    
    cmd1.on('close', (code) => {
      console.log(`child process exited with code ${code}`);
      resolve(outObj);
    });
  });
}

doCmd('docker', ['exec', 'alice', 'lncli', 'newaddress', 'np2wkh']).then(obj => {
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
  }
});
