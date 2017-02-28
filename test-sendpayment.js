var messages = require('lnrpc-client/rpc_pb');
var services = require('lnrpc-client/rpc_grpc_pb');

var grpc = require('grpc');

function main() {
  var client = new services.LightningClient('127.0.0.1:32904',
                                          grpc.credentials.createInsecure());
  var request = new messages.SendRequest();
  request.setDestString('asdf');
  request.setPaymentHashString('ghjk');
  request.setAmt(10);
  client.sendPayment(request, function(err, response) {
    console.log(err, response.getPaymentPreimage());
  });
}

main();