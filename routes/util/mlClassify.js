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
                    var ocrText =  ocrData[j].originText;
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
            /*
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
                        }
                    }
                }
            }
            console.log(req.data);
            var docScore = parseInt(retData["docCategory"].DOCSCORE * 100);
            // docTopTypeParam = 58 레미콘
            if(docTopTypeParam==58 && docScore > 50)
            {
                var departureTimeList=[];
                var concreteTypeList=[];
                var cementeTypeList=[];
                var deliveryLocList=[];
                var companyNameList=[];
                var totalDeliveryVolList=[];
                var deliveryVolList=[];
                for(var j in req.data)
                {
                    // delete req.data[j].colLbl;

                    var departureTimeData={};
                    var concreteTypeData={};
                    var cementeTypeData={};
                    var deliveryLocData={};
                    var companyNameData={};
                    var totalDeliveryVolData={};
                    var deliveryVolData={};

                    // concreteTypeData["loc"] = "478,1507,53,40";
                    // concreteTypeData["text"] = "고";
                    // concreteTypeList.push(concreteTypeData);
                    if(req.data[j]["entryLbl"] == 769)
                    {
                        concreteTypeData["loc"] = req.data[j].location;
                        concreteTypeData["text"] = req.data[j].text.replace("법","").replace("호","");
                        concreteTypeList.push(concreteTypeData);
                    }
                    else if(req.data[j]["entryLbl"] == 765)
                    {
                        if(req.data[j].text == "호")
                        {
                            delete req.data[j].entryLbl;
                            req.data[j]["colLbl"] = -1;
                        }
                        if(req.data[j].text.substring(0,1) == "호")
                        {
                            req.data[j].text = req.data[j].text.substring(1,req.data[j].text.length);
                        }
                    } 
                    else if(req.data[j]["entryLbl"] == 764)
                    {
                        deliveryLocData["loc"] = req.data[j].location;
                        deliveryLocData["text"] = req.data[j].text;
                        deliveryLocList.push(deliveryLocData);
                    }
                    else if(req.data[j]["entryLbl"] == 773)
                    {
                        cementeTypeData["loc"] = req.data[j].location;
                        cementeTypeData["text"] = req.data[j].text;
                        cementeTypeList.push(cementeTypeData);
                    }
                    else if(req.data[j]["entryLbl"] == 760)
                    {
                        companyNameData["loc"] = req.data[j].location;
                        companyNameData["text"] = req.data[j].text;
                        companyNameList.push(companyNameData);
                    }                       
                    else if(req.data[j]["entryLbl"] == 762 || req.data[j]["entryLbl"] == 764)
                    {
                        if(req.data[j].text == "소" ||req.data[j].text == "소 :")
                        {
                            delete req.data[j].entryLbl;
                            req.data[j]["colLbl"] = -1;
                        }

                        if(req.data[j].text.substring(0,1) == "소")
                        {
                            req.data[j].text = req.data[j].text.substring(1,req.data[j].text.length);
                        }
                        
                    }
                    else if(req.data[j]["entryLbl"] == 767)
                    {
                        req.data[j].text = req.data[j].text.replace("-",".");

                        deliveryVolData["loc"] = req.data[j].location;
                        deliveryVolData["text"] = req.data[j].text;
                        deliveryVolList.push(deliveryVolData);
                    }
                    else if(req.data[j]["entryLbl"] == 768)
                    {
                        req.data[j].text = req.data[j].text.replace("-",".");

                        totalDeliveryVolData["loc"] = req.data[j].location;
                        totalDeliveryVolData["text"] = req.data[j].text;
                        totalDeliveryVolList.push(totalDeliveryVolData);
                    }
                    else if(req.data[j]["entryLbl"] == 766)
                    {   
                        if(req.data[j]["text"] != "시")
                        {
                            if(req.data[j]["text"] != "분")
                            {
                                if(req.data[j]["text"].indexOf("시") == -1 )
                                {
                                    if(req.data[j]["text"].indexOf("분") == -1)
                                    {
                                        departureTimeData["loc"] = req.data[j].location;
                                        departureTimeData["text"] = req.data[j].text;
                                        departureTimeList.push(departureTimeData);
                                    }
                                    else
                                    {
                                        departureTimeData["loc"] = req.data[j].location;
                                        departureTimeData["text"] = req.data[j].text.replace("분","");
                                        departureTimeList.push(departureTimeData);
                                    }
                                }
                                else
                                {
                                    
                                    if(req.data[j]["text"].indexOf("분") == -1)
                                    {
                                        departureTimeData["loc"] = req.data[j].location;
                                        departureTimeData["text"] = req.data[j].text;
                                        departureTimeList.push(departureTimeData);
                                    }
                                    else 
                                    {
                                        //시02분 들어왔을때 예외처리
                                        departureTimeData["loc"] = req.data[j].location;
                                        departureTimeData["text"] = req.data[j].text.replace("시","").replace("분","");
                                        departureTimeList.push(departureTimeData);
                                    }
                                }
                            }
                        }
                        else
                        {                            
                            if (req.data[j]["text"].indexOf("분") == -1)
                            {
                                //console.log(req.data[j]);
                                departureTimeData["loc"] = req.data[j].location;
                                departureTimeData["text"] = req.data[j].text;
                                departureTimeList.push(departureTimeData);
                            }
                        }
                    }
                }


                var departureTime ="";
                var concreteType ="";
                var cementeType ="";
                var deliveryLoc ="";
                var companyName ="";
                var totalDeliveryVol ="";
                var deliveryVol ="";
                //콘크리트의 종류에 따른 구분이 두줄로 나올때 or 한줄에 나눠서 출력될때 정렬해서 출력
                if(concreteTypeList.length != 1) {
                    if(concreteTypeList[1].loc.split(",")[1] - concreteTypeList[0].loc.split(",")[1] > 20) {
                        concreteTypeList.sort(function(a,b)
                        {
                            return Number(a.loc.split(",")[1]) - Number(b.loc.split(",")[1]);
                        });
                    } else {
                        concreteTypeList.sort(function(a,b)
                        {
                            return Number(a.loc.split(",")[0]) - Number(b.loc.split(",")[0]);
                        });
                    }
                }
                
                
                cementeTypeList.sort(function(a,b)
                {
                    console.log(a.loc.split(",")[0]);
                    console.log(b.loc.split(",")[0]);
                    return Number(a.loc.split(",")[0]) - Number(b.loc.split(",")[0]);
                });

                companyNameList.sort(function(a,b)
                {
                    console.log(a.loc.split(",")[0]);
                    console.log(b.loc.split(",")[0]);
                    return Number(a.loc.split(",")[0]) - Number(b.loc.split(",")[0]);
                });

                deliveryVolList.sort(function(a,b)
                {
                    console.log(a.loc.split(",")[0]);
                    console.log(b.loc.split(",")[0]);
                    return Number(a.loc.split(",")[0]) - Number(b.loc.split(",")[0]);
                });

                totalDeliveryVolList.sort(function(a,b)
                {
                    console.log(a.loc.split(",")[0]);
                    console.log(b.loc.split(",")[0]);
                    return Number(a.loc.split(",")[0]) - Number(b.loc.split(",")[0]);
                });

                if(deliveryLocList.length > 1)
                {
                    for(var i in deliveryLocList)
                    {
                        if(Number(deliveryLocList[0].loc.split(",")[0]) < (Number(deliveryLocList[1].loc.split(",")[0])))
                        {
                            deliveryLoc = deliveryLocList[0].text + " " + deliveryLocList[1].text ;
                        }
                        else if(Number(deliveryLocList[0].loc.split(",")[0]) > (Number(deliveryLocList[1].loc.split(",")[0])))
                        {
                            deliveryLoc = deliveryLocList[1].text + " " + deliveryLocList[0].text ;
                        }
                    }
                    var deliveryLocCnt = 0;
                    for(var l in req.data)
                    {
                        if(req.data[l]["entryLbl"] == 764)
                        {
                            req.data[l]["text"] = deliveryLoc;
                            if(deliveryLocCnt > 0)
                            {
                                delete req.data[l].entryLbl;
                                req.data[l]["colLbl"] = -1;
                            }
                            deliveryLocCnt++;
                        }
                    }
                }

                if(concreteTypeList.length > 0)                
                {
                    for(var i in concreteTypeList)
                    {
                        concreteType +=concreteTypeList[i].text;
                    }
                
                    if(concreteType == "물자")
                    {
                        concreteType = "물차";
                    }
                    if(concreteType == "콘크리트보통" || concreteType == "콘크리트" || concreteType == "콘크리트보")
                    {
                        concreteType = "보통콘크리트";
                    }
                }

                var cnt = 0;
                for(var l in req.data)
                {
                    if(req.data[l]["entryLbl"] == 769)
                    {
                        req.data[l]["text"] = concreteType;
                        if(cnt > 0)
                        {
                            delete req.data[l].entryLbl;
                            req.data[l]["colLbl"] = -1;
                        }
                        cnt++;
                    }
                }

                if(companyNameList.length > 0)                
                {
                    for(var i in companyNameList)
                    {
                        companyName +=companyNameList[i].text;
                    }

                    var cnt = 0;
                    for(var l in req.data)
                    {
                        if(req.data[l]["entryLbl"] == 760)
                        {
                            req.data[l]["text"] = companyName;
                            if(cnt > 0)
                            {
                                delete req.data[l].entryLbl;
                                req.data[l]["colLbl"] = -1;
                            }
                            cnt++;
                        }
                    }
                }
                
                if(cementeTypeList.length > 0)                
                {
                    for(var i in cementeTypeList)
                    {
                        cementeType +=cementeTypeList[i].text;
                    }

                    var cnt = 0;
                    for(var l in req.data)
                    {
                        if(req.data[l]["entryLbl"] == 773)
                        {
                            req.data[l]["text"] = cementeType;
                            if(cnt > 0)
                            {
                                delete req.data[l].entryLbl;
                                req.data[l]["colLbl"] = -1;
                            }
                            cnt++;
                        }
                    }
                }

                if(departureTimeList.length > 1)
                {
                    // departureTimeList.length == 3일때 출발시간 출력이 안됨
                    for(var kk in departureTimeList) 
                    {
                        if(departureTimeList[kk].text == "도" || departureTimeList[kk].text == " 도"){
                            departureTimeList.splice(kk,1)
                        }
                    }
                    if(departureTimeList.length == 2)
                    {
                        departureTimeList[0].text = departureTimeList[0].text.replace("시","");
                        departureTimeList[0].text = departureTimeList[0].text.replace("분","");
                        departureTimeList[1].text = departureTimeList[1].text.replace("시","");
                        departureTimeList[1].text = departureTimeList[1].text.replace("분","");
                        if(Number(departureTimeList[0].loc.split(",")[0]) < (Number(departureTimeList[1].loc.split(",")[0])))
                        {
                            departureTime = departureTimeList[0].text + "시" + departureTimeList[1].text + "분" ;
                        }
                        else
                        {
                            departureTime = departureTimeList[1].text + "시" + departureTimeList[0].text + "분" ;
                        }
                    }
                    if(departureTime.indexOf("분") == -1)
                    {
                        departureTime = departureTime + "분";
                    }
                    if(departureTime.indexOf("도") != -1)
                    {
                        departureTime = departureTime.replace("도","");
                    }
                    var cnt = 0;
                    for(var l in req.data)
                    {
                        if(req.data[l]["entryLbl"] == 766)
                        {
                            req.data[l]["text"] = departureTime;
                            if(cnt > 0)
                            {
                                delete req.data[l].entryLbl;
                                req.data[l]["colLbl"] = -1;
                            }
                            cnt++;
                        }
                    }
                }
                else if(departureTimeList.length == 1)
                {
                    if(departureTimeList[0].text.indexOf("시") != -1 && departureTimeList[0].text.indexOf("분") == -1)
                    {
                        departureTime = departureTimeList[0].text + "분";
                    }
                    else if(departureTimeList[0].text.indexOf("시") == -1 && departureTimeList[0].text.indexOf("분") == -1)
                    {
                        departureTime = departureTimeList[0].text.replace(" ","시") + "분";
                    }
                }
                var cnt = 0;
                for(var l in req.data)
                {
                    if(req.data[l]["entryLbl"] == 766)
                    {
                        if(departureTime.length > 0 )
                        {
                            req.data[l]["text"] = departureTime;
                            if(cnt > 0)
                            {
                                delete req.data[l].entryLbl;
                                req.data[l]["colLbl"] = -1;
                            }
                            cnt++;
                        }
                    }
                }
                // 납품용적
                if(deliveryVolList.length > 0)                
                {
                    for(var i in deliveryVolList)
                    {
                        deliveryVol +=deliveryVolList[i].text;
                    }

                    var cnt = 0;
                    for(var l in req.data)
                    {
                        if(req.data[l]["entryLbl"] == 767)
                        {
                            req.data[l]["text"] = deliveryVol;
                            if(cnt > 0)
                            {
                                delete req.data[l].entryLbl;
                                req.data[l]["colLbl"] = -1;
                            }
                            cnt++;
                        }
                    }
                }
                // 누계
                if(totalDeliveryVolList.length > 0)                
                {
                    for(var i in totalDeliveryVolList)
                    {
                        totalDeliveryVol +=totalDeliveryVolList[i].text;
                    }

                    var cnt = 0;
                    for(var l in req.data)
                    {
                        if(req.data[l]["entryLbl"] == 768)
                        {
                            req.data[l]["text"] = totalDeliveryVol;
                            if(cnt > 0)
                            {
                                delete req.data[l].entryLbl;
                                req.data[l]["colLbl"] = -1;
                            }
                            cnt++;
                        }
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
