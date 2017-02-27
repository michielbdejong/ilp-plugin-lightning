'use strict'

const ILP = require('ilp');
const DummyLedgerPlugin = require('.');

const sender = ILP.createSender({
  _plugin: DummyLedgerPlugin,
  account: 'alice',
})

const receiver = ILP.createReceiver({
  _plugin: DummyLedgerPlugin,
  account: 'bob',
})

receiver.listen().then(() => {
  receiver.on('incoming', (transfer, fulfillment) => {
    console.log('received transfer:', transfer);
    console.log('fulfilled transfer hold with fulfillment:', fulfillment);
  });

  const request = receiver.createRequest({
    amount: '10',
  });
  console.log('request:', request);

  // Note the user of this module must implement the method for
  // communicating payment requests from the recipient to the sender
  return sender.quoteRequest(request);
}).then(paymentParams => {
  console.log('paymentParams', paymentParams);
  return sender.payRequest(paymentParams);
}).then(result => {
  console.log('sender result:', result);
  // work around bug https://github.com/interledgerjs/ilp/issues/76
  process.exit(0);
}).catch((err) => {
  console.log(err)
});
