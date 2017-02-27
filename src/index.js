'use strict'

const lnd = require('lnrpc-client').LightningClient;
lnd.getInfo();

const EventEmitter2 = require('eventemitter2');

class MissingFulfillmentError extends Error { constructor (message) { super(message); this.name = 'MissingFulfillmentError' } }

// singleton data structure faking the ledger (doesn't work if sender and receiver live in different processes):
var ledger = {
  instances: {},
  transfers: {},
  senders: {},
  fulfillments: {},
};

function register(account, obj) {
  ledger.instances[account] = obj;
}
 
function sendEvent(to, type, arg1, arg2) {
  ledger.instances[to].emit(type, arg1, arg2);
}

module.exports = class PluginDummy extends EventEmitter2 {
  constructor(opts) {
    console.log('CALLED: constructor', opts.account, { opts });
    super();
    this.opts = opts;
    this._connected = false;
    register(opts.account, this);
  }
  connect(opts) {
    console.log('CALLED: connect', this.opts.account, { opts });
    this._connected = true;
    this.emit('connect');
    return Promise.resolve(null);
  }

  disconnect() {
    console.log('CALLED: disconnect', this.opts.account);
    this._connected = false;
    this.emit('disconnect');
    return Promise.resolve(null);
  }

  isConnected() {
    console.log('CALLED: isConnected', this.opts.account);
    return this._connected;
  }

  getInfo() {
    console.log('CALLED: getInfo', this.opts.account);
    return {
      prefix: 'g.testing.dummy.',
      precision: 19,
      scale: 9,
      currencyCode: 'USD',
      currencySymbol: '$',
      connectors: []
    };
  }

  getAccount() {
    console.log('CALLED: getAccount', this.opts.account);
    if (!this._connected) {
      throw new Error('not connected');
    }
    return `g.testing.dummy.${this.opts.account}`;
  }

  getBalance() {
    console.log('CALLED: getBalance', this.opts.account);
    if (!this._connected) {
      return Promise.reject(new Error('not connected'));
    }
    return Promise.resolve('1000');
  }

  getFulfillment(transferId) {
    console.log('CALLED: getFulfillment', this.opts.account, { transferId });
    if (typeof ledger.fulfillments[transferId] === 'undefined') {
      return Promise.reject(new MissingFulfillmentError());
    }
    return Promise.resolve(ledger.fulfillments[transferId]);
  }
  
  sendTransfer(transfer) {
    console.log('CALLED: sendTransfer', this.opts.account, JSON.stringify(transfer, null, 2));
    var parts = transfer.account.substring(transfer.ledger.length).split('.');
    var recipient = parts[0];
    ledger.transfers[transfer.id] = transfer;
    ledger.senders[transfer.id] = this.opts.account;
    this.emit('outgoing_prepare', transfer);
    sendEvent(recipient, 'incoming_prepare', transfer);
    return Promise.resolve(null);
  }

  sendMessage(message) {
    console.log('CALLED: sendMessage', this.opts.account, JSON.stringify(message, null, 2));
    return Promise.reject('not implemented');
  }

  fulfillCondition(transferId, fulfillment)  {
    console.log('CALLED: fulfillCondition', this.opts.account, { transferId, fulfillment });
    var transfer = ledger.transfers[transferId];
    var sender = ledger.senders[transferId];
    ledger.fulfillments[transferId] = fulfillment;
    this.emit('incoming_fulfill', transfer, fulfillment);
    sendEvent(sender, 'outgoing_fulfill', transfer, fulfillment);
    return Promise.resolve(null);
  }

  rejectIncomingTransfer(transferId, rejectMessage) {
    console.log('CALLED: rejectIncomingTransfer', this.opts.account, { transferId, rejectMessage });
    return Promise.reject('not implemented');
  }
};
