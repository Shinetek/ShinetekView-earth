/**
 * Created by lenovo on 2017/4/25.
 *
 * 分析经过转化的js 查看 数据中的极值
 */


'use strict';
function testFind() {

    var m_Data = [];
    var m_MaxNum = 344 * 344;

    var m_LonLatList = [];
    var m_lonmin = 0;
    var m_lonmax = 360;
    var m_latMin = 0;
    var m_latMax = 180;

    for (let i = 0; i < m_MaxNum; i++) {
        var m_lon = Math.random() * m_lonmax;
        var m_lat = Math.random() * m_latMax;
        var m_Vector = [m_lon, m_lat, [0.2, 0.4]];
        m_Data.push(m_Vector);
    }
//console.log(m_Data);
    var m_Loat = [180, 30];

    var m_Date = new Date();
    var interpolate = inverseDistanceWeighting(m_Data, 4);
    var rresult = interpolate(180, 30, [1, 1]);
    var m_Time = new Date() - m_Date;
    console.log(m_Time);
    console.log("over!");
    console.log(rresult);
    function inverseDistanceWeighting(points, k) {
        var tree = kdTree(points, 2, 0);
        var temp = [];
        var nearestNeighbors = [];
        //4 个最近的 点
        for (var i = 0; i < k; i++) {
            nearestNeighbors.push({});
        }

        function clear() {
            for (var i = 0; i < k; i++) {
                var n = nearestNeighbors[i];
                n.point = null;
                n.distance2 = Infinity;
            }
        }

        // Return a function that interpolates a vector for the point (x, y) and stores it in "result".
        //返回一个function
        return function (x, y, result) {
            var weightSum = 0;

            clear();  // reset our scratch objects
            temp[0] = x;
            temp[1] = y;

            nearest(temp, tree, nearestNeighbors);  // calculate nearest neighbors
            console.log(nearestNeighbors);

            // Sum up the values at each nearest neighbor, adjusted by the inverse square of the distance.
            for (var i = 0; i < k; i++) {
                var neighbor = nearestNeighbors[i];
                var sample = neighbor.point[2];
                var d2 = neighbor.distance2;
                if (d2 === 0) {  // (x, y) is exactly on top of a point.
                    result[0] = sample[0];
                    result[1] = sample[1];
                    return result;
                }
                var weight = 1 / d2;
                temp[0] = sample[0];
                temp[1] = sample[1];
                result = addVectors(result, scaleVector(temp, weight));
                weightSum += weight;
            }

            // Divide by the total weight to calculate an average, which is our interpolated result.
            return scaleVector(result, 1 / weightSum);
        }
    }

    /**
     * Builds a k-d tree from the specified points, each point of the form [x, y, ...]
     * 使用 k-tree 初始化
     */
    function kdTree(points, k, depth) {
        if (points.length == 0) {
            return null;
        }
        var axis = depth % k;  // cycle through each axis as we descend downwards
        var compareByAxis = function (a, b) {
            return a[axis] - b[axis];
        }
        points.sort(compareByAxis);

        // Pivot on the median point using the policy that all points to the left must be _strictly smaller_.
        var median = Math.floor(points.length / 2);
        var node = points[median];
        // Scan backwards for points aligned on the same axis. We want the start of any such sequence.
        while (median > 0 && compareByAxis(node, points[median - 1]) === 0) {
            node = points[--median];
        }

        node.left = kdTree(points.slice(0, median), k, depth + 1);
        node.right = kdTree(points.slice(median + 1), k, depth + 1);

        // Provide a function that easily calculates a point's distance to the partitioning plane of this node.
        var plane = node[axis];
        node.planeDistance = function (p) {
            return plane - p[axis];
        };

        return node;
    }


    /**
     * Finds the neighbors nearest to the specified point, starting the search at the k-d tree provided as 'node'.
     * The n closest neighbors are placed in the results array (of length n) in no defined order.
     */
    function nearest(point, node, results) {
        // This recursive function descends the k-d tree, visiting partitions containing the desired point.
        // As it descends, it keeps a priority queue of the closest neighbors found. Each visited node is
        // compared against the worst (i.e., most distant) neighbor in the queue, replacing it if the current
        // node is closer. The queue is implemented as a binary heap so the worst neighbor is always the
        // element at the top of the queue.

        // Calculate distance of the point to the plane this node uses to split the search space.
        var planeDistance = node.planeDistance(point);

        var containingSide;
        var otherSide;
        if (planeDistance <= 0) {
            // point is contained in the right partition of the current node.
            containingSide = node.right;
            otherSide = node.left;
        }
        else {
            // point is contained in the left partition of the current node.
            containingSide = node.left;
            otherSide = node.right;
        }

        if (containingSide) {
            // Search the containing partition for neighbors.
            nearest(point, containingSide, results);
        }

        // Now determine if the current node is a close neighbor. Do the comparison using _squared_ distance to
        // avoid unnecessary Math.sqrt operations.
        var d2 = dist2(point[0], point[1], node[0], node[1]);
        var n = results[0];
        if (d2 < n.distance2) {
            // Current node is closer than the worst neighbor encountered so far, so replace it and adjust the queue.
            n.point = node;
            n.distance2 = d2;
            heapify(results, n);
        }

        if (otherSide) {
            // The other partition *might* have relevant neighbors if the point is closer to the partition plane
            // than the worst neighbor encountered so far. If so, descend down the other side.
            if ((planeDistance * planeDistance) < results[0].distance2) {
                nearest(point, otherSide, results);
            }
        }
    }


    /**
     * Multiply the vector v (in rectangular [x, y] form) by the scalar s, in place, and return it.
     */
    function scaleVector(v, s) {
        v[0] *= s;
        v[1] *= s;
        return v;
    }


    /**
     * Returns the square of the distance between the two specified points x0, y0 and x1, y1.
     */
    function dist2(x0, y0, x1, y1) {
        var Δx = x0 - x1;
        var Δy = y0 - y1;
        return Δx * Δx + Δy * Δy;
    }


    /**
     * Given array a, representing a binary heap, this method pushes the key down from the top of the heap. After
     * invocation, the key having the largest "distance2" value is at the top of the heap.
     */
    function heapify(a, key) {
        var i = 0;
        var length = a.length;
        var child;
        while ((child = i * 2 + 1) < length) {
            var favorite = a[child];
            var right = child + 1;
            var r;
            if (right < length && (r = a[right]).distance2 > favorite.distance2) {
                favorite = r;
                child = right;
            }
            if (key.distance2 >= favorite.distance2) {
                break;
            }
            a[i] = favorite;
            i = child;
        }
        a[i] = key;
    }

    /**
     * Add the second vector into the first and return it. Both vectors must be in rectangular [x, y] form.
     */
    function addVectors(a, b) {
        a[0] += b[0];
        a[1] += b[1];
        return a;
    }
}
var fs = require("fs");
var m_json1 = "../../api/data/wind/20170419231000/AHI8-_AGRI--_N_DISK_1407E_L2-_AMV-_C018_NUL_20170419231000_20170419232000_064KM_V0001.json";
var m_json = "../../api/data/wind/u_v_current-wind-surface-level-gfs-1.0.json";


