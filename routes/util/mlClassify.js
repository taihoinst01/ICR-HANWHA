'use strict';

// var express = require('express');
// var fs = require('fs');
// var multer = require("multer");
// var exceljs = require('exceljs');
var appRoot = require('app-root-path').path;
// var request = require('request');
// var propertiesConfig = require(appRoot + '/config/propertiesConfig.js');
// var queryConfig = require(appRoot + '/config/queryConfig.js');
// var commonDB = require(appRoot + '/public/js/common.db.js');
// var commonUtil = require(appRoot + '/public/js/common.util.js');
// var pythonConfig = require(appRoot + '/config/pythonConfig');
// var PythonShell = require('python-shell')
var sync = require('../util/sync.js');
var oracle = require('../util/oracle.js');
// var execSync = require('sync-exec');
// var ocrUtil = require('../util/ocr.js');
// var Step = require('step');
// const xlsx = require('xlsx');
// const async = require("async");
var sync = require('../util/sync.js');
var difflib = require('difflib');
var predRegionConfig = require(appRoot + '/config/predRegionConfig');

//PKS 여기서부터 새로 시작


//module.exports = router;
module.exports = {
	classify: function (req, done) {
		sync.fiber(function () {
			try {
                //var retDataList =new Array();
                // mappingSid 추출
                var retReq = req;

                req = sync.await(editOcrTextTypos(req, sync.defer())); //ocrtext 오타수정
                req = sync.await(getMappingSid(req, sync.defer()));
                if(req.docCategory.DOCTOPTYPE == 0)
                {
                    var docTypes = sync.await(refindDocTopType(req, sync.defer()));
                    if (docTypes[1] != 0) {
                        // mappingSid 추출
                        req = sync.await(getMappingSid(req, sync.defer()));
                        // 가변영역추출
                        req = sync.await(findEntry(req, docTypes[0], docTypes[1], sync.defer()));
                    } else {
                        req = retReq;
                    }
                }
                else
                {
                    // 가변영역추출
                    req = sync.await(findEntry(req,req.docCategory.DOCTYPE,req.docCategory.DOCTOPTYPE, sync.defer()));
                }

                //retDataList.push(req);

				return done(null, req);
			} catch (e) {
				console.log(e);
			}

		});
	}
};

// ocrtext 오타수정
function editOcrTextTypos(req, done) {
	sync.fiber(function () {
		try {

            var symspellList = sync.await(oracle.selectIcrSymspell(null, sync.defer()));
            var symspellListLength = symspellList.length;
            var ocrData = req.data;
            var ocrDataLength = ocrData.length;
            //var reqDataLength = req.data.length;
            for(var i = 0; i < symspellListLength; i++) {
                var dbIcrWord = symspellList[i].ICRWORD;
                var dbKeyWord = symspellList[i].KEYWORD; 
                for(var j = 0; j < ocrDataLength; j++) {
                    var ocrText =  ocrData[j].originText;
                    if(dbIcrWord == ocrText) {
                        ocrData[j].text = dbKeyWord;
                    }
                }
            }
			
		} catch (e) {
			console.log(e);
		} finally {
			return done(null, req);
		}

	});
}

function getMappingSid(req, done) {
	sync.fiber(function () {
		try {
			var retData = [];
            var docType = req.docCategory.DOCTYPE;
            
            retData["docCategory"]= req.docCategory;
			for (var i in req.data) {
				var item = req.data[i];
			    var sid = sync.await(oracle.selectSid(req.data[i], sync.defer()));
				var loc = req.data[i].location.split(',');
                var mappingSid = String(docType) + "," + String(loc[0]) + "," + String(loc[1]) + "," + String(parseInt(loc[0]) + parseInt(loc[2])) + "," + sid;
                //var mappingSid = String(docType) + "," + String(loc[0]) + "," + String(loc[1]) + "," + String(parseInt(loc[0]) + parseInt(loc[2])) + "," + String(req.data[i]["sid"]);
				req.data[i]["mappingSid"] = mappingSid;
			}
            retData["data"]= req.data;
			
		} catch (e) {
			console.log(e);
		} finally {
			return done(null, retData);
		}

	});
}


