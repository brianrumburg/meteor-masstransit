Package.describe({
  name: 'jsposer:masstransit',
  version: '0.0.1',
  // Brief, one-line summary of the package.
  summary: 'A conduit to MassTransit',
  // URL to the Git repository containing the source code for this package.
  git: '"https://github.com/brianrumburg/meteor-masstransit.git',
  // By default, Meteor will default to using README.md for documentation.
  // To avoid submitting documentation, set this field to null.
  documentation: 'README.md'
});

Package.onUse(function(api) {
  api.versionsFrom('1.1.0.2');
  api.addFiles('lib/masstransit-both.js');  api.addFiles('lib/masstransit-server.js', 'server');
  api.addFiles('lib/masstransit-client.js', 'client');
  api.export('MassTransit');
  api.use('mongo');
});

Package.onTest(function(api) {
  api.use('tinytest');
  api.use('jsposer:masstransit');
  api.addFiles('tests/server/server-tests.js', 'server');
  api.addFiles('tests/client/client-tests.js', 'client');
});

Npm.depends({
  "amqp": "0.2.4",
  "events": "1.0.2"
});
