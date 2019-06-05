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

            var symspellList = sync.await(oracle.selectIcrSymspell(req.docCategory.DOCTOPTYPE, sync.defer()));
            var symspellListLength = symspellList.length;
            var ocrData = req.data;
            var ocrDataLength = ocrData.length;
            //var reqDataLength = req.data.length;
            for(var i = 0; i < symspellListLength; i++) {
                var dbIcrWord = symspellList[i].ICRWORD;
                var dbKeyWord = symspellList[i].KEYWORD; 
                for(var j = 0; j < ocrDataLength; j++) {
                    var ocrText =  ocrData[j].text;
                    // 전체 수정
                    if(dbIcrWord == ocrText) {
                        ocrData[j].text = dbKeyWord;
                    }
                    // 부분 수정
                    // if(ocrText.indexOf(dbIcrWord)!==-1)
                    // {
                    //     ocrText = ocrText.replace(dbIcrWord, dbKeyWord);
                    //     ocrData[j].text = ocrText;
                    // }
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
			    // var sid = sync.await(oracle.selectSid(req.data[i], sync.defer()));
				var loc = req.data[i].location.split(',');
                var mappingSid = String(docType) + "," + String(loc[0]) + "," + String(loc[1]) + "," + String(parseInt(loc[0]) + parseInt(loc[2])) + ",0,0,0,0,0";
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

function findEntry(req, docTypeVal, docTopTypeVal, done) {
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
            
            let labelRows = sync.await(oracle.selectDocIdLabelDefList(docTopTypeParam, sync.defer()));

            //label data 추출
            let labelTrainRows = sync.await(oracle.selectLabelTrainDataList(docTypeParam, sync.defer()));

            for(var j in req.data) {
                if(labelTrainRows.length > 0) {
                    for (var k in labelTrainRows) {
                        if (predictionColumn(req.docCategory, req.data[j], labelTrainRows[k], 'L')) {
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
                for (var k in entryTrainRows) {
                    // if (entryTrainRows[k].CLASS != "760" && entryTrainRows[k].CLASS != "761" && entryTrainRows[k].CLASS != "502") {
                    if (req.docCategory.DOCTYPE == "329" || req.docCategory.DOCTYPE == "319" ||  req.docCategory.DOCTYPE == "316" ){
						if (predictionColumn(req.docCategory, req.data[j], entryTrainRows[k], 'E') && isValid(labelRows, entryTrainRows[k].CLASS, req.data[j]["text"])) {
							if (!req.data[j]["entryLbls"]) {
								req.data[j]["entryLbls"] = [entryTrainRows[k]];
							} else {
								req.data[j]["entryLbls"].push(entryTrainRows[k]);
							}
							//req.data[j]["entryLbl"] = entryTrainRows[k].CLASS;

							//break;
						}
                    }
                    else
                    {
                        if (entryTrainRows[k].CLASS != "760" && entryTrainRows[k].CLASS != "761" && entryTrainRows[k].CLASS != "502") {
                            if (predictionColumn(req.docCategory, req.data[j], entryTrainRows[k], 'E') && isValid(labelRows, entryTrainRows[k].CLASS, req.data[j]["text"])) {
                                if (!req.data[j]["entryLbls"]) {
                                    req.data[j]["entryLbls"] = [entryTrainRows[k]];
                                } else {
                                    req.data[j]["entryLbls"].push(entryTrainRows[k]);
                                }
                                //req.data[j]["entryLbl"] = entryTrainRows[k].CLASS;
    
                                //break;
                            }
                        }
                    }
                }
                var minDis = 10000;
                if (req.data[j]["entryLbls"]) {
                    for (var k in req.data[j]["entryLbls"]) {
                        var entryItem = req.data[j]["entryLbls"][k];
                        var targetLoc = req.data[j].location.split(',');
                        var entryLoc = [entryItem.OCR_TEXT_X.split(',')[0], entryItem.OCR_TEXT_Y.split(',')[0], entryItem.OCR_TEXT_X.split(',')[1], entryItem.OCR_TEXT_Y.split(',')[1]];
                        var dx = Math.abs((targetLoc[0]) - (entryLoc[0]));
                        var dy = Math.abs((targetLoc[1]) - (entryLoc[1]));
                        var tragetDis = Math.sqrt((dx * dx) + (dy * dy));
                        if (tragetDis < minDis) {
                            minDis = tragetDis;
                            req.data[j]["entryLbl"] = entryItem.CLASS;
                            req.data[j]["amount"] = entryItem.AMOUNT;
                            if (entryItem.AMOUNT == "multi") {
                                req.data[j]["first"] = "Y";
                            }
                            delete req.data[j]["colLbl"];
                        }
                    }
                }
            }         
            
            //Multy entry search
            var diffHeight = 200;
            for (var j in req.data) {
                var amount = req.data[j]["amount"];
                if(typeof amount != "undefined" && amount == "multi" && typeof req.data[j]["first"] != "undefined" && req.data[j]["first"] == "Y") {
                    //console.log(req.data[j]);
                    var firstEntry = req.data[j];
                    var preEntryHeight = req.data[j];
                    for (var k in req.data) {
                        if (multiEntryCheck(firstEntry, req.data[k]) && entryHeightCheck(preEntryHeight, req.data[k], diffHeight)) {
                            req.data[k]['entryLbl'] = firstEntry['entryLbl'];
                            req.data[k]["amount"] = firstEntry['amount'];
                            preEntryHeight = req.data[k];
                        }
                    }
                }
            }
            
            // Add single entry text
            req.data = sync.await(addEntryTextOfLabel(req.data, sync.defer()));        

            //예외처리 등록
            for(var j in req.data)
            {
                //납품용적
                if(req.data[j]["entryLbl"] == 767)
                {
                    if(req.data[j]["text"].indexOf(",") !== -1)
                    {
                        req.data[j]["text"] = req.data[j]["text"].replace(",","");
                    }

                    if(req.data[j]["text"].indexOf(".") == -1)
                    {
                        if(req.data[j]["text"].substring(req.data[j]["text"].length-3) == "000")
                        {
                            req.data[j]["text"] = req.data[j]["text"].substring(0, req.data[j]["text"].length-3) + "."+req.data[j]["text"].substring(req.data[j]["text"].length, req.data[j]["text"].length-3);
                        }
                        else if(req.data[j]["text"].substring(req.data[j]["text"].length-2) == "00")
                        {
                            req.data[j]["text"] = req.data[j]["text"].substring(0, req.data[j]["text"].length-2) + "."+req.data[j]["text"].substring(req.data[j]["text"].length, req.data[j]["text"].length-2);
                        }
                    }
                }

                //납품출발시간
                if(req.data[j]["entryLbl"] == 766)
                {
                    if(req.data[j]["text"].indexOf("도") !== -1)
                    {
                        req.data[j]["text"] = req.data[j]["text"].replace("도","");
                    }

                    if(req.data[j]["text"].replace( /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/g,"").length == 4)
                    {
                        req.data[j]["text"] = req.data[j]["text"].replace( /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/g,"");
                        req.data[j]["text"] = req.data[j]["text"].substring(0,2) + "시" + req.data[j]["text"].substring(2) + "분";
                    }
                }

                // 운반차순서
                if(req.data[j]["entryLbl"] == 792)
                {
                    
                    if(req.data[j]["text"].indexOf(".")!== -1)
                    {
                        req.data[j]["text"] = req.data[j]["text"].replace(".","");
                    }
                    if(req.data[j]["text"].indexOf("시")!== -1)
                    {
                        req.data[j]["text"] = req.data[j]["text"].replace("시","");
                    }
                    if(req.data[j]["text"].toLowerCase().indexOf("no") !== -1)
                    {
                        req.data[j]["text"] = req.data[j]["text"].toLowerCase().replace("no","");
                    }
                    
                }

                //누계
                if(req.data[j]["entryLbl"] == 768)
                {
                    if(req.data[j]["text"].indexOf(",") !== -1)
                    {
                        req.data[j]["text"] = req.data[j]["text"].replace(",","");
                    }

                    if(req.data[j]["text"].indexOf(".") == -1)
                    {
                        if(req.data[j]["text"].substring(req.data[j]["text"].length-3) == "000")
                        {
                            req.data[j]["text"] = req.data[j]["text"].substring(0, req.data[j]["text"].length-3) + "."+req.data[j]["text"].substring(req.data[j]["text"].length, req.data[j]["text"].length-3);
                        }
                        else if(req.data[j]["text"].substring(req.data[j]["text"].length-2) == "00")
                        {
                            req.data[j]["text"] = req.data[j]["text"].substring(0, req.data[j]["text"].length-2) + "."+req.data[j]["text"].substring(req.data[j]["text"].length, req.data[j]["text"].length-2);
                        }
                    }
                }

                //콘크리트
                if(req.data[j]["entryLbl"] == 769)
                {
                    if(req.data[j]["text"] == "콘크리트따른구분" || req.data[j]["text"] == "콘크리트보통따른구분/" || req.data[j]["text"] == "따른구분/보통콘크리트" || req.data[j]["text"] == "따른구분콘크리트" || req.data[j]["text"] == "따른구분보통콘크리트" )
                    {
                        req.data[j]["text"] = "보통콘크리트";
                    }
                    
                }

                //굵은굴재
                if(req.data[j]["entryLbl"] == 770)
                {
                    if((req.data[j]["text"].indexOf("시")!== -1) || (req.data[j]["text"].indexOf("시방")!== -1))
                    {
                        req.data[j]["text"] = req.data[j]["text"].replace( /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/g,"");
                    }
                    if(req.data[j]["text"].indexOf("mm") !== -1)
                    {
                        req.data[j]["text"] = req.data[j]["text"].replace("mm","");
                    }
                    
                }
                //호칭강도
                if(req.data[j]["entryLbl"] == 771)
                {
                    if(req.data[j]["text"] == "표18(g/" || req.data[j]["text"]=="표18(/" || req.data[j]["text"]=="118.표(g" || req.data[j]["text"]=="18(g")
                    {
                        req.data[j]["text"] = "18";
                    }

                    if(req.data[103]["text"].substring(req.data[103]["text"].length-1) == ".")
                    {
                        req.data[j]["text"] = req.data[j]["text"].substring(0,req.data[j]["text"].length-1 );
                    }
                    
                }
                //슬럼프 150()
                if(req.data[j]["entryLbl"] == 772)
                {
                    if(req.data[j]["text"].indexOf("mm") !== -1)
                    {
                        req.data[j]["text"] = req.data[j]["text"].replace("mm","");
                    }
                }

                //시멘트
                if(req.data[j]["entryLbl"] == 773)
                {
                    if(req.data[j]["text"] == "포틀랜드시멘트1종따른구분" || req.data[j]["text"] == "포들랜드시멘트1종따른구분" || req.data[j]["text"] == ")따른구분시멘트종류에포틀랜드시멘트1종" || req.data[j]["text"] == "시멘트종류에따른구분)포틀랜드시멘트1종" || req.data[j]["text"] == "따른구분포틀랜드시멘트종" )
                    {
                        req.data[j]["text"] = "포틀랜드시멘트1종";
                    }
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

function addEntryTextOfLabel(data, done) {
    sync.fiber(function () {
        try {           
            for (var i = 0; i < data.length; i++) {
                for (var j = 0; j < data.length; j++) {                   
                    if (i != j && data[i]["entryLbl"] && data[j]["entryLbl"] && data[i]["entryLbl"] == data[j]["entryLbl"]) {
                        var targetLoc = data[i]["location"].split(',');
                        var compareLoc = data[j]["location"].split(',');
                        if (data[i]["amount"] == "single" && data[j]["amount"] == "single") { // 싱글
                            if ((data[i]["entryLbl"] == "769" || data[i]["entryLbl"] == "773") &&
                                (Number(compareLoc[1]) - Number(targetLoc[1])) > 30) { // 콘크리트종류 or 시멘트 종류
                                // 붙여진 text 정보를 확인하기 위한 용도 (텍스트가 붙여지면 entryLbls로는 확인이 어려움)
                                if (data[i]["addItem"]) {
                                    data[i]["addItem"].push(JSON.parse(JSON.stringify(data[j])));
                                } else {
                                    data[i]["addItem"] = [JSON.parse(JSON.stringify(data[i])), JSON.parse(JSON.stringify(data[j]))];
                                    delete data[i]["entryLbls"];
                                }

                                // 텍스트와 위치 데이터 가공
                                data[i]["text"] = data[i]["text"] + data[j]["text"];
                                data[i]["location"] = targetLoc[0] + ',' + targetLoc[1]
                                    + ',' + (compareLoc[2])
                                    + ',' + (Number(targetLoc[3]) + Number(compareLoc[3]) + (Number(compareLoc[1]) - (Number(targetLoc[1]) + Number(targetLoc[3]))))

                                // 붙여진 text row 제거하고 배열 인덱스 한단계 전으로 돌아가서 현재 row 기준으로 다시 실행 
                                data.splice(j, 1);
                                i--;
                                break;
                            } else {
                                if (data[i]["addItem"]) {
                                    data[i]["addItem"].push(JSON.parse(JSON.stringify(data[j])));
                                } else {
                                    data[i]["addItem"] = [JSON.parse(JSON.stringify(data[i])), JSON.parse(JSON.stringify(data[j]))];
                                    delete data[i]["entryLbls"];
                                }

                                if (Number(targetLoc[0]) < Number(compareLoc[0])) {
                                    data[i]["text"] += data[j]["text"];
                                    data[i]["location"] = targetLoc[0] + ',' + targetLoc[1]
                                        + ',' + (Number(compareLoc[0]) + Number(compareLoc[2]) - Number(targetLoc[0]))
                                        + ',' + ((Number(targetLoc[3]) > Number(compareLoc[3])) ? targetLoc[3] : compareLoc[3])
                                } else {
                                    data[i]["text"] = data[j]["text"] + data[i]["text"];
                                    data[i]["location"] = compareLoc[0] + ',' + compareLoc[1]
                                        + ',' + (Number(targetLoc[0]) + Number(targetLoc[2]) - Number(compareLoc[0]))
                                        + ',' + ((Number(targetLoc[3]) > Number(compareLoc[3])) ? targetLoc[3] : compareLoc[3])
                                }       
                                data.splice(j, 1);
                                i--;
                                break;
                            }
                        } else if (data[i]["amount"] == "multi" && data[j]["amount"] == "multi") { // 멀티
                            var yGap = ((Number(targetLoc[1]) - Number(compareLoc[1])) > 0) ? (Number(targetLoc[1]) - Number(compareLoc[1])) : -(Number(targetLoc[1]) - Number(compareLoc[1]));

                            // 텍스트와 위치 데이터 가공                        
                            if (Number(targetLoc[0]) < Number(compareLoc[0]) && yGap < 7) {                               
                                // 붙여진 text 정보를 확인하기 위한 용도 (텍스트가 붙여지면 entryLbls로는 확인이 어려움)
                                if (data[i]["addItem"]) {
                                    data[i]["addItem"].push(JSON.parse(JSON.stringify(data[j])));
                                } else {
                                    data[i]["addItem"] = [JSON.parse(JSON.stringify(data[i])), JSON.parse(JSON.stringify(data[j]))];
                                    delete data[i]["entryLbls"];
                                }

                                data[i]["text"] += data[j]["text"];
                                data[i]["location"] = targetLoc[0] + ',' + targetLoc[1]
                                    + ',' + (Number(compareLoc[0]) + Number(compareLoc[2]) - Number(targetLoc[0]))
                                    + ',' + ((Number(targetLoc[3]) > Number(compareLoc[3])) ? targetLoc[3] : compareLoc[3])
                                data.splice(j, 1);
                                i--;
                                break;
                            }
                        } else if (data[i]["entryLbl"] == "760" || data[i]["entryLbl"] == "761" || data[i]["entryLbl"] == "502") {
                        } else {
                            if (data[i]["addItem"]) {
                                data[i]["addItem"].push(JSON.parse(JSON.stringify(data[j])));
                            } else {
                                data[i]["addItem"] = [JSON.parse(JSON.stringify(data[i])), JSON.parse(JSON.stringify(data[j]))];
                                delete data[i]["entryLbls"];
                            }

                            if (Number(targetLoc[0]) < Number(compareLoc[0])) {
                                data[i]["text"] += data[j]["text"];
                                data[i]["location"] = targetLoc[0] + ',' + targetLoc[1]
                                    + ',' + (Number(compareLoc[0]) + Number(compareLoc[2]) - Number(targetLoc[0]))
                                    + ',' + ((Number(targetLoc[3]) > Number(compareLoc[3])) ? targetLoc[3] : compareLoc[3])
                            } else {
                                data[i]["text"] = data[j]["text"] + data[i]["text"];
                                data[i]["location"] = compareLoc[0] + ',' + compareLoc[1]
                                    + ',' + (Number(targetLoc[0]) + Number(targetLoc[2]) - Number(compareLoc[0]))
                                    + ',' + ((Number(targetLoc[3]) > Number(compareLoc[3])) ? targetLoc[3] : compareLoc[3])
                            }
                            data.splice(j, 1);
                            i--;
                            break;
                        }                        
                    }
                }
            }
        } catch (e) {
            console.log(e);
        } finally {
            return done(null, data);
        }

    });
}

function entryHeightCheck(data1, data2, diffHeight) {
    var check = false;
    data1 = data1['location'].split(',');
    data2 = data2['location'].split(',');
    var res = parseInt(data2[1]) - parseInt(data1[1]);

    if (res < diffHeight) {
        check = true;
    }

    return check;
}

function multiEntryCheck(firstEntry, entry) {
    var check = false;
    var firstLoc = firstEntry['location'].split(',');
    var entryLoc = entry['location'].split(',');

    if (firstEntry['entryLbl'] == "504") {
        if (verticalCheck(firstLoc, entryLoc, 200, -300) && locationCheck(firstLoc[1], entryLoc[1], 0, -2000)) {
            check = true;
        }
    } else {
        if (verticalCheck(firstLoc, entryLoc, 100, -100) && locationCheck(firstLoc[1], entryLoc[1], 0, -2000)) {
            check = true;
        }
    }

    return check;
}

function verticalCheck(data1, data2, plus, minus) {
    var check = false;
    var dataWidthLoc1 = (parseInt(data1[0]) + parseInt(data1[0]) + parseInt(data1[2])) / 2;
    var dataWidthLoc2 = (parseInt(data2[0]) + parseInt(data2[0]) + parseInt(data2[2])) / 2;

    var res = dataWidthLoc1 - dataWidthLoc2;

    if (res < plus && res > minus) {
        check = true;
    }

    return check;
}

function locationCheck(data1, data2, plus, minus) {
    var res = parseInt(data1) - parseInt(data2);
    var check = false;
    if (res < plus && res > minus) {
        check = true;
    }

    return check;
}

// db 컬럼 정규식과 현재 타겟 text 비교
function isValid(list, cls, text) {
    for (var i in list) {
        if (list[i].SEQNUM == cls) {
            var reg = new RegExp(list[i].VALID);
            return reg.test(text);
        }
    }
    return false;
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
        upYLoc -= mapJson[docCategory.DOCTYPE][dbRowData.CLASS]['LU'][type].up,
            rightXLoc += mapJson[docCategory.DOCTYPE][dbRowData.CLASS]['LU'][type].right,
            downYLoc += mapJson[docCategory.DOCTYPE][dbRowData.CLASS]['LU'][type].down,
            leftXLoc -= mapJson[docCategory.DOCTYPE][dbRowData.CLASS]['LU'][type].left;
    } else {
        upYLoc -= mapJson['default']['LU'][type].up,
            rightXLoc += mapJson['default']['LU'][type].right,
            downYLoc += mapJson['default']['LU'][type].down,
            leftXLoc -= mapJson['default']['LU'][type].left;
    }
    var isLUCheck = (leftXLoc <= tgXLoc && tgXLoc <= rightXLoc) && (upYLoc <= tgYLoc && tgYLoc <= downYLoc);

    // 우하단 좌표를 기준으로 영역 계산
    var tgXLoc = Number(loc[0]) + Number(loc[2]), tgYLoc = Number(loc[1]) + Number(loc[3]);
    var dbXLoc = (type == 'L') ? Number(dbRowData.LOCATION_X.split(",")[0]) + Number(dbRowData.LOCATION_X.split(",")[1]) : Number(dbRowData.OCR_TEXT_X.split(",")[0]) + Number(dbRowData.OCR_TEXT_X.split(",")[1]);
    var dbYLoc = (type == 'L') ? Number(dbRowData.LOCATION_Y.split(",")[0]) + Number(dbRowData.LOCATION_Y.split(",")[1]) : Number(dbRowData.OCR_TEXT_Y.split(",")[0]) + Number(dbRowData.OCR_TEXT_Y.split(",")[1]);
    var upYLoc = dbYLoc, rightXLoc = dbXLoc, downYLoc = dbYLoc, leftXLoc = dbXLoc;

    if (mapJson[docCategory.DOCTYPE] && mapJson[docCategory.DOCTYPE][dbRowData.CLASS] && mapJson[docCategory.DOCTYPE][dbRowData.CLASS]['RD']
        && mapJson[docCategory.DOCTYPE][dbRowData.CLASS]['RD'][type]) {
        upYLoc -= mapJson[docCategory.DOCTYPE][dbRowData.CLASS]['RD'][type].up,
            rightXLoc += mapJson[docCategory.DOCTYPE][dbRowData.CLASS]['RD'][type].right,
            downYLoc += mapJson[docCategory.DOCTYPE][dbRowData.CLASS]['RD'][type].down,
            leftXLoc -= mapJson[docCategory.DOCTYPE][dbRowData.CLASS]['RD'][type].left;
    } else {
        upYLoc -= mapJson['default']['RD'][type].up,
            rightXLoc += mapJson['default']['RD'][type].right,
            downYLoc += mapJson['default']['RD'][type].down,
            leftXLoc -= mapJson['default']['RD'][type].left;
    }
    var isRDCheck = (leftXLoc <= tgXLoc && tgXLoc <= rightXLoc) && (upYLoc <= tgYLoc && tgYLoc <= downYLoc);

    return (isLUCheck || isRDCheck) ? true : false;
}

// function predictionColumn(docCategory, targetData, dbRowData, type) {
//     var loc = targetData.location.split(",");   
//     var dbXLoc = (type == 'L') ? Number(dbRowData.LOCATION_X.split(",")[0]) : Number(dbRowData.OCR_TEXT_X.split(",")[0]);
//     var dbYLoc = (type == 'L') ? Number(dbRowData.LOCATION_Y.split(",")[0]) : Number(dbRowData.OCR_TEXT_Y.split(",")[0]);

//     return (loc[0] == dbXLoc && loc[1] == dbYLoc);
// }
