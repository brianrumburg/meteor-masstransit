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
//MassTransit.inbound = Inbound;

Inbound.find({}).observe({
  added: function(doc) {
    console.log('message added! ' + JSON.stringify(doc, {indent: true}));

    //process it

    Inbound.remove(doc._id);
  }
});
