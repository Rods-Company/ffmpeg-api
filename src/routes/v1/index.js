const express = require('express');

const jobs = require('./jobs.js');
const analyze = require('./analyze.js');
const capabilities = require('./capabilities.js');
const health = require('./health.js');

const router = express.Router();

router.use('/jobs', jobs);
router.use('/analyze', analyze);
router.use('/capabilities', capabilities);
router.use('/health', health);

module.exports = router;
