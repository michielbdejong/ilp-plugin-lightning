var messages = require('lnrpc-client/rpc_pb');
var services = require('lnrpc-client/rpc_grpc_pb');

var grpc = require('grpc');

function main() {
  var clientAlice = new services.LightningClient('127.0.0.1:21009',
                                          grpc.credentials.createInsecure());
  var clientBob = new services.LightningClient('127.0.0.1:22009',
                                          grpc.credentials.createInsecure());
  var request = new messages.GetInfoRequest();
  clientAlice.getInfo(request, function(err, response) {
    console.log(err);
    console.log('pubkey for Alice', response.getIdentityPubkey());
  });
  clientBob.getInfo(request, function(err, response) {
    console.log(err);
    console.log('pubkey for Bob', response.getIdentityPubkey());
  });
}

main();
