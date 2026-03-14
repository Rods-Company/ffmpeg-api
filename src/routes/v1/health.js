const express = require('express');

const constants = require('../../constants.js');

const router = express.Router();

router.get('/', function(req, res) {
    res.status(200).send({
        status: 'ok',
        syncSmallJobsEnabled: constants.enableSyncSmallJobs,
        syncMaxInputBytes: constants.syncMaxInputBytes,
        jobConcurrency: constants.jobConcurrency,
        maxQueueSize: constants.maxQueueSize,
    });
});

module.exports = router;
