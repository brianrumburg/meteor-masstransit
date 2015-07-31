MassTransit = {};

Inbound = new Mongo.Collection('MassTransit-Inbound');
Outbound = new Mongo.Collection('MassTransit-Outbound');

var enqueue = function(messageType, message) {
  var doc = {
    messageType: messageType,
    message: message
  }
  Outbound.insert(doc);
};

MassTransit.publish = enqueue;
MassTransit.inbound = Inbound;
MassTransit.outbound = Outbound;
