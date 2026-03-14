const constants = require('../constants.js');

function getStartupBanner(listenPort) {
    const publicPort = constants.externalPort || listenPort;
    const publicBaseUrl = constants.publicBaseUrl || `http://127.0.0.1:${publicPort}`;
    const internalBaseUrl = `http://127.0.0.1:${listenPort}`;
    const showInternalUrl = constants.publicBaseUrl || `${publicPort}` !== `${listenPort}`;

    const lines = [
        '',
        '                ooooooa       ',
        '             Qooooooooo       ',
        '           booooooooooo       ',
        '         aoooooo*oooooo       ',
        '       *oo*     ooooooo       ',
        '     ho*oo*     ooooooo       ',
        '     ooooo*     ooooooo       ',
        '     ooooo*     ooooooo       ',
        '     ooooo*     ooooooo       ',
        '     oooooooooooooooooa       ',
        '     ooooo ooooooo*           ',
        '     **h     aoooo*o*Q        ',
        '               *ooooooh       ',
        '',
        'Construa com foco.',
        'Crie com autonomia.',
        '',
        '— with ❤️ by Rods Company',
        '',
        '🚀 ffmpeg-api online',
        `🌐 Base URL: ${publicBaseUrl}`,
        `📚 Docs: ${publicBaseUrl}/docs`,
        `🧾 OpenAPI: ${publicBaseUrl}/openapi.yaml`,
        `🩺 Health: ${publicBaseUrl}/v1/health`,
        `🔌 Endpoints: ${publicBaseUrl}/endpoints`,
        `⚙️ Runtime: ${constants.nodeEnv} | concurrency=${constants.jobConcurrency} | sync_small_jobs=${constants.enableSyncSmallJobs}`,
    ];

    if (showInternalUrl) {
        lines.push(`🐳 Internal listen: ${internalBaseUrl}`);
    }

    lines.push('');

    return lines.join('\n');
}

module.exports = {
    getStartupBanner,
};
