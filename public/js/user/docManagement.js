"use strict";
var progressId;

$(function () {
    _init();
});

// 초기화
function _init() {
    $('.um_select select').stbDropdown();
    $('.batch_tbl_right_divBodyScroll').scrollTop(0).scrollLeft(0);
    selectDocTopType();
    selectBtnClick();
    //docTopTypeSelectOptionClick();
}

// 문서양식 조회 및 select box 렌더링
function selectDocTopType() {
    $.ajax({
        url: '/docManagement/selectDocTopType',
        type: 'post',
        datatype: 'json',
        data: null,
        contentType: 'application/json; charset=UTF-8',
        beforeSend: function () {
            $('#progressMsgTitle').html("초기화 중..");
            progressId = showProgressBar();
        },
        success: function (data) {
            var optionHTML = '';
            for (var i in data.docToptypeList) {
                optionHTML += '<option value="' + data.docToptypeList[i].SEQNUM + '">' + data.docToptypeList[i].KORNM + '</option>';
            }
            $('#docTopTypeSelect').append(optionHTML);
            if (data.docToptypeList.length > 0) {
                $('#docTopTypeSelect').prev().text(data.docToptypeList[0].KORNM);
                selectBatchPoMlExport(data.docToptypeList[0].SEQNUM, true);
            }
            //endProgressBar(progressId);
        },
        error: function (err) {
            console.log(err);
        }
    });
}

// 문서양식 조회 버튼 click 이벤트
function selectBtnClick() {
    $('#btn_search').click(function () {
        selectBatchPoMlExport($('#docTopTypeSelect').val(), false);
    });
}

// 문서양식 데이터 조회 이벤트
function selectBatchPoMlExport(docTopType, isInit) {
    
    $.ajax({
        url: '/docManagement/selectBatchPoMlExport',
        type: 'post',
        datatype: 'json',
        data: JSON.stringify({ 'docTopType': docTopType}),
        contentType: 'application/json; charset=UTF-8',
        beforeSend: function () {
            $('#progressMsgTitle').html("문서데이터 조회중...");
            if (!isInit) progressId = showProgressBar();
        },
        success: function (data) {
            //console.log(data);
            appendDocTableHeader(data.docLabelList);
            appendMLData(data.docDataList);
            endProgressBar(progressId);
        },
        error: function (err) {
            console.log(err);
        }
    });
}

// 문서양식에 따른 table 헤더 렌더링
function appendDocTableHeader(docLabelList) {
    $('#docTableColumn').empty();

    var headerColGroupHTML = '<colgroup>' +
	'<col style="width:50px;">' +
        '<col style="width:210px;">';
    var headerTheadHTML = '<thead>';
    headerTheadHTML += '<tr>';
    headerTheadHTML += '<th scope="row"><div class="checkbox-options mauto"><input type="checkbox" class="sta00_all" value="" id="listCheckAll_before" name="listCheckAll_before" /></div></th>';
    headerTheadHTML += '<th scope="row">파일명</th>';

    for (var i in docLabelList) {
        headerColGroupHTML += '<col style="width:180px;">';
        headerTheadHTML += '<th scope="row">' + docLabelList[i].KORNM + '</th>';
    }
    headerColGroupHTML += '</colgroup>';
    headerTheadHTML += '</tr>';
    headerTheadHTML += '</thead>';

    $('#docTableColumn').append(headerColGroupHTML + headerTheadHTML);
    $('#docMlDataColGroup').append(headerColGroupHTML.replace('<colgroup>', '').replace('</colgroup>', ''));
}

// ML 데이터 table 렌더링
function appendMLData(docDataList) {
    $('#tbody_docList').empty();

    var totalHTML = '';
    for (var i in docDataList) {
        if (i == 10) break; // jhy
        var mlDataListHTML = '' +
        '<tr class="originalTr" data-seq="">' +
            '<td><div class="checkbox-options mauto"><input type="checkbox" class="sta00_all" value="" id="listCheckAll_before" name="listCheckAll_before" /></div></td>' +
            '<td>' +
		        '<a href="#" title="양식" onclick="layer_open(\'docPop\'); return false;">' +
            '<input type="text" value="' + docDataList[i].FILENAME + '" class="inputst_box03_15radius" data-originalvalue="' + docDataList[i].FILENAME + '">' +
		        '</a>' +
            '</td>';
        var items = docDataList[i].EXPORTDATA;
        items = items.replace(/\"/gi, '').slice(1, -1);
        items = items.split(',');
        for (var j in items) {
            if (items[j] == 'null') {
                mlDataListHTML += '<td><input type="text" value="" class="inputst_box03_15radius" data-originalvalue=""></td>';
            } else {
                mlDataListHTML += '<td><input type="text" value="' + items[j] + '" class="inputst_box03_15radius" data-originalvalue="' + items[j] + '"></td>';
            }
        }
        mlDataListHTML += '</tr>';
        totalHTML += mlDataListHTML;
    }
    $('#tbody_docList').append(totalHTML);
}

/*
// 문서양식 select option click 이벤트
function docTopTypeSelectOptionClick() {
    $('#docTopTypeSelect').change(function () {
        selectBatchPoMlExport(this.value, false);
    });
}
*/
