var amqp = Npm.require('amqp'),
    events = Npm.require('events'),
    emitter = new events.EventEmitter(),
    con,
    queue,
    exchanges = {},
    commandQueue = [],
    ready = false;

var publishQueue = Meteor.bindEnvironment(function(){
  Outbound.find({}).fetch().forEach(function(doc) {
    publishNow(doc);
  });
});

var init = function amqpInit(config) {
	con = amqp.createConnection({ host: config.host });
  con.on('error', function(err){
    console.log('connection error: ');
    console.log(err);
  });
	con.on('ready', function() {
    ready = true;
    console.log('connected');

    commandQueue.forEach(function(command) {
      command();
    });

    publishQueue();

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
              deliveryMode: 2,
              headers: { 'Content-Type': 'application/vnd.masstransit+json' }
            }, function(){});
		});
	});

	that.publish = publish;

	return that;
};

var bind = function(exchangeName) {
  console.log('binding exchange ' + exchangeName);
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

  namedExchange.publish('', message, {
          deliveryMode: 2,
          headers: { 'Content-Type': 'application/vnd.masstransit+json' }
        }, function(){});

  //console.log('published ' + JSON.stringify(message, {indent: true}));
};

Outbound.find({}).observe({
  added: function(doc) {
    // console.log('outbound added!');
    // console.log(doc);

    if(!ready) return;

    publishNow(doc);
  }
});

var publishNow = function(doc) {
  var msg =
  {
    message: doc.message,
    messageType: [ 'urn:message:' + doc.messageType ]
  };

  publish(doc.messageType, msg);

  //delete document
  Outbound.remove(doc._id);
};

var boundFunction = Meteor.bindEnvironment(function(env){
  //console.log('message received!');
  //console.log(env);

  MassTransit-Inbound.insert(env);
});

emitter.on('message', boundFunction);

var execWhenReady = function(command) {
	if(ready) {
    command();
  } else {
    commandQueue.push(command);
  }
};

var publishWhenReady = function(messageType, message) {
  execWhenReady(function(messageType, message) {
    publish(messageType, message);
  })
};

var bindWhenReady = function(messageName) {
  execWhenReady(function() {
    bind(messageName);
  });
};

MassTransit.init = init;
MassTransit.bind = bindWhenReady;
MassTransit.close = close;
