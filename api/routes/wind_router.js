/**
 * Created by lenovo on 2017/4/19.
 * 风场数据获取data 的 api 路由
 */
(function () {

    'use strict';

    var wind_module = require('./../modules/wind_module.js');


    module.exports = function (server, BASEPATH) {
        /**
         * 获取json格式的data 信息
         */
        server.get({
            path: BASEPATH + '/earthdata/wind/:date/:procbname',
            version: '0.0.1'
        }, wind_module._getwindjson);
    }

})
();