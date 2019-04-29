'use strict';
var fs = require('fs');
var watch = require('node-watch');
var cron = require('node-cron');
var ftpClient = require('ftp-client');
var ftp = require('ftp');
var sync = require('./sync.js')
var oracle = require('./oracle.js');
var ocrUtil = require('../util/ocr.js');

//FTP 서버 정보
var ftpConfig = {
    host: '104.41.171.244',
    port: 21,
    user: 'daerimicr',
    password: 'daerimicr123!@#'
};
var option = { logging: 'basic' };
var uploadDir = 'C:\\Users\\Taiho\\Desktop\\upload'; //local 디렉토리 경로
var ftpDir = '/ScanFiles'; // FTP file 디렉토리 경로

/********************************************************************************************************
                                           process function start
 *******************************************************************************************************/

// local 디렉토리 png 모니터링 (파일추가 및 덮어쓰기 : update, 파일제거 : remove)
var local = function () {
    watch(uploadDir, { recursive: true, filter: /\.png$/ }, function (evt, name) {
        console.log(evt); // update, remove
        console.log('%s', name); // file path + file name
    });
};

// 지정된 시간마다 FTP 서버의 특정 디렉토리에서 local 디렉토리에 없는 파일을 가져와 local 디렉토리로 다운로드
var remoteFTP = function () {
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

// 지정된 시간마다 FTP서버의 특정 디렉토리에서 파일 리스트를 가져와 DB와 비교하여 해당 row가 없으면 프로세스 수행, 있으면 continue
var remoteFTP_v2 = function () {

    cron.schedule('*/10 * * * * *', function () {
        sync.fiber(function () {
            try {

                var execFileNames = [];

                // TBL_FTP_FILE_LIST 데이터 조회
                var fileNames = sync.await(getftpFileList(sync.defer()));
                // FTP 파일 리스트와 DB데이터 비교
                if (fileNames.length != 0) {
                    var result = '';
                    //var result = sync.await(oracle.selectFtpFileList(fileNames, sync.defer()));
                    if (result.length != 0) {
                        for (var i in fileNames) {
                            var isOverlap = false;
                            for (var j in result) {
                                if (fileNames[i] === result[j].FILENAME) {
                                    isOverlap = true;
                                    break;
                                }
                            }
                            if (!isOverlap) execFileNames.push(fileNames[i]);
                        }
                    } else {
                        execFileNames = fileNames;
                    }
                }
                // ocr 및 ml 프로세스 실행
                if (execFileNames.lengh != 0) {
                    //pyOcr.py
                    //var icrResultJson = JSON.parse(sync.await(ocrUtil.icrRest(filepath, isAuto, sync.defer())));
                    for (var i in execFileNames) {
                        if (execFileNames.indexOf('test') != -1) sync.await(moveftpFile(execFileNames[i], sync.defer()));
                    }

                    //실행한 파일 TBL_FTP_FILE_LIST insert
                    //sync.await(oracle.insertFtpFileList(ftpConfig.host + ftpDir, execFileNames, sync.defer()));
                }
                
            } catch (e) {
                console.log(e);
            } finally {
            }
        });
    });

    /*
        const FtpWatcher = require('ftp-watcher');

    const watcher = new FtpWatcher({
        ftpCredentials: ftpConfig,
        cron: '* * * * * *',
        fileExtension: '.pdf' // optional
        //fileNameContains: 'test' // optional
    });

    watcher.on('error', function (error) {
        console.error(error);
        //watcher.stop();
    });

    watcher.on('snapshot', function (snapshot) {
        console.log(snapshot);
        //watcher.stop();
    });

    watcher.watch();
    */
};

/********************************************************************************************************
                                           process function end
 *******************************************************************************************************/

/********************************************************************************************************
                                           local function start
 *******************************************************************************************************/

// FTP server에서 특정 디렉토리 파일 리스트 가져오기
function getftpFileList(done) {
    sync.fiber(function () {
        try {
            var c = new ftp();
            var fileNames = [];
            c.on('ready', function () {
                c.list(ftpDir, function (err, list) {
                    if (err) throw err;
                    for (var i in list) {
                        var ext = list[i].name.substring(list[i].name.lastIndexOf('.') + 1);
                        if (ext == 'pdf') fileNames.push(list[i].name);
                    }
                    return done(null, fileNames);
                    c.end();
                });
            });
            c.connect(ftpConfig);
        } catch (e) {
            console.log(e);
            return done(null, e);
        }
    });
}

// FTP server file move (ScanFiles -> uploads)
function moveftpFile(fileName, done) {
    sync.fiber(function () {
        try {
            var c = new ftp();
            c.on('ready', function () {
                var ftpFilePath = 'ScanFiles/' + fileName;
                var localFilePath = './uploads/' + fileName;
                c.get('ScanFiles/' + fileName, function (err, stream) {
                    if (err) throw err;
                    stream.once('close', function () { c.end(); });
                    stream.pipe(fs.createWriteStream('./uploads/' + fileName));
                    c.put('./uploads/' + fileName, 'uploads/' + fileName, function (err) {
                        if (err) throw err;
                        c.end();
                        fs.unlinkSync('./uploads/' + fileName);
                        return done(null, null);
                    });
                });
                
            });
            c.connect(ftpConfig);
        } catch (e) {
            console.log(e);
            return done(null, e);
        }
    });
}

/********************************************************************************************************
                                           local function end
 *******************************************************************************************************/

module.exports = {
    local: local,
    remoteFTP: remoteFTP,
    remoteFTP_v2: remoteFTP_v2
};