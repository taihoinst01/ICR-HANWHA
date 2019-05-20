"use strict";
var progressId; // 프로그레스바 변수

$(function () {
    _init();
});

// 초기화
function _init() {
    $('.um_select select').stbDropdown(); // 검색 메뉴 드랍 초기화
    $('.batch_tbl_right_divBodyScroll').scrollTop(0).scrollLeft(0); // 스크롤 초기화
    datePickerEvent(); // datePicker 적용
    clickEventHandlers();
    selectDocTopType(); // 대메뉴 조회(docTopType)
}

// 버튼 이벤트 핸들러 함수 모음
function clickEventHandlers() {
    selectBtnClick();
    btnRetrainClick();
    btnSendClick();
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
                var params = {
                    'docTopType': data.docToptypeList[0].SEQNUM,
                    'startDate': $('#searchStartDate').val(),
                    'endDate': $('#searchEndDate').val(),
                    'processState': $('#processStateSelect').val()
                };

                selectBatchPoMlExport(params, true);
            }
        },
        error: function (err) {
            console.log(err);
            fn_alert('alert', 'ERROR');
            endProgressBar(progressId);
        }
    });
}

// 시작 및 종료날짜 datepicker 이벤트
function datePickerEvent() {
    //datepicker 한국어로 사용하기 위한 언어설정
    $.datepicker.setDefaults($.datepicker.regional['ko']);

    // Datepicker
    $(".datepicker").datepicker({
        showButtonPanel: true,
        dateFormat: "yy-mm-dd",
        onClose: function (selectedDate) {

            var eleId = $(this).attr("id");
            var optionName = "";

            if (eleId.indexOf("StartDate") > 0) {
                eleId = eleId.replace("StartDate", "EndDate");
                optionName = "minDate";
            } else {
                eleId = eleId.replace("EndDate", "StartDate");
                optionName = "maxDate";
            }

            $("#" + eleId).datepicker("option", optionName, selectedDate);
            $(".searchDate").find(".chkbox2").removeClass("on");
        }
    });
    $(".searchDate").schDate();

    // 1개월전 날짜 구하기 (searchStartDate)
    var startDate = getAddMonth(-1, "-");
    $("#searchStartDate").val(startDate);

    // 오늘날짜 구하기 (searchEndDate)
    var endDate = getNowDate("-");
    $("#searchEndDate").val(endDate);
};

// 문서양식 조회 버튼 click 이벤트
function selectBtnClick() {
    $('#btn_search').click(function () {
        var docTopType = $('#docTopTypeSelect').val();
        var startDate = $('#searchStartDate').val();
        var endDate = $('#searchEndDate').val();
        var processState = $('#processStateSelect').val();

        var params = {
            'docTopType': docTopType,
            'startDate': startDate,
            'endDate': endDate,
            'processState': processState
        };
        selectBatchPoMlExport(params, false);
    });
}

// 문서양식 데이터 조회 이벤트
function selectBatchPoMlExport(params, isInit) {
    
    $.ajax({
        url: '/docManagement/selectBatchPoMlExport',
        type: 'post',
        datatype: 'json',
        data: JSON.stringify(params),
        contentType: 'application/json; charset=UTF-8',
        beforeSend: function () {
            $('#progressMsgTitle').html("문서데이터 조회중...");
            if (!isInit) progressId = showProgressBar();
        },
        success: function (data) {
            console.log(data);
            appendDocTableHeader(data.docLabelList);
            appendMLData(data.docDataList);
            endProgressBar(progressId);
        },
        error: function (err) {
            console.log(err);
            fn_alert('alert', 'ERROR');
            endProgressBar(progressId);
        }
    });
}

// 문서양식에 따른 table 헤더 렌더링
function appendDocTableHeader(docLabelList) {
    $('#docTableColumn').empty();
    $('#docMlDataColGroup').empty();

    var headerColGroupHTML = '<colgroup>' +
	    '<col style="width:50px;">' +
        '<col style="width:270px;">' +
        '<col style="width:150px;">';
    var headerTheadHTML = '<thead>';
    headerTheadHTML += '<tr>';
    headerTheadHTML += '<th scope="row"><div class="checkbox-options mauto"><input type="checkbox" class="sta00_all" value="" id="listCheckAll" name="listCheckAll_before" /></div></th>';
    headerTheadHTML += '<th scope="row">파일명</th>';
    headerTheadHTML += '<th scope="row">날짜</th>';

    for (var i in docLabelList) {
        headerColGroupHTML += '<col style="width:180px;">';
        headerTheadHTML += '<th scope="row">' + docLabelList[i].KORNM + '</th>';
    }
    headerColGroupHTML += '</colgroup>';
    headerTheadHTML += '</tr>';
    headerTheadHTML += '</thead>';

    $('#docTableColumn').append(headerColGroupHTML + headerTheadHTML);
    $('#docMlDataColGroup').append(headerColGroupHTML.replace('<colgroup>', '').replace('</colgroup>', ''));

    // 헤더 체크박스 클릭 이벤트
    $('#listCheckAll').click(function () {
        if ($(this).is(":checked")) {
            $('input[name="listCheck"]').prop('checked', true);
        } else {
            $('input[name="listCheck"]').prop('checked', false);
        }
    });
}

// ML 데이터 table 렌더링
function appendMLData(docDataList) {
    $('#tbody_docList').empty();

    var totalHTML = '';
    for (var i in docDataList) {
        if (i == 300) break; // jhy
        var mlDataListHTML = '' +
        '<tr class="originalTr">' +
            '<td><div class="checkbox-options mauto"><input type="checkbox" class="sta00_all" value="" name="listCheck" /></div></td>' +
            '<td>' +
		        '<a href="#" title="양식" onclick="openImagePop(\'' + docDataList[i].FILENAME + '\')">' +
            '<input type="text" value="' + docDataList[i].FILENAME.substring(docDataList[i].FILENAME.lastIndexOf('/') + 1) + '" class="inputst_box03_15radius" data-originalvalue="' + docDataList[i].FILENAME + '" disabled>' +
		        '</a>' +
            '</td>' + 
            '<td><input type="text" value="' + docDataList[i].AUTOSENDTIME + '" class="inputst_box03_15radius" data-originalvalue="' + docDataList[i].AUTOSENDTIME + '" disabled></td>';
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

//이미지 팝업 이벤트
function openImagePop(fileName) {
    var convertFilePath = fileName.split('.pdf')[0] + '-0.jpg';
    $('#PopupImg').attr('src', convertFilePath.replace(/\/uploads/,'/img'));
    layer_open('docPop');
    return false;
}

//재학습 버튼 click 이벤트
function btnRetrainClick() {
    $('#btn_retrain').click(function () {
        if ($('input[name="listCheck"]:checked').length == 1) {
            var fileName = $('input[name="listCheck"]:checked').closest('td').next().find('input[type="text"]').val();
            location.href = '/uiLearning?fileName=' + fileName;
            //layer_open('retrainPop');
        } else {
            fn_alert('alert', '하나의 파일을 선택하세요.');
        }
    });
}

// 전송 버튼 click 이벤트
function btnSendClick() {
    $('#btn_send').click(function () {

    });
}