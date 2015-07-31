var amqp = Npm.require('amqp'),
    events = Npm.require('events'),
    emitter = new events.EventEmitter(),
    con,
    queue,
    exchanges = {},
    commandQueue = [],
    ready = false;

var globalConfig;

var log = function(msg) {
  console.log('mt: ' + msg);
};

Outbound.allow({
  insert: function (userId, document) {
    return true;
  }
});

var execWhenReady = function(command) {
	if(ready) {
    command();
  } else {
    commandQueue.push(command);
  }
};

var getKeys = function(dict) {
  var keys = [];
  for (var key in dict) {
    if (dict.hasOwnProperty(key)) {
      keys.push(key);
    }
  }
  return keys;
};

var init = function amqpInit(config) {
  globalConfig = config;
  globalConfig.exchange.confirm = true;

  con = amqp.createConnection(config.connection);

  con.on('error', Meteor.bindEnvironment(function(err){
    ready = false;

    getKeys(exchanges).forEach(function(exchangeName){
      exchanges[exchangeName].open = false;
    });

    log(err);
  }));

	con.on('ready', function() {
    ready = true;
    log('connected to ' + config.connection.host);

    commandQueue.forEach(function(command) {
      command();
    });

    publishAllOutboundDocuments();

    queue = con.queue(config.queue.name, config.queue, function() {
      log('queue ready: ' + config.queue.name);
			emitter.emit('ready');
			queue.subscribe(function(message) {
				emitter.emit('message', JSON.parse(message.data));
			});
		});

	});
};

var getExchange = function(exchangeName) {
  if(!exchanges[exchangeName]) {
    exchanges[exchangeName] = con.exchange(exchangeName, globalConfig.exchange);
    exchanges[exchangeName].addListener('open', Meteor.bindEnvironment(function() {
      exchanges[exchangeName].open = true;
      log('exchange open: ' + exchangeName)
      Outbound.find({messageType: exchangeName}).fetch().forEach(function(doc) {
        publishOutboundDocument(doc);
      });
    }));
  }
  return exchanges[exchangeName];
};

var bind = function(exchangeName) {
  execWhenReady(Meteor.bindEnvironment(function(){
    log('binding to exchange ' + exchangeName);
  	getExchange(exchangeName).addListener('open', function() {
  		queue.bind(exchangeName, '');
  	});
  }));
};

var close = function() {
	con.close();
};

var publishOutboundDocument = function(docId) {
  if(globalConfig.noPublish) { return; }

  if(!ready) { return; }

  var doc = Outbound.findOne(docId);
  if(!doc) {
    log('pub: ' + docId + ' no longer in outbound queue.  assuming previous ack.  nothing to do.');
    return;
  }

  var exchange = getExchange(doc.messageType);
  if(!exchange.open) { return; }

  //schedule a call to ourselves in 5 seconds for retry
  //cancel retry on ack
  //covers case where a failed publish doesn't result in a lost connection an
  //subsequent call to publishAllOutboundDocuments()
  var handle = Meteor.setTimeout(function(){
    log('retry: ' + doc.messageType + ', ' + doc._id);
    publishOutboundDocument(doc._id);
  }, 5000);

  log('pub: ' + doc.messageType + ', ' + doc._id);

  var envelope = {
    message: doc.message,
    messageType: [ 'urn:message:' + doc.messageType ]
  };

  exchange.publish('', envelope,
    {
      deliveryMode: 2,
      headers: { 'Content-Type': 'application/vnd.masstransit+json' }
    },
    Meteor.bindEnvironment(function(error) {
      if(!error) {
        Meteor.clearTimeout(handle); //cancel retry
        Outbound.remove(doc._id);
        log('ack: ' + doc.messageType + ', ' + doc._id);
      } else {
        log('ack error: ' + error);
      }
    })
  );
}

var publishAllOutboundDocuments = Meteor.bindEnvironment(function() {
  Outbound.find({}).fetch().forEach(function(doc) {
    publishOutboundDocument(doc._id);
  });
});

Outbound.find({}).observe({
  added: function(doc) {
    publishOutboundDocument(doc._id);
  }
});

emitter.on('message', Meteor.bindEnvironment(function(envelope){
  MassTransit-Inbound.insert(envelope);
}));

MassTransit.init = init;
MassTransit.bind = bind;
MassTransit.close = close;
