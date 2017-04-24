/**
 * Created by lenovo on 2017/4/19.
 * 风场数据 信息 获取函数
 */
(function () {
    'use strict';
    var fs = require("fs");
    var path = require("path");

    /**
     * 获取风场数据 json
     * @param req
     * @param res
     * @param next
     * @private
     */
    var _getwindjson = function (req, res, next) {
        // console.log("_getwindjson");
        var m_date = req.params.date;
        //todo 暂时使用 定值的json数据测试返回
        //var m_procbname = req.params.procbname;
        var m_procbname = "current-wind-surface-level-gfs-1.0.json";
        if (m_procbname.toString().indexOf('json') > 0 && m_date != undefined) {
            var m_path = (path.resolve(path.resolve('.') + '/data/wind/' + m_procbname));
            //  console.log(m_path);
            var data = fs.readFileSync(m_path);
            //  console.log(path.resolve(__dirname + '../data/wind/'));
            res.end(data);
            next();
        }
        else {
            // res.statusCode("404");
            res.end("404");
            next();
        }
    };
    exports._getwindjson = _getwindjson;
})();