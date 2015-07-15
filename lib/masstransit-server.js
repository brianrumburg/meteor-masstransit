var amqp = Npm.require('amqp'),
    events = Npm.require('events'),
    emitter = new events.EventEmitter(),
    con,
    queue,
    exchanges = {};

var init = function amqpInit(config) {
	con = amqp.createConnection({ host: config.host });
  con.on('error', function(err){
    console.log('connection error: ');
    console.log(err);
  });
	con.on('ready', function() {
    console.log('conection ready');
		queue = con.queue(config.queueName, { durable: true }, function() {
      console.log('queue ready');
			emitter.emit('ready');
			queue.subscribe(function(message) {
				emitter.emit('message', JSON.parse(message.data));
			});
		});
	});
};

var createPendingExchange = function(exchangeName) {
	var exchange = con.exchange(exchangeName, { type: 'fanout' }),
			waitingMessages = [],
			that = new events.EventEmitter();

	var publish = function(route, message) {
		waitingMessages.push({
			route: route,
			message: message
		});
	};

	exchange.addListener('open', function() {
		that.emit('open');
		exchanges[exchangeName] = exchange;
		waitingMessages.forEach(function(m) {
			exchange.publish(m.route, m.message, {
              //messageId: '8a510000-0b38-8000-396f-08d287f0e152',
              deliveryMode: 2,
              headers: { 'Content-Type': 'application/vnd.masstransit+json' }
            }, function(){});
		});
	});

	that.publish = publish;

	return that;
};

var bind = function(exchangeName) {
	exchanges[exchangeName] = exchanges[exchangeName] || createPendingExchange(exchangeName);
	exchanges[exchangeName].addListener('open', function() {
		queue.bind(exchangeName, '');
	});
};

var close = function() {
	con.close();
};

var publish = function(messageType, message) {
	var exchangeName = messageType;
	exchanges[exchangeName] = exchanges[exchangeName] || createPendingExchange(exchangeName);
	var namedExchange = exchanges[exchangeName];

	//namedExchange.publish('', serializer.serialize(message));
  namedExchange.publish('', message, {
          //messageId: '8a510000-0b38-8000-396f-08d287f0e152',
          deliveryMode: 2,
          headers: { 'Content-Type': 'application/vnd.masstransit+json' }
        }, function(){});

  console.log('published ' + JSON.stringify(message, {indent: true}));
};

Outbound.find({}).observe({
  added: function(doc) {
    console.log('outbound added!');
    console.log(doc);

    var msg =
    {
      //destinationAddress: 'rabbitmq://localhost/' + doc.messageType,
      message: doc.message,
      messageType: [ 'urn:message:' + doc.messageType ]
    };

    publish(doc.messageType, msg);

    //delete document
    Outbound.remove(doc._id);
  }
});

emitter.on('ready', function(){
  console.log('binding');
  bind('MassTransitEndpoint.Messages:Pong');
});

var boundFunction = Meteor.bindEnvironment(function(env){
  console.log('message received!');
  console.log(env);

  // var doc = {
  //   rawMessage: env,
  //   messageTypes: env.messageType,
  //   message: env.message
  // };
  //
  // MassTransit-Inbound.insert(doc);

  MassTransit-Inbound.insert(env);
});

emitter.on('message', boundFunction);

MassTransit.init = init;
//MassTransit.bind = bind;
MassTransit.close = close;
//MassTransit.publish = publish;