var param = {};
param.require_path = m_json;
var m_product = product(param);


function product(param) {
    var require_path = param.require_path;

    var init = function () {
        BasicLoad(require_path);
        /*  testVData(require_path);
         testUData(require_path);*/
        SpeedAnay(require_path);
    };

    var BasicLoad = function (require_path) {
        console.log("=============基础信息==============");

        var m_Json = require(require_path);
        var m_Header = m_Json[1].header;

        var params = {};

        params.refTime = m_Header.refTime;
        params.nx = m_Header.nx;
        params.ny = m_Header.ny;

        params.lo1 = m_Header.lo1;
        params.la1 = m_Header.la1;
        params.lo2 = m_Header.lo2;
        params.la2 = m_Header.la2;
        params.dx = m_Header.dx;
        params.dy = m_Header.dy;
        console.log(params);
        var m_DataNum = m_Header.nx * m_Header.ny;
        console.log("总数：" + m_Header.nx + " * " + m_Header.ny + " = " + m_DataNum);
    };


//测试载入速度数据
    function testVData(require_path) {
        console.log("=============V_Data==============");
        var m_Json = require(require_path);
        var m_Header = m_Json[1].header;
        var nx = m_Header.nx;
        var Δλ = m_Header.dx, Δφ = m_Header.dy;
        var m_Data = m_Json[1].data;
        var m_Min = 300;
        var m_Max = 0;
        var m_Min_i = 0;
        var m_Max_i = 0;
        var m_unNull_Num = 0;
        for (let i = 0; i < m_Data.length; i++) {
            //计算非空值
            if (m_Data[i] == null) {
                continue;
            }
            else {
                m_unNull_Num++;
            }

            //计算 最大值 最小值
            if (m_Data[i] > m_Max) {
                m_Max = m_Data[i];
                m_Max_i = i;
            } else if (m_Data[i] < m_Min) {
                m_Min = m_Data[i];
                m_Min_i = i;
            }
        }
        var m_PreSent = m_unNull_Num / m_Data.length * 100;


        console.log("非空值的总数:" + m_unNull_Num + "/" + m_Data.length + "  \n有效值百分比：  " + m_PreSent + "%");
        //计算最大值经纬度
        var m_MaxLon = m_Max_i % nx * Δλ;
        var m_MaxLat = Math.floor(m_Max_i / nx) * Δφ;
        console.log("最大值:" + m_Max + ",最大值位置" + m_Max_i);
        console.log("最大值经纬度:" + m_MaxLon + "," + m_MaxLat);
        //计算最大值经纬度
        var m_MinLon = m_Min_i % nx * Δλ;
        var m_MinLat = Math.floor(m_Min_i / nx) * Δφ;
        console.log("最小值:" + m_Min + ",最小值位置" + m_Min_i);
        console.log("最小值经纬度:" + m_MinLon + "," + m_MinLat);

    }

//测试 方向
    function testUData(require_path) {
        console.log("=============U_Data==============");
        var m_Json = require(require_path);
        var m_Header = m_Json[0].header;
        var nx = m_Header.nx, ny = m_Header.ny;
        var Δλ = m_Header.dx, Δφ = m_Header.dy;
        var m_Data = m_Json[0].data;
        var m_Min = 300;
        var m_Max = 0;
        var m_Min_i = 0;
        var m_Max_i = 0;
        var m_unNull_Num = 0;
        var m_0Num = 0;
        var m_90Num = 0;
        var m_180Num = 0;
        var m_270Num = 0;
        var m_90NumOnly = 0;
        for (let i = 0; i < m_Data.length; i++) {
            //计算非空值
            if (m_Data[i] == null) {
                continue;
            }
            else {
                m_unNull_Num++;
            }
            if (m_Data[i] < -5) {
                m_0Num++;
            }
            if (m_Data[i] >= -5 && m_Data[i] < 0) {
                m_90Num++;
            }
            if (m_Data[i] >= 0 && m_Data[i] < 5) {
                m_180Num++;
            }
            if (m_Data[i] >= 5) {
                m_270Num++;
            }
            //计算 最大值 最小值
            if (m_Data[i] > m_Max) {
                m_Max = m_Data[i];
                m_Max_i = i;
            } else if (m_Data[i] < m_Min) {
                m_Min = m_Data[i];
                m_Min_i = i;
            }
        }
        var m_PreSent = m_unNull_Num / m_Data.length * 100;
        console.log("方向分布范围: ~-10：-10~0：0~10：10~");
        console.log("方向分布比例:" + m_0Num + ":" + m_90Num + ":" + m_180Num + ":" + m_270Num);
        console.log("非空值的总数:" + m_unNull_Num + "/" + m_Data.length + "  \n有效值百分比：  " + m_PreSent + "%");
        //计算最大值经纬度
        var m_MaxLon = m_Max_i % nx * Δλ;
        var m_MaxLat = Math.floor(m_Max_i / nx) * Δφ;
        console.log("最大值:" + m_Max + ",最大值位置" + m_Max_i);
        console.log("最大值经纬度:" + m_MaxLon + "," + m_MaxLat);
        //计算最大值经纬度
        var m_MinLon = m_Min_i % nx * Δλ;
        var m_MinLat = Math.floor(m_Min_i / nx) * Δφ;
        console.log("最小值:" + m_Min + ",最小值位置" + m_Min_i);
        console.log("最小值经纬度:" + m_MinLon + "," + m_MinLat);
    }

    function SpeedAnay(require_path) {
        var m_Json = require(require_path);
        var m_UData = m_Json[0].data;
        var m_VData = m_Json[1].data;
        var m_length = m_UData.length;
        var m_Min = 1000;
        var m_Max = 0;
        for (var i = 0; i < m_length; i++) {
            if (m_UData[i] && m_VData[i]) {
                var m_Speed = Math.sqrt(m_UData[i] * m_UData[i] + m_VData[i] * m_VData[i]);
                if (m_Min > m_Speed) {
                    m_Min = m_Speed;
                }
                if (m_Max < m_Speed) {
                    m_Max = m_Speed;
                }
            }
        }
        console.log("max:" + m_Max);
        console.log("min:" + m_Min);
    }


    init();

    return this;
}





