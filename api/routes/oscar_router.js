/**
 * Created by liuyp on 2017/4/25.
 * oscar 数据获取的url
 */

(function () {

    'use strict';

    var oscar_module = require('./../modules/oscar_module.js');


    module.exports = function (server, BASEPATH) {
        /**
         * 获取json格式的data 信息
         */
        server.get({
            path: BASEPATH + '/earthdata/oscar/:date/:level/:prodname',
            version: '0.0.1'
        }, oscar_module._getoscarjson);


        /**
         * 获取json格式的data 信息
         */
        server.get({
            path: BASEPATH + '/earthdata/oscar-datalist/:date/',
            version: '0.0.1'
        }, oscar_module._getoscardatalist);
    }

})();