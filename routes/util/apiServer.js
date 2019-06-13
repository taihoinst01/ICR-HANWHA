'use strict';

var bodyParser = require('body-parser');
var express = require('express');
var app = express();
var oracle = require('./oracle.js');
var sync = require('./sync.js');

app.use(bodyParser.json());

// app.use(function (req, res, next) {
//     //Enabling CORS 
//     res.header("Access-Control-Allow-Origin", "*");
//     res.header("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS,POST,PUT");
//     res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, contentType,Content-Type, Accept, Authorization");
//     next();
// });

//Setting up server
var server = app.listen(process.env.PORT || 5000, function () {
    var port = server.address().port;
    console.log("ApiServer now running on port", port);
 });

/********************************************************************************************************
                                           ApiServer
 *******************************************************************************************************/
app.use(bodyParser.urlencoded({extended:true}));
app.use(bodyParser.json());

//POST API
app.post("/return", function(req , res){
    sync.fiber(function () {
        console.log("API SERVER CALL RETURN");
        
        // console.log(req.body.data);
        // console.log(req.body.data.length);

        if(req.body.data.length > 0)
        {
            for(var i = 0; i < req.body.data.length; i++)
            {
                console.log(req.body.data[i]);
            

                if(!req.body.data[i].fileName){
                    console.log("fileName is required");
                    return res.status(400).send({
                        result: 'F',
                        errMsg: 'fileName is required'
                    });
                }else if (!req.body.data[i].sequence){
                    console.log("sequence is required");
                    return res.status(400).send({
                        result: 'F',
                        errMsg: 'sequence is required'
                    });
                }
                else
                {   
                    var fileNm = "";
                    fileNm = req.body.data[i].fileName.split("/")[req.body.data[i].fileName.split("/").length-1];
                    // console.log(req.body.data[i].fileName.split("/").length);
                    console.log(fileNm);
                    fileNm = fileNm.split(".")[0].substring(0, fileNm.split(".")[0].length-2)+".pdf";
                    console.log(fileNm);

                    var retData = sync.await(oracle.getFtpFileList(fileNm, req.body.data[i].sequence, sync.defer()));
                    console.log(retData);
                    if(retData.length < 1)
                    {
                        return res.status(400).send({
                            result: 'F',
                            errMsg: 'False DATA'
                        });
                    }
                    else
                    {
                        var result = sync.await(oracle.updateFtpFileList(fileNm, req.body.data[i].sequence,req.body.data[i].bigo, sync.defer()));
                        console.log(result);
                        if(result = 1)
                        {
                            return res.status(200).send({
                                result: 'S',
                                errMsg: 'receive successfully'
                            });
                        }
                        else{
                            console.log(result);
                        }
                    }
                }

            }
        }
        else
        {
            return res.status(400).send({
                result: 'false',
                errMsg: 'No DATA'
            });
        }
        
        // else
        // {
        //     var retData = sync.await(oracle.getFtpFileList(req.body.fileName, req.body.filePath,req.body.seq, sync.defer()));
        //     if(retData.length < 1)
        //     {
        //         return res.status(400).send({
        //             success: 'false',
        //             message: 'No DATA'
        //           });
        //     }
        //     else
        //     {
        //         var result = sync.await(oracle.updateFtpFileList(req.body.fileName, req.body.filePath,req.body.seq, sync.defer()));
        //         console.log(result);
        //         if(result = 1)
        //         {
        //             return res.status(200).send({
        //                 success: 'true',
        //                 message: 'receive successfully'
        //               });
        //         }
        //         else{
        //             console.log(result);
        //         }
        //     }
        // }
    });
});

module.exports = app;
