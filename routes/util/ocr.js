﻿'use strict';

var express = require('express');
var fs = require('fs');
var multer = require("multer");
var exceljs = require('exceljs');
var appRoot = require('app-root-path').path;
var localRequest = require('sync-request');
var request = require('request');
var propertiesConfig = require(appRoot + '/config/propertiesConfig.js');
var queryConfig = require(appRoot + '/config/queryConfig.js');
var commonDB = require(appRoot + '/public/js/common.db.js');
var commonUtil = require(appRoot + '/public/js/common.util.js');
var oracle = require('../util/oracle.js');

const defaults = {
    encoding: 'utf8',
};


/***************************************************************
 * Router
 * *************************************************************/

// [POST] LOCAL OCR API (request binary data)
exports.localOcr = function (req, done) {
    return new Promise(async function (resolve, reject) {
        var pharsedOcrJson = "";
        try {
            var uploadImage = fs.readFileSync(req, 'binary');
            var base64 = new Buffer(uploadImage, 'binary').toString('base64');
            var binaryString = new Buffer(base64, 'base64').toString('binary');
            uploadImage = new Buffer(binaryString, "binary");

            var res = localRequest('POST', propertiesConfig.ocr.uri, {
                headers: {
                    'Ocp-Apim-Subscription-Key': propertiesConfig.ocr.subscriptionKey,
                    'Content-Type': 'application/octet-stream'
                },
                uri: propertiesConfig.ocr.uri + '?' + 'language=unk&detectOrientation=true',
                body: uploadImage,
                method: 'POST'
            });
            //var resJson = JSON.parse(res.getBody('utf8'));
            //pharsedOcrJson = ocrJson(resJson.regions);

            jsonRes = JSON.parse(res);
            if (jsonRes.textAngle > 0.1) {
                return done(null, jsonRes);
            }
            var resJson = ocrParsing(res.getBody('utf8'));

            return done(null, resJson);
        } catch (err) {
            console.log(err);
            return done(null, 'error');
        } finally {

        }
        /*
        var returnObj;
        var fileName = req;

        try {
            fs.readFile(propertiesConfig.filepath.convertedImagePath + fileName, function (err, data) {
                if (err) throw err;

                var buffer;
                var base64 = new Buffer(data, 'binary').toString('base64');
                var binaryString = new Buffer(base64, 'base64').toString('binary');
                buffer = new Buffer(binaryString, "binary");

                var params = {
                    'language': 'unk',
                    'detectOrientation': 'true'
                };

                request({
                    headers: {
                        'Ocp-Apim-Subscription-Key': propertiesConfig.ocr.subscriptionKey,
                        'Content-Type': 'application/octet-stream'
                    },
                    uri: propertiesConfig.ocr.uri + '?' + 'language=' + params.language + '&detectOrientation=' + params.detectOrientation,
                    body: buffer,
                    method: 'POST'
                }, function (err, response, body) {
                    if (err) { // request err
                        throw err;
                    } else {
                        if ((JSON.parse(body)).code) { // ocr api error
                            return done(null, { code: parseInt((JSON.parse(body)).code), message: (JSON.parse(body)).message });
                        } else { // 성공
                            return done(null, { code: 200, message: JSON.parse(body) });
                        }
                    }
                });
            });

        } catch (err) {
            reject(err);
            return done(null, { code: 500, message: err });
        } finally {           
        }
        */
    });   
};

// [POST] PROXY OCR API (request binary data)
exports.proxyOcr = function (req, done) {
    return new Promise(async function (resolve, reject) {
        var fileName = req;

        try {
            var formData = {
                file: {
                    value: fs.createReadStream(fileName),
                    options: {
                        filename: fileName,
                        contentType: 'image/jpeg'
                    }
                }
            };

            request.post({ url: propertiesConfig.proxy.serverUrl + '/ocr/api', formData: formData }, function (err, httpRes, body) {
                var resJson = ocrParsing(body);
                return done(null, resJson);
            });

        } catch (err) {
            reject(err);
        } finally {
        }
    });
};

//pass => 한글 English 1234567890 <>,.!@#$%^&*()~`-+_=|;:?/ lid => Iñtërnâtiônàlizætiøn☃
//send전 parsing 된 array 중 text안에 {}[]'" 있을 경우 삭제
function ocrParsing(body) {
    var data = [];

    try {
        var body = JSON.parse(body);

        // ocr line parsing
        for (var i = 0; i < body.regions.length; i++) {
            for (var j = 0; j < body.regions[i].lines.length; j++) {
                var item = '';
                for (var k = 0; k < body.regions[i].lines[j].words.length; k++) {
                    if (body.regions[i].lines[j].words[k].text == '공단부담금') {
                        data.push({ 'location': body.regions[i].lines[j].words[k].boundingBox, 'text': body.regions[i].lines[j].words[k].text.trim() });
                        break;
                    }
                    item += body.regions[i].lines[j].words[k].text + ' ';
                }
                data.push({ 'location': body.regions[i].lines[j].boundingBox, 'text': item.trim() });
            }
        }

        // ocr x location parsing
        var xInterval = 20; // x pixel value

        for (var i = 0; i < data.length; i++) {
            for (var j = 0; j < data.length; j++) {
                if (data[i].location != data[j].location) {
                    var targetLocArr = data[i].location.split(',');
                    var compareLocArr = data[j].location.split(',');
                    var width = Number(targetLocArr[0]) + Number(targetLocArr[2]); // target text width
                    var textSpacing = Math.abs(Number(compareLocArr[0]) - width) // spacing between target text and compare text

                    if (textSpacing <= xInterval && compareLocArr[1] == targetLocArr[1]) {
                        data[i].location = targetLocArr[0] + ',' + targetLocArr[1] + ',' +
                            (Number(targetLocArr[2]) + Number(compareLocArr[2]) + textSpacing) + ',' + targetLocArr[3];
                        data[i].text += ' ' + data[j].text;
                        data[j].text = '';
                        data[j].location = '';
                    }
                }
            }
        }

        for (var i = 0; i < data.length; i++) {
            if (data[i].location == '' && data[i].text == '') data.splice(i, 1);
        }
        // ocr text Unknown character parsing
        var ignoreChar = ['"'.charCodeAt(0), '\''.charCodeAt(0), '['.charCodeAt(0), ']'.charCodeAt(0),
        '{'.charCodeAt(0), '}'.charCodeAt(0)];

        for (var i = 0; i < data.length; i++) {
            var modifyText = data[i].text;
            for (var j = 0; j < data[i].text.length; j++) {
                var ascii = data[i].text.charCodeAt(j);
                if (ascii > 127 || ignoreChar.indexOf(ascii) != -1) {
                    var rep = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/;
                    if (!rep.test(data[i].text[j])) { // not Korean
                        rep = new RegExp(((ascii < 128) ? '\\' : '') + data[i].text[j], "gi");
                        modifyText = modifyText.replace(rep, '');
                    }
                }
            }
            data[i].text = modifyText;
        }

    } catch (e) {
        console.log(e);
        data = { 'error': e };
    } finally {
        return data;
    }
}