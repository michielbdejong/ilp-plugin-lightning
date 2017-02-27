'use strict'

const ILP = require('ilp')
const DummyLedgerPlugin = require('.')

const sender = ILP.createSender({
  _plugin: DummyLedgerPlugin,
  account: 'alice'
})

const receiver = ILP.createReceiver({
  _plugin: DummyLedgerPlugin,
  account: 'bob',
  // A callback can be specified to review incoming payments.
  // This is required when using PSK.
  reviewPayment: (payment, transfer) => {
    if (+transfer.amount > 100) {
      return Promise.reject(new Error('payment is too big!'));
    }
  },
});

receiver.listen().then(() => {
  receiver.on('incoming', (transfer, fulfillment) => {
    console.log('received transfer:', transfer);
    console.log('fulfilled transfer hold with fulfillment:', fulfillment);
  });
  // The user of this module is responsible for communicating the
  // PSK parameters from the recipient to the sender
  const pskParams = receiver.generatePskParams();

  // Note the payment is created by the sender
  const request = sender.createRequest({
    destinationAmount: '10',
    destinationAccount: pskParams.destinationAccount,
    sharedSecret: pskParams.sharedSecret,
  });
  console.log('request:', request);
  return sender.quoteRequest(request);
}).then(paymentParams => {
  console.log('paymentParams', paymentParams);

  return sender.payRequest(paymentParams);
}).then(result => {
  console.log('sender result:', result);
  // work around bug https://github.com/interledgerjs/ilp/issues/76
  process.exit(0);
}).catch((err) => {
  console.log(err);
});
