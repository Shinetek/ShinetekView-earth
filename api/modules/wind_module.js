/**
 * Created by lenovo on 2017/4/19.
 * 风场数据 信息 获取函数
 */
(function () {
    'use strict';
    var fs = require("fs");
    var path = require("path");
    var m_config = require("../config.json");

    /**
     * 获取风场数据 json
     * @param req
     * @param res
     * @param next
     * @private
     */
    var _getwindjson = function (req, res, next) {
        //获取参数配置
        var m_date = req.params.date;
        // var m_procbname = req.params.prodname;

        //todo 暂时使用 定值的json数据测试返回
        //本地目录
        var m_LOCALPATH = (path.resolve(path.resolve('.') + '/data/wind/'));
        //判断为配置目录是否合法
        var m_WIND_FILEPATH = m_config.WIND_FILEPATH ? m_config.WIND_FILEPATH : m_LOCALPATH;
        var m_procbname = "current-wind-surface-level-gfs-1.0.json";


        //正确性校验
        if (m_procbname.toString().indexOf('json') > 0 && m_date != undefined) {
            //todo 修改路径查找匹配
            var m_path = (path.resolve(path.resolve('.') + '/data/wind/' + m_procbname));
            var data = fs.readFileSync(m_path);
            res.end(data);
            next();
        }
        else {
            // res.statusCode("404");

            res.send(404);
            res.end("参数配置错误");
            next();
        }
    };
    exports._getwindjson = _getwindjson;


    //获取风场数据存在列表
    var _getwinddatalist = function (req, res, next) {
        //获取参数配置
        var m_date = req.params.date;
        // var m_procbname = req.params.prodname;

        //todo 暂时使用 定值的json数据测试返回
        //本地目录
        var m_LOCALPATH = (path.resolve(path.resolve('.') + '/data/wind/'));
        //判断为配置目录是否合法
        var m_WIND_FILEPATH = m_config.WIND_FILEPATH ? m_config.WIND_FILEPATH : m_LOCALPATH;
        //正确性校验
        if (m_date != undefined) {
            var m_filelist = fs.readdirSync(m_WIND_FILEPATH);
            var datalist = [];
            m_filelist.forEach(function (m_jsondata) {
                if (m_jsondata.toString().indexOf('json') > 0 && m_jsondata.length == 90) {
                    var m_date = m_jsondata.substr(44, 29);
                    datalist.push(m_date);
                }
            });
            res.end(JSON.stringify(datalist));
            next();
        }
        else {
            // res.statusCode("404");

            res.send(404);
            res.end("参数配置错误");
            next();
        }
    };
    exports._getwinddatalist = _getwinddatalist;

})();