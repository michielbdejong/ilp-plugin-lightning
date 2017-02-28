var Client = require('lnrpc-client').Client;
console.log(Client)
var lightning = new Client('127.0.0.1', '32904');
console.log(JSON.stringify(lightning.prototype));
lightning.getInfo(function(err, response) {
  console.log(err, response);
});
lightning.sendPayment('to', 10, 'paymentHashStr', function(err, response) {
  console.log(err, response);
});