function refindDocTopType(req, done) {
	sync.fiber(function () {
		try {
            var regExp = /[\{\}\[\]\/?.,;:|\)*~`!^\-_+<>@\#$%&\\\=\(\'\"]/gi;
            var docTopType = 0;
            var docType = 0;
            var maxNum = 0;
            var text = [];
            var strText = "";

            let docTypeList = sync.await(oracle.selectRefindDocTopTypeList(req, sync.defer()));

            for(var j in req.data)
            {
                //console.log( req.data[j].text + " [ "+j+" ] " + req.data[j].text.replace(regExp,""));
                text += (req.data[j].text.replace(regExp,"")) + ",";
                if(j == 20){
                    break;
                }
            }
            //console.log(text.length +" |||| "+text);
            if(text.length > 0)
            {
                strText = text.substring(0, text.length -1).toLowerCase();
                for(var i in docTypeList)
                {
                    var ratio = similar(strText, docTypeList[i].DATA);
                    if(ratio > maxNum)
                    {
                        maxNum = ratio;
                        docType = docTypeList[i].DOCTYPE;
                        docTopType = docTypeList[i].DOCTOPTYPE;
                    }
                }
            }
            
		} catch (e) {
			console.log(e);
		} finally {
            if(maxNum > 0.2)
            {
                return done(null, [docTopType,docType]);
            }
            else
            {
                return done(null, [docTopType,docType]);
            }
		}
	});
}

function findEntry(req,docTypeVal, docTopTypeVal, done) {
	sync.fiber(function () {
        try 
        {
            var retData = {};
            var subLabel = [];
            var fixSingleLabel = [];
            var fixMultiLabel = [];
            var fixLabel = [];
            var variLabel = [];
            let docTopTypeParam = [docTopTypeVal];
            let docTypeParam = [docTypeVal];
            /*
            let labelRows = sync.await(oracle.selectDocIdLabelDefList(docTopTypeParam, sync.defer()));
            
            for(var i in labelRows)
            {
                if(labelRows[i].LABELTYPE == 'T' && labelRows[i].AMOUNT == "submulti")
                {
                    subLabel.push(labelRows[i].SEQNUM);
                }
                else if(labelRows[i].LABELTYPE == 'T' && labelRows[i].AMOUNT == "multi")
                {
                    fixMultiLabel.push(labelRows[i].SEQNUM);
                }
                else if(labelRows[i].LABELTYPE == 'T' && labelRows[i].AMOUNT == "single")
                {
                    fixSingleLabel.push(labelRows[i].SEQNUM);
                }

                if(labelRows[i].LABELTYPE == 'T')
                {
                    fixLabel.push(labelRows[i].SEQNUM);
                }

                if(labelRows[i].LABELTYPE == 'P')
                {
                    variLabel.push(labelRows[i].SEQNUM);
                }
            }    
            */
            //label data 추출
            let labelTrainRows = sync.await(oracle.selectLabelTrainDataList(docTypeParam, sync.defer()));

            for(var j in req.data) {
                //var mappingSid = req.data[j].mappingSid.split(",");
                
                //console.log("before : "+req.data[j].text + " X : "+mappingSid[1] + " Y : "+mappingSid[2]);

                if(labelTrainRows.length > 0) {
                    for (var k in labelTrainRows) {
                        if (predictionColumn(req.docCategory, req.data[j], labelTrainRows[k], 'L')) {
                            // console.log("after : "+req.data[j].text + " X : "+mappingSid[1] + " Y : "+mappingSid[2]);
                            // console.log(mappingSid[1] +" || "+ trainRows[k].LOCATION_X);
                            // console.log(mappingSid[2] +" || "+ trainRows[k].LOCATION_Y);
                            req.data[j]["colLbl"] = labelTrainRows[k].CLASS;
                            break;
                        }
                        else {
                            req.data[j]["colLbl"] = -1;
                        }
                    }
                }
                else {
                    req.data[j]["colLbl"] = -1;
                }
            }
            retData["docCategory"] = req.docCategory;
            retData["data"] = req.data;

            //entry data 추출
            let entryTrainRows = sync.await(oracle.selectTrainDataList(docTypeParam, sync.defer()));
            for(var j in req.data) {
                //var location = req.data[j].location.split(",");
                
                //console.log("before : "+req.data[j].text + " X : "+location[0] + " width : "+location[2] + " Y : "+location[1] + " height : "+location[3] );

                for (var k in entryTrainRows) {

                    if (predictionColumn(req.docCategory, req.data[j], entryTrainRows[k], 'E')) {
                        // console.log("after : "+req.data[j].text + " X : "+mappingSid[1] + " Y : "+mappingSid[2]);
                        // console.log(mappingSid[1] +" || "+ trainRows[k].LOCATION_X);
                        // console.log(mappingSid[2] +" || "+ trainRows[k].LOCATION_Y);
                        req.data[j]["entryLbl"] = entryTrainRows[k].CLASS;
                        delete req.data[j].colLbl;
                        break;
                    }
                    /*
                    var locataionX = 0; var locataionWidth = 0; var locataionY = 0; var locataionHeight = 0;

                    locataionX = entryTrainRows[k].OCR_TEXT_X.split(",")[0];
                    locataionWidth = entryTrainRows[k].OCR_TEXT_X.split(",")[1];
                    locataionY = entryTrainRows[k].OCR_TEXT_Y.split(",")[0];
                    locataionHeight = entryTrainRows[k].OCR_TEXT_Y.split(",")[1];

                    // if(location[0] == locataionX && location[2] == locataionWidth && location[1] == locataionY && location[3] == locataionHeight)
                    if(parseInt(location[0]) == parseInt(locataionX) && parseInt(location[1]) == parseInt(locataionY) )
                    {
                        req.data[j]["entryLbl"] = entryTrainRows[k].CLASS;
                        delete req.data[j].colLbl;

                    }
                    else if((parseInt(location[0])+ parseInt(location[2]) == (parseInt(locataionX)+parseInt(locataionWidth))) && 
                            (parseInt(location[1])+ parseInt(location[3]) == (parseInt(locataionY)+parseInt(locataionHeight))) )
                    {
                        req.data[j]["entryLbl"] = entryTrainRows[k].CLASS;
                        delete req.data[j].colLbl;
                    }
                    else if(((parseInt(location[0])+ parseInt(location[2])/2) == ((parseInt(locataionX)+parseInt(locataionWidth))/2)) && 
                            ((parseInt(location[1])+ parseInt(location[3])/2) == ((parseInt(locataionY)+parseInt(locataionHeight))/2)))
                    {
                        req.data[j]["entryLbl"] = entryTrainRows[k].CLASS;
                        delete req.data[j].colLbl;
                    }
                    */
                }
            }
            retData["docCategory"] = req.docCategory;
            retData["data"] = req.data;

            //console.log(retData);
			
		} catch (e) {
			console.log(e);
		} finally {
			return done(null, retData);
		}

	});
}


function similar(str, data) {
    return new difflib.SequenceMatcher(null,str, data).ratio();
}

// label, entry 예측 범위 지정 (기준점 : 좌상단, 우하단)
function predictionColumn(docCategory, targetData, dbRowData, type) {
    var mapJson = predRegionConfig;
    var loc = targetData.location.split(",");   

    // 좌상단 좌표를 기준으로 영역 계산
    var tgXLoc = Number(loc[0]), tgYLoc = Number(loc[1]);
    var dbXLoc = (type == 'L') ? Number(dbRowData.LOCATION_X.split(",")[0]) : Number(dbRowData.OCR_TEXT_X.split(",")[0]);
    var dbYLoc = (type == 'L') ? Number(dbRowData.LOCATION_Y.split(",")[0]) : Number(dbRowData.OCR_TEXT_Y.split(",")[0]);
    var upYLoc = dbYLoc, rightXLoc = dbXLoc, downYLoc = dbYLoc, leftXLoc = dbXLoc;

    if (mapJson[docCategory.DOCTYPE] && mapJson[docCategory.DOCTYPE][dbRowData.CLASS] && mapJson[docCategory.DOCTYPE][dbRowData.CLASS]['LU']
        && mapJson[docCategory.DOCTYPE][dbRowData.CLASS]['LU'][type]) {
        upYLoc += mapJson[docCategory.DOCTYPE][dbRowData.CLASS]['LU'][type].up,
            rightXLoc += mapJson[docCategory.DOCTYPE][dbRowData.CLASS]['LU'][type].right,
            downYLoc += mapJson[docCategory.DOCTYPE][dbRowData.CLASS]['LU'][type].down,
            leftXLoc += mapJson[docCategory.DOCTYPE][dbRowData.CLASS]['LU'][type].left;
    } else {
        upYLoc += mapJson['default']['LU'][type].up,
            rightXLoc += mapJson['default']['LU'][type].right,
            downYLoc += mapJson['default']['LU'][type].down,
            leftXLoc += mapJson['default']['LU'][type].left;
    }
    var isLUCheck = (leftXLoc <= tgXLoc && tgXLoc <= rightXLoc) && (upYLoc <= tgYLoc && tgYLoc <= downYLoc);

    // 우하단 좌표를 기준으로 영역 계산
    var tgXLoc = Number(loc[0]) + Number(loc[2]), tgYLoc = Number(loc[1]) + Number(loc[3]);
    var dbXLoc = (type == 'L') ? Number(dbRowData.LOCATION_X.split(",")[0]) + Number(dbRowData.LOCATION_X.split(",")[1]) : Number(dbRowData.OCR_TEXT_X.split(",")[0]) + Number(dbRowData.OCR_TEXT_X.split(",")[1]);
    var dbYLoc = (type == 'L') ? Number(dbRowData.LOCATION_Y.split(",")[0]) + Number(dbRowData.LOCATION_Y.split(",")[1]) : Number(dbRowData.OCR_TEXT_Y.split(",")[0]) + Number(dbRowData.OCR_TEXT_Y.split(",")[1]);
    var upYLoc = dbYLoc, rightXLoc = dbXLoc, downYLoc = dbYLoc, leftXLoc = dbXLoc;

    if (mapJson[docCategory.DOCTYPE] && mapJson[docCategory.DOCTYPE][dbRowData.CLASS] && mapJson[docCategory.DOCTYPE][dbRowData.CLASS]['RD']
        && mapJson[docCategory.DOCTYPE][dbRowData.CLASS]['RD'][type]) {
        upYLoc += mapJson[docCategory.DOCTYPE][dbRowData.CLASS]['RD'][type].up,
            rightXLoc += mapJson[docCategory.DOCTYPE][dbRowData.CLASS]['RD'][type].right,
            downYLoc += mapJson[docCategory.DOCTYPE][dbRowData.CLASS]['RD'][type].down,
            leftXLoc += mapJson[docCategory.DOCTYPE][dbRowData.CLASS]['RD'][type].left;
    } else {
        upYLoc += mapJson['default']['RD'][type].up,
            rightXLoc += mapJson['default']['RD'][type].right,
            downYLoc += mapJson['default']['RD'][type].down,
            leftXLoc += mapJson['default']['RD'][type].left;
    }
    var isRDCheck = (leftXLoc <= tgXLoc && tgXLoc <= rightXLoc) && (upYLoc <= tgYLoc && tgYLoc <= downYLoc);

    return (isLUCheck || isRDCheck) ? true : false;
}
