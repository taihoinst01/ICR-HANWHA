'use strict';
var watch = require('node-watch');
var cron = require('node-cron');
var ftpClient = require('ftp-client');
var ftpConfig = {
    host: '192.168.0.23',
    port: 21,
    user: 'taiho',
    password: '1'
};
var option = { logging: 'basic' };
var uploadDir = 'C:\\Users\\Taiho\\Desktop\\upload';

var local = function () {
    watch(uploadDir, { recursive: true, filter: /\.png$/ }, function (evt, name) {
        console.log(evt); // update, remove
        console.log('%s', name); // file path + file name
    });
};

var ftp = function () {
    cron.schedule('*/10 * * * * *', function () {
        var client = new ftpClient(ftpConfig, option);
        client.connect(function () {
            client.download('/', uploadDir, {
                overwrite: 'none'
            }, function (result) {
                console.log(result); // file name Array
            });
        })
    });
};

module.exports = {
    local: local,
    ftp: ftp
};
