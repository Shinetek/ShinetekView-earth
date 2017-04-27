/**
 * Created by lenovo on 2017/4/19.
 */
/**
 * Created by liuym on 2017/1/22.
 */
(function () {
    var restify = require('restify');

    //根据传入参数 启动node 若未启动 则使用8889作为ip
    var port = (process.argv[2]) ? process.argv[2] : 8889;
    //端口号校验
    var dateReg = /[0-9]{4,5}/;
    //对端口进行校验
    if (!dateReg.test(port)) {
        port = 8889;
    }

    var server = restify.createServer({
        name: 'earth_api'
    });
    /*   server.use(restify.queryParser());
     server.use(restify.CORS());*/

    server.use(restify.queryParser());
    server.use(restify.bodyParser());
    server.use(restify.CORS());
    /*
     server.use(
     function crossOrigin(req, res, next) {
     'use strict';
     res.header("Access-Control-Allow-Origin", "*");
     res.header("Access-Control-Allow-Headers", "X-Requested-With");
     return next();
     });
     */
    var BASEPATH = "/api";

    /**
     *风场数据
     **/
    require('./routes/wind_router.js')(server, BASEPATH);

    //洋流数据
    require('./routes/oscar_router.js')(server, BASEPATH);
    //地球数据
    require('./routes/earth_router.js')(server, BASEPATH);


    server.listen(port, function () {
        console.log('%s listening at %s ', server.name, server.url);
    });


})();