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
        
        if(!req.body.fileName){
            console.log("fileName is required");
            return res.status(400).send({
                success: 'false',
                message: 'fileName is required'
              });
        }else if (!req.body.filePath){
            console.log("filePath is required");
            return res.status(400).send({
                success: 'false',
                message: 'filePath is required'
              });
        }else if(!req.body.seq){
            console.log("SEQ is required");
            return res.status(400).send({
                success: 'false',
                message: 'SEQ is required'
              });
        }
        else
        {
            var retData = sync.await(oracle.getFtpFileList(req.body.fileName, req.body.filePath,req.body.seq, sync.defer()));
            if(retData.length < 1)
            {
                return res.status(400).send({
                    success: 'false',
                    message: 'No DATA'
                  });
            }
            else
            {
                var result = sync.await(oracle.updateFtpFileList(req.body.fileName, req.body.filePath,req.body.seq, sync.defer()));
                console.log(result);
                if(result = 1)
                {
                    return res.status(200).send({
                        success: 'true',
                        message: 'receive successfully'
                      });
                }
                else{
                    console.log(result);
                }
            }
        }
    });
});

module.exports = app;