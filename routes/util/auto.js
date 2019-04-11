'use strict';
var watch = require('node-watch');
var cron = require('node-cron');
var ftpClient = require('ftp-client');
var ftp = require('ftp');
var sync = require('./routes/util/sync.js')
var oracle = require('./routes/util/oracle.js');

//FTP 서버 정보
var ftpConfig = {
    host: '192.168.0.23',
    port: 21,
    user: 'taiho',
    password: '1'
};
var option = { logging: 'basic' };
var uploadDir = 'C:\\Users\\Taiho\\Desktop\\upload'; //local 디렉토리 경로
var ftpDir = '/'; // FTP file 디렉토리 경로

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

    sync.fiber(function () {
        try {
            var execFileNames = [];

            // TBL_FTP_FILE_LIST 데이터 조회
            var fileNames = sync.await(getftpFileList(sync.defer()));

            // FTP 파일 리스트와 DB데이터 비교
            if (fileNames.length != 0) {
                var result = sync.await(oracle.selectFtpFileList(fileNames, sync.defer()));
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
                }
            }

            // ocr 및 ml 프로세스 실행
            if (execFileNames.lenght != 0) {
                //pyOcr.py

                //실행한 파일 TBL_FTP_FILE_LIST insert
                sync.await(oracle.insertFtpFileList(ftpConfig.host + ftpDir, execFileNames, sync.defer()));
            }
        } catch (e) {
            console.log(e);
        } finally {
        }
    });
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
                    for (var i in list) fileNames.push(list[i].name);
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

/********************************************************************************************************
                                           local function end
 *******************************************************************************************************/

module.exports = {
    local: local,
    remoteFTP: remoteFTP,
    remoteFTP_v2: remoteFTP_v2
};