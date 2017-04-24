/**
 * Created by lenovo on 2017/4/19.
 * 一些地球的基本数据 进行返回
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
    var _getearthjson = function (req, res, next) {
        console.log("_getwindjson");
        var m_date = req.params.procbname;
        //todo 暂时使用 定值的json数据测试返回
        //var m_procbname = req.params.procbname;
        var m_procbname = "earth-topo.json";
        var m_path = (path.resolve(path.resolve('.') + '/data/earth/' + m_procbname));
        console.log(m_path);
        if (m_procbname.toString().indexOf('json') > 0 && m_date != undefined) {
            if (fs.existsSync(m_path)) {
                var data = fs.readFileSync(m_path);
                //  console.log(path.resolve(__dirname + '../data/wind/'));
                res.end(data);
                next();
            }
            else {
                res.writeHead(404);
                res.end();
                next();
            }
        }
        else {
            res.writeHead(404);
            res.end();
            next();
        }
    };
    exports._getearthjson = _getearthjson;
})();