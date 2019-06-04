'use strict';
var express = require('express');
var router = express.Router();
var appRoot = require('app-root-path').path;
var dbConfig = require(appRoot + '/config/dbConfig');
var queryConfig = require(appRoot + '/config/queryConfig.js');
var commonDB = require(appRoot + '/public/js/common.db.js');
var commonUtil = require(appRoot + '/public/js/common.util.js');
var oracledb = require('oracledb');
var oracle = require('../util/oracle.js');
var sync = require('../util/sync.js');

/***************************************************************
 * Router
 * *************************************************************/

router.get('/favicon.ico', function (req, res) {
    res.status(204).end();
});

// 문서등록 (GET)
router.get('/', function (req, res) {
    if (req.isAuthenticated()) res.render('user/docManagement', { currentUser: req.user });
    else res.redirect("/logout");
});

// 문서등록 (POST)
router.post('/', function (req, res) {
    if (req.isAuthenticated()) res.render('user/invoiceManagement', { currentUser: req.user });
    else res.redirect("/logout");
});

// 문서 TopType 조회하기
router.post('/selectDocTopType', function (req, res) {
    sync.fiber(function () {
        var returnJson;

        try {
            let docToptypeList = sync.await(oracle.selectDocTopType([req.session.userId], sync.defer()));

            returnJson = { 'docToptypeList': docToptypeList };
        } catch (e) {
            console.log(e);
            returnJson = { 'error': e };
        } finally {
            res.send(returnJson);
        }
    });
});

// 문서관리 ocr data 조회하기
router.post('/selectBatchPoMlExport', function (req, res) {
    sync.fiber(function () {
        var returnJson;

        try {
            let docTopType = req.body.docTopType;
            let startDate = (req.body.startDate) ? req.body.startDate.replace(/-/gi, '') + '000000' : null;
            let endDate = (req.body.endDate) ? req.body.endDate.replace(/-/gi, '') + '235959' : null;
            let processState = (req.body.processState) ? req.body.processState : null;
            let pagingCount = (req.body.pagingCount) ? req.body.pagingCount : 1;
            let docLabelList = sync.await(oracle.selectDocLabelDefList([docTopType], sync.defer()));

            let result = sync.await(oracle.selectBatchPoMlExport([docTopType, startDate, endDate, processState], pagingCount, sync.defer()));

            returnJson = { 'docDataList': result[1], 'docLabelList': docLabelList, 'totCount': result[0] };
        } catch (e) {
            console.log(e);
            returnJson = { 'error': e };
        } finally {
            res.send(returnJson);
        }
    });
});

// ocr data 전송하기
router.post('/sendOcrData', function (req, res) {
    sync.fiber(function () {
        var returnJson;

        try {
            returnJson = { data: req.body.sendData };
        } catch (e) {
            console.log(e);
            returnJson = { 'error': e };
        } finally {
            res.send(returnJson);
        }
    });
});

module.exports = router;