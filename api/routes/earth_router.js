/**
 * Created by lenovo on 2017/4/19.
 */
(function () {

    'use strict';

    var earth_module = require('./../modules/earth_module.js');


    module.exports = function (server, BASEPATH) {
        /**
         * 获取json格式的data 信息
         */
        server.get({
            path: BASEPATH + '/earthdata/earth/:procbname',
            version: '0.0.1'
        }, earth_module._getearthjson);
    }

})
();