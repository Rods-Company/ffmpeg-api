require('dotenv').config();

const express = require('express');
const compression = require('compression');
const all_routes = require('express-list-endpoints');

const logger = require('./utils/logger.js');
const constants = require('./constants.js');
const {getOpenApiDocument} = require('./services/openapi-doc.js');
const {normalizeError} = require('./services/errors.js');

const timeout = constants.jobTimeoutMs;
let signalHandlersConfigured = false;
let scalarMiddlewarePromise = null;

// catch SIGINT and SIGTERM and exit
// Using a single function to handle multiple signals
function handle(signal) {
    logger.info(`Received ${signal}. Exiting...`);
    process.exit(1)
  }  
function configureSignalHandlers() {
    if (signalHandlersConfigured) {
        return;
    }
    signalHandlersConfigured = true;
    process.on('SIGINT', handle);
    process.on('SIGTERM', handle);
}

function getScalarMiddleware() {
    if (!scalarMiddlewarePromise) {
        scalarMiddlewarePromise = import('@scalar/express-api-reference')
            .then(function(module) {
                return module.apiReference({
                    theme: constants.scalarTheme,
                    showOperationId: true,
                    hideClientButton: false,
                    showSidebar: true,
                    showDeveloperTools: constants.nodeEnv === 'production' ? false : 'localhost',
                    showToolbar: constants.nodeEnv === 'production' ? false : 'localhost',
                    operationTitleSource: 'summary',
                    persistAuth: false,
                    telemetry: constants.scalarTelemetry,
                    layout: constants.scalarLayout,
                    isEditable: false,
                    isLoading: false,
                    hideModels: false,
                    documentDownloadType: 'both',
                    hideTestRequestButton: false,
                    hideSearch: false,
                    hideDarkModeToggle: false,
                    withDefaultFonts: true,
                    defaultOpenFirstTag: true,
                    defaultOpenAllTags: false,
                    expandAllModelSections: false,
                    expandAllResponses: false,
                    orderSchemaPropertiesBy: 'alpha',
                    orderRequiredPropertiesFirst: true,
                    slug: 'ffmpeg-api',
                    title: constants.scalarTitle,
                    url: '/openapi.yaml',
                    pageTitle: constants.scalarTitle,
                });
            });
    }

    return scalarMiddlewarePromise;
}

function createApp() {
    const app = express();

    app.use(compression());
    app.use(express.json({limit: constants.jsonBodyLimit}));

    var v1 = require('./routes/v1/index.js');
    app.use('/v1', v1);

    app.get('/openapi.yaml', function(req, res) {
        res.type('application/yaml').send(getOpenApiDocument());
    });

    app.use('/docs', function(req, res, next) {
        getScalarMiddleware()
            .then(function(middleware) {
                middleware(req, res, next);
            })
            .catch(next);
    });

    require('express-readme')(app, {
        filename: 'index.md',
        routes: ['/'],
    });

    app.get('/endpoints', function(req, res) {
        res.status(200).send(all_routes(app));
    });

    app.use(function(req, res, next) {
      res.status(404).send({error: 'route not found'});
    });

    app.use(function(err, req, res, next) {
        const normalized = normalizeError(err);

        if (req.path.indexOf('/v1/') === 0 || req.path === '/openapi.yaml') {
            res.status(normalized.statusCode).json({
                code: normalized.code,
                message: normalized.message,
                details: normalized.details,
            });
            return;
        }

        res.writeHead(normalized.statusCode, {'content-type' : 'text/plain'});
        res.end(`${normalized.message}\n`);
    });

    return app;
}

function startServer(port) {
    configureSignalHandlers();
    const app = createApp();
    const listenPort = port === undefined || port === null ? constants.serverPort : port;
    const server = app.listen(listenPort, function() {
        let host = server.address().address;
        let currentPort = server.address().port;
        logger.info('Server started and listening http://'+host+':'+currentPort);
    });

    server.on('connection', function(socket) {
        logger.debug(`new connection, timeout: ${timeout}`);
        socket.setTimeout(timeout);
        socket.server.timeout = timeout;
        server.keepAliveTimeout = timeout;
    });

    return server;
}

if (require.main === module) {
    startServer();
}

module.exports = {
    createApp,
    startServer,
};
