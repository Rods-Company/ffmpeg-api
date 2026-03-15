const express = require('express');

const constants = require('../../constants.js');
const {getEffectivePublicBaseUrl} = require('../../services/openapi-doc.js');

const router = express.Router();

router.get('/', function(req, res) {
    res.status(200).send({
        status: 'ok',
        publicBaseUrl: getEffectivePublicBaseUrl(req),
        syncSmallJobsEnabled: constants.enableSyncSmallJobs,
        syncMaxInputBytes: constants.syncMaxInputBytes,
        jobConcurrency: constants.jobConcurrency,
        maxQueueSize: constants.maxQueueSize,
    });
});

module.exports = router;
