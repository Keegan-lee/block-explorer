'use strict';
const Block = require('./server/models/block');
const Config = require('./config');
const Glue = require('glue');
const Hapi = require('hapi');
const Log = require('./server/utils/logger');
const Manifest = require('./manifest');
const Mongoose = require('mongoose');
const Nes = require('nes');


exports.deployment = async (start) => {

    let mongoUri =  Config.get('/mongodb/uri');
    Mongoose.connect(mongoUri, {}).then(() => {
        Log.info(`Connected to ${mongoUri}`);
    },
    err => {
        Log.error(err);
    });

    const manifest = Manifest.get('/', process.env);
    const server = await Glue.compose(manifest, { relativeTo: __dirname });
    await server.initialize();
    if (!start) {
        return server;
    }
    await server.start();

    const socketServer = new Hapi.Server({ port: Config.get('/port/socket') });
    await socketServer.register(Nes);
    socketServer.subscription('/blocks');
    await socketServer.start();

    Log.info(`Websocket port is ${socketServer.info.port}`);

/*
    const publish = async function () {
        Log.debug('publishing block update to socket');
        const options = {url: '/api/blocks'}
        let blocks = (await server.inject('/api/blocks')).result;
        socketServer.publish('/blocks', blocks);
    }

    setInterval(publish, 5000);
*/
    const publish = async function () {
        const options = {url: '/api/blocks'}
        Block.watch().on('change', async change => {
            // We may want to pull data from the change stream
            // itself in the future.  This is easier for the full page
            let blocks = (await server.inject('/api/blocks')).result;
            Log.debug('publishing block update to socket');
            socketServer.publish('/blocks', blocks);
        });
    }
    publish();

    Log.info(`Server started at ${server.info.uri}`);
    return server;
};

if (!module.parent) {
    exports.deployment(true);
    process.on('unhandledRejection', (err) => {
        throw err;
    });
}
