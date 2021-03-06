meteor-masstransit
==============================================================================
A messaging conduit between Meteor and MassTransit.  Based heavily on the
[MassTransit.js](https://github.com/MassTransit/MassTransit.js) project.  Added a
couple things to make it easier to work with in Meteor.

# Installation
```
meteor add jsposer:masstransit
```

# Examples
Some [examples](https://github.com/brianrumburg/meteor-masstransit-examples) to get you started.

# Getting Started

### On Server
Send [connection](https://www.npmjs.com/package/amqp#connection), [queue](https://www.npmjs.com/package/amqp#queue), and [exchange](https://www.npmjs.com/package/amqp#exchange) options.
```javascript
//In this case we are connecting to localhost and listening on a new queue named myQueue
MassTransit.init({
  connection: {
    host: 'localhost'
  },
  queue: {
    name: 'myQueue'
  },
  exchange: {
    type: 'fanout'
  }
});

//Tell it what message types you would like to listen for
MassTransit.bind('PingMassTransit:Pong');
```

### On Client OR Server

#### Publishing
```javascript
MassTransit.publish('PingMassTransit:Ping', {
  SomeInteger: 1234,
  SomeDecimal: 2345.6,
  SomeString: 'Hello World!',
  SomeDate: new Date()
});
```

#### Subscribing
Inbound messages (including envelope) can be observed on a [Mongo.Collection](http://docs.meteor.com/#/full/mongo_collection).  [Here](http://masstransit.readthedocs.org/en/latest/advanced/interop.html) is some information on MassTransit's envelope format.
```javascript
MassTransit.inbound.find({}).observe({
  added: function(doc) {
    console.log('server pong received')
    console.log(doc);

    //do something interesting with doc

    MassTransit.inbound.remove(doc._id);
  }
});
```
