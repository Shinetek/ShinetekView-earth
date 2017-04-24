/**
 * Created by lenovo on 2017/4/19.
 */
/**
 * dev-server - serves static resources for developing "earth" locally
 */

"use strict";

console.log("============================================================");
//node端打印
console.log(new Date().toISOString() + " - Starting");


var util = require("util");

/**
 * Returns true if the response should be compressed.
 * 返回true  如果响应需要压缩？
 */
function compressionFilter(req, res) {
    return (/json|text|javascript|font/).test(res.getHeader('Content-Type'));
}

/**
 * Adds headers to a response to enable caching.
 * 增加头（headers）用于启用 高速缓存 响应。
 */
function cacheControl() {
    return function (req, res, next) {
        res.setHeader("Cache-Control", "public, max-age=300");
        return next();
    };
}
/**
 * 记录日志函数 调用 express logger 模块 -- 修改为 morgan
 * @returns {*}
 */
function logger() {
    morgan.token("date", function () {
        return new Date().toISOString();
    });
    morgan.token("response-all", function (req, res) {
        return (res._header ? res._header : "").trim();
    });
    morgan.token("request-all", function (req, res) {
        return util.inspect(req.headers);
    });
    return morgan(
        ':date - info: :remote-addr :req[cf-connecting-ip] :req[cf-ipcountry] :method :url HTTP/:http-version ' +
        '":user-agent" :referrer :req[cf-ray] :req[accept-encoding]\\n:request-all\\n\\n:response-all\\n');
}

//端口使用 node 的参数 2 node dev-server.js 8080
var port = process.argv[2] || 8888;
var express = require("express");
var app = express();
var morgan = require('morgan');
var path = require("path");

app.use(cacheControl());

var compression = require('compression');
app.use(compression());

app.use(compression({filter: compressionFilter}));
app.use(logger());
//将静态数据定位到 public 文件夹
//app.use(express.static(__dirname + '/public'));//设置静态文件目录
app.use(express.static(__dirname + '/public'));
//开启监听
app.listen(port);
//cmd 打印监听信息
console.log("Listening on port " + port + "...");
