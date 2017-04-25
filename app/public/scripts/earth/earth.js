/**
 * earth - a project to visualize global air data.
 *
 * Copyright (c) 2014 Cameron Beccario
 * The MIT License - http://opensource.org/licenses/MIT
 *
 * https://github.com/cambecc/earth
 */
(function () {
    "use strict";

    /**
     *   以下大写字母为全局静态变量  基本为数值 且一般不会改变
     */

    var SECOND = 1000;
    var MINUTE = 60 * SECOND;
    var HOUR = 60 * MINUTE;
    var MAX_TASK_TIME = 100;                  // amount of time before a task yields control (millis) 任务控制延迟时间？？ todo
    var MIN_SLEEP_TIME = 25;                  // amount of time a task waits before resuming (millis) 最小等待时间？？ todo
    var MIN_MOVE = 4;                         // slack before a drag operation beings (pixels) 最小拖动位移？
    var MOVE_END_WAIT = 1000;                 // time to wait for a move operation to be considered done (millis) 拖动位移后等待时间

    var OVERLAY_ALPHA = Math.floor(0.4 * 255);  // overlay transparency (on scale [0, 255]) 覆盖透明度 102在0-255的范围内
    var INTENSITY_SCALE_STEP = 10;            // step size of particle intensity color scale  比例尺颜色间隔
    var MAX_PARTICLE_AGE = 20;               // max number of frames a particle is drawn before regeneration  最大粒子间隔 100？todo
    var PARTICLE_LINE_WIDTH = 1.0;            // line width of a drawn particle
    var PARTICLE_MULTIPLIER = 10;              // particle count scalar (completely arbitrary--this values looks nice) 粒子个数
    var PARTICLE_REDUCTION = 0.75;            // reduce particle count to this much of normal for mobile devices
    var FRAME_RATE = 20;                      // desired milliseconds per frame 每一帧的刷新毫秒数

    var NULL_WIND_VECTOR = [NaN, NaN, null];  // singleton for undefined location outside the vector field [u, v, mag] 空的风场向量  [u.v, mag]
    var HOLE_VECTOR = [NaN, NaN, null];       // singleton that signifies a hole in the vector field 空的hole向量
    var TRANSPARENT_BLACK = [0, 0, 0, 0];     // singleton 0 rgba 空的颜色 模板
    var REMAINING = "▫▫▫▫▫▫▫▫▫▫▫▫▫▫▫▫▫▫▫▫▫▫";   // glyphs for remaining progress bar 待实现进度条 用于等待显示
    var COMPLETED = "▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪";   // glyphs for completed progress bar 已完成进度条 用于等待显示

    var view = µ.view();                        //u 为 micro 导出的变量  view 为返回窗口信息的 函数  return {width: x, height: y} 屏幕显示宽高
    var log = µ.log();                          // 为 micro 导出的变量 log 为返回日志记录的函数 return 带格式的json日志。

    /**
     * An object to display various types of messages to the user.
     * 一个 function类型的 var 用于给用户显示各种信息 return 一个带格式的json json中显示信息数据
     */
    var report = function () {
        var s = d3.select("#status"), p = d3.select("#progress"), total = REMAINING.length;
        return {
            status: function (msg) {
                return s.classed("bad") ? s : s.text(msg);  // errors are sticky until reset
            },
            error: function (err) {
                var msg = err.status ? err.status + " " + err.message : err;
                switch (err.status) {
                    case -1:
                        msg = "Server Down";
                        break;
                    case 404:
                        msg = "No Data";
                        break;
                }
                log.error(err);
                return s.classed("bad", true).text(msg);
            },
            reset: function () {
                return s.classed("bad", false).text("");
            },
            progress: function (amount) {  // amount of progress to report in the range [0, 1]
                if (0 <= amount && amount < 1) {
                    var i = Math.ceil(amount * total);
                    var bar = COMPLETED.substr(0, i) + REMAINING.substr(0, total - i);
                    return p.classed("invisible", false).text(bar);
                }
                return p.classed("invisible", true).text("");  // progress complete
            }
        };
    }();

    /**
     * newAgent 新用户 用法待查 todo 默认返回错误？？
     * @returns {*|undefined}
     */
    function newAgent() {
        return µ.newAgent().on({"reject": report.error, "fail": report.error});
    }

    // Construct the page's main internal components:
    //构造页面所需要的主要内部组件  小写字母标识

    var configuration =
        µ.buildConfiguration(globes, products.overlayTypes);  // holds the page's current configuration settings 保存当前页面配置
    var inputController = buildInputController();             // interprets drag/zoom operations
    var meshAgent = newAgent();      // map data for the earth 地球的 基本 map 数据  地理信息？？
    var globeAgent = newAgent();     // the model of the globe 地球模型
    var gridAgent = newAgent();      // the grid of weather data 气象数据网格？
    var rendererAgent = newAgent();  // the globe SVG renderer 全球svg形式的边界
    var fieldAgent = newAgent();     // the interpolated wind vector field 差值的风矢量场
    var animatorAgent = newAgent();  // the wind animator 风场动画
    var overlayAgent = newAgent();   // color overlay over the animation 在动画上叠加的颜色层

    /**
     * The input controller is an object that translates move operations (drag and/or zoom) into mutations of the
     * current globe's projection, and emits events so other page components can react to these move operations.
     *
     * 这个输入控制器 是一个用户获取用户操作（例如拖拽或者缩放），并将用户操作转化为对应当期头型类型的动作响应。 并发出事件，使得页面的各个
     * 组件对用户操作进行正确的对应的位移响应。
     *
     * D3's built-in Zoom behavior is used to bind to the document's drag/zoom events, and the input controller
     * interprets D3's events as move operations on the globe. This method is complicated due to the complex
     * event behavior that occurs during drag and zoom.
     *
     * D3控件 内部通过建立基于文档的 drag zoom事件来实现zoom的动作相应。 此输入控制器将D3的事件解析为 基于全球的移动操作。
     * 因为在用户进行drag和zoom操作时，需要进行复杂的event事件响应。故提供此方法。
     *
     * D3 move operations usually occur as "zoomstart" -> ("zoom")* -> "zoomend" event chain. During "zoom" events
     * the scale and mouse may change, implying a zoom or drag operation accordingly. These operations are quite
     * noisy. What should otherwise be one smooth continuous zoom is usually comprised of several "zoomstart" ->
     * "zoom" -> "zoomend" event chains. A debouncer is used to eliminate the noise by waiting a short period of
     * time to ensure the user has finished the move operation.
     *
     * 大概翻译一下····
     * D3的移动事件 被定义为 zoomstart-> （zoom）* ->zoomend 这样的一个事件推移链。（zome* 表示zoom可能有很多个？）
     * 但是由于在基于地图服务的zoom事件中，同时还可能会发生比例尺（scale）和鼠标（mouse）的移动，如果立刻对zoom或者多drag的事件进行响应执行（implying）
     * 这些操作会有很琐碎且nosiy（很多次应用zoom且抖动）。在实际的预期中 ，一个平滑的zoom操作应该由 "zoomstart" -> "zoom" -> "zoomend" 这样的一个事件链条组成。
     * 程序中使用等待一个很短的时间片段来确保用户已经完成移动操作，来对这上述这种情况进行防反跳（debouncer--这个词翻译的怪怪的）
     *
     * The "zoom" events may not occur; a simple click operation occurs as: "zoomstart" -> "zoomend". There is
     * additional logic for other corner cases, such as spurious drags which move the globe just a few pixels
     * (most likely unintentional), and the tendency for some touch devices to issue events out of order:
     * "zoom" -> "zoomstart" -> "zoomend".
     *
     * zoom事件也许在事件链中不被触发，例如一个简单的点击操作，触发的事件链如下："zoomstart" -> "zoomend"
     * 有一些额外的逻辑对于这些特殊的触发事件进行处理。例如：当多动和位移事件只执行了很小的像素偏移（很大可能是由于用户意外操作，而并不是真正的想对地图进行拖动。）
     * 并对一些触屏设备的事件链也许会是以下顺序："zoom" -> "zoomstart" -> "zoomend".（todo 触屏这部分没看懂orz）
     *
     * This object emits clean "moveStart" -> ("move")* -> "moveEnd" events for move operations, and "click" events
     * for normal clicks. Spurious moves emit no events.
     * 以下函数定义清晰的 "moveStart" -> ("move")* -> "moveEnd" events 为移动操作进行实现。
     * 同样定义click 为普通的点击进行操作。
     * 不符合实际的移动，不触发任何事件。
     */
    function buildInputController() {
        var globe, op = null;

        /**
         * @returns {Object} an object to represent the state for one move operation.
         * 返回 一个移动操作状态的代表 Object json 使用 manipulator定义move和end函数
         */
        function newOp(startMouse, startScale) {
            return {
                type: "click",  // initially assumed to be a click operation 初始化为点击操作
                startMouse: startMouse,
                startScale: startScale,
                manipulator: globe.manipulator(startMouse, startScale) //返回但钱鼠标位置和比例尺下的move和end函数事件。基于当前配置的投影等信息。
            };
        }

        //对 D3 的 zoom 事件进行监听
        var zoom = d3.behavior.zoom()
            .on("zoomstart", function () {
                //对op进行赋值 如果初始化为null 如果已经有值，则直接使用
                op = op || newOp(d3.mouse(this), zoom.scale());  // a new operation begins
            })
            .on("zoom", function () {
                //zoom 函数
                //获取当前鼠标状态 获取当前比例尺状态
                var currentMouse = d3.mouse(this), currentScale = d3.event.scale;
                //修复某些浏览器中 不触发 zoomstart 或者zoomstart 顺序不在zoom之前的情况
                op = op || newOp(currentMouse, 1);  // Fix bug on some browsers where zoomstart fires out of order.
                //判断 操作类型 需要先进行点击判断
                //如果有drag 则会再次触发次函数 此时再使用 MIN_MOVE 对其进行排除 直到drag的范围超过设置 才对type赋值drag 并触发相应tigger
                if (op.type === "click" || op.type === "spurious") {
                    //计算鼠标位移长度
                    var distanceMoved = µ.distance(currentMouse, op.startMouse);
                    //判断是否只进行了位移操作，且位移长度大于设置范围
                    if (currentScale === op.startScale && distanceMoved < MIN_MOVE) {
                        // to reduce annoyance, ignore op if mouse has barely moved and no zoom is occurring
                        //如果鼠标几乎未进行移动 或者 未进行zoom操作。则重新根据distanceMoved 判断 type 并返回 不触发tigger
                        op.type = distanceMoved > 0 ? "click" : "spurious";
                        return;
                    }
                    //当位移终于足够长的时候  触发 moveStart 事件 并将当前鼠标模式修改为 drag 拖拽
                    //下次移动前不会在进入这个循环 （不会再次赋值为click或者spurious ）
                    dispatch.trigger("moveStart");
                    op.type = "drag";
                }
                //如果对scale进行了改变 则type为zoom （会对上述的drag 进行覆盖赋值）
                if (currentScale != op.startScale) {
                    op.type = "zoom";  // whenever a scale change is detected, (stickily) switch to a zoom operation
                }

                // when zooming, ignore whatever the mouse is doing--really cleans up behavior on touch devices
                //当zoom的时候，不考虑鼠标的其他操作····直接进行move
                op.manipulator.move(op.type === "zoom" ? null : currentMouse, currentScale);
                dispatch.trigger("move");
            })
            .on("zoomend", function () {
                //事件结束函数
                op.manipulator.end();
                //如果未click 则执行对应事件
                if (op.type === "click") {
                    dispatch.trigger("click", op.startMouse, globe.projection.invert(op.startMouse) || []);
                }
                else if (op.type !== "spurious") {
                    signalEnd();
                }
                //重新对op进行赋值 为下一次操作事件进行初始化
                op = null;  // the drag/zoom/click operation is over
            });

        //debounce (超时） 在 超时后执行
        var signalEnd = _.debounce(function () {
            //当进入抖动状态 spurious 的时候  经过一段时间，确定用户已经不再进行移动后
            if (!op || op.type !== "drag" && op.type !== "zoom") {
                //保存对应配置
                configuration.save({orientation: globe.orientation()}, {source: "moveEnd"});
                //触发 moveEnd 事件
                dispatch.trigger("moveEnd");
            }
        }, MOVE_END_WAIT);  // wait for a bit to decide if user has stopped moving the globe 等待一段时间 时间使用最前面配置的全局变量

        // display 将 zoom 事件 绑定到display 上
        d3.select("#display").call(zoom);


        //再适应 函数
        function reorient() {
            //参数？？arguments
            var options = arguments[3] || {};
            if (!globe || options.source === "moveEnd") {
                // reorientation occurred because the user just finished a move operation, so globe is already
                // oriented correctly.
                return;
            }
            //触发 moveStart 函数
            dispatch.trigger("moveStart");
            //从配置中再次获取 投影方式 重新对投影方式进行定义
            globe.orientation(configuration.get("orientation"), view);
            //重新对 缩放范围进行 计算
            zoom.scale(globe.projection.scale());
            //触发 moveEnd 函数
            dispatch.trigger("moveEnd");
        }

        //使用 Backbone 对 event 进行监听
        var dispatch = _.extend({
            globe: function (_) {
                if (_) {
                    globe = _;
                    zoom.scaleExtent(globe.scaleExtent());
                    reorient();
                }
                return _ ? this : globe;
            }
        }, Backbone.Events);

        //返回一个对 configuration 的监听 一旦有数据变动 则进行重新载入事件  reorient
        return dispatch.listenTo(configuration, "change:orientation", reorient);
    }

    /**
     * @param resource the GeoJSON resource's URL
     * @returns {Object} a promise for GeoJSON topology features: {boundaryLo:, boundaryHi:}
     * 建立 mesh 图层事件 载入地理边界
     */
    function buildMesh(resource) {
        var cancel = this.cancel;
        report.status("Downloading...");
        //载入顶层 地理边界图像
        return µ.loadJson(resource).then(function (topo) {
            if (cancel.requested) return null;
            log.time("building meshes");
            var o = topo.objects;
            //根据当前是否为手机版本 分别返回 四个版本的 大洋 和湖泊
            var coastLo = topojson.feature(topo, µ.isMobile() ? o.coastline_tiny : o.coastline_110m);
            var coastHi = topojson.feature(topo, µ.isMobile() ? o.coastline_110m : o.coastline_50m);
            var lakesLo = topojson.feature(topo, µ.isMobile() ? o.lakes_tiny : o.lakes_110m);
            var lakesHi = topojson.feature(topo, µ.isMobile() ? o.lakes_110m : o.lakes_50m);
            log.timeEnd("building meshes");
            return {
                coastLo: coastLo,
                coastHi: coastHi,
                lakesLo: lakesLo,
                lakesHi: lakesHi
            };
        });
    }

    /**
     * @param {String} projectionName the desired projection's name.
     * @returns {Object} a promise for a globe object.
     * 构建 buildGlobe 返回一个 promise 为 globe
     */
    function buildGlobe(projectionName) {
        var builder = globes.get(projectionName);
        if (!builder) {
            return when.reject("Unknown projection: " + projectionName);
        }
        return when(builder(view));
    }

    // Some hacky stuff to ensure only one download can be in progress at a time.
    var downloadsInProgress = 0;

    //建立 grid
    function buildGrids() {
        report.status("Downloading...");
        log.time("build grids");
        // UNDONE: upon failure to load a product, the unloaded product should still be stored in the agent.
        //         this allows us to use the product for navigation and other state.
        var cancel = this.cancel;
        downloadsInProgress++;
        //载入风场数据
        var loaded = when.map(products.productsFor(configuration.attributes), function (product) {
            return product.load(cancel);
        });
        return when.all(loaded).then(function (products) {
            log.time("build grids");
            return {primaryGrid: products[0], overlayGrid: products[1] || products[0]};
        }).ensure(function () {
            downloadsInProgress--;
        });
    }

    /**
     * Modifies the configuration to navigate to the chronologically next or previous data layer.
     */
    function navigate(step) {
        if (downloadsInProgress > 0) {
            log.debug("Download in progress--ignoring nav request.");
            return;
        }
        var next = gridAgent.value().primaryGrid.navigate(step);
        if (next) {
            configuration.save(µ.dateToConfig(next));
        }
    }

    function buildRenderer(mesh, globe) {
        if (!mesh || !globe) return null;

        report.status("Rendering Globe...");
        log.time("rendering map");

        // UNDONE: better way to do the following?
        var dispatch = _.clone(Backbone.Events);
        if (rendererAgent._previous) {
            rendererAgent._previous.stopListening();
        }
        rendererAgent._previous = dispatch;

        // First clear map and foreground svg contents.
        µ.removeChildren(d3.select("#map").node());
        µ.removeChildren(d3.select("#foreground").node());
        // Create new map svg elements.
        globe.defineMap(d3.select("#map"), d3.select("#foreground"));

        var path = d3.geo.path().projection(globe.projection).pointRadius(7);
        var coastline = d3.select(".coastline");
        var lakes = d3.select(".lakes");
        d3.selectAll("path").attr("d", path);  // do an initial draw -- fixes issue with safari

        function drawLocationMark(point, coord) {
            // show the location on the map if defined
            if (fieldAgent.value() && !fieldAgent.value().isInsideBoundary(point[0], point[1])) {
                // UNDONE: Sometimes this is invoked on an old, released field, because new one has not been
                //         built yet, causing the mark to not get drawn.
                return;  // outside the field boundary, so ignore.
            }
            if (coord && _.isFinite(coord[0]) && _.isFinite(coord[1])) {
                var mark = d3.select(".location-mark");
                if (!mark.node()) {
                    mark = d3.select("#foreground").append("path").attr("class", "location-mark");
                }
                mark.datum({type: "Point", coordinates: coord}).attr("d", path);
            }
        }

        // Draw the location mark if one is currently visible.
        if (activeLocation.point && activeLocation.coord) {
            drawLocationMark(activeLocation.point, activeLocation.coord);
        }

        // Throttled draw method helps with slow devices that would get overwhelmed by too many redraw events.
        var REDRAW_WAIT = 5;  // milliseconds
        var doDraw_throttled = _.throttle(doDraw, REDRAW_WAIT, {leading: false});

        function doDraw() {
            d3.selectAll("path").attr("d", path);
            rendererAgent.trigger("redraw");
            doDraw_throttled = _.throttle(doDraw, REDRAW_WAIT, {leading: false});
        }

        // Attach to map rendering events on input controller.
        dispatch.listenTo(
            inputController, {
                moveStart: function () {
                    coastline.datum(mesh.coastLo);
                    lakes.datum(mesh.lakesLo);
                    rendererAgent.trigger("start");
                },
                move: function () {
                    doDraw_throttled();
                },
                moveEnd: function () {
                    coastline.datum(mesh.coastHi);
                    lakes.datum(mesh.lakesHi);
                    d3.selectAll("path").attr("d", path);
                    rendererAgent.trigger("render");
                },
                click: drawLocationMark
            });

        // Finally, inject the globe model into the input controller. Do it on the next event turn to ensure
        // renderer is fully set up before events start flowing.
        when(true).then(function () {
            inputController.globe(globe);
        });

        log.timeEnd("rendering map");
        return "ready";
    }

    //创建mask
    function createMask(globe) {
        //如果参数不存在才则报错
        if (!globe) return null;

        log.time("render mask");

        // Create a detached canvas, ask the model to define the mask polygon, then fill with an opaque color.
        // 创建一个独立的画布, 要求模型定义掩码多边形, 然后用不透明的颜色填充。
        //宽高设置为全屏幕
        var width = view.width, height = view.height;
        //设置D3 的绘图控件 canvas
        var canvas = d3.select(document.createElement("canvas")).attr("width", width).attr("height", height).node();
        var context = globe.defineMask(canvas.getContext("2d"));
        //背景底色
        context.fillStyle = "rgba(0, 0, 0, 1)";
        context.fill();
        d3.select("#display").node().appendChild(canvas);  // make mask visible for debugging

        var imageData = context.getImageData(0, 0, width, height);
        var data = imageData.data;  // layout: [r, g, b, a, r, g, b, a, ...]
        log.timeEnd("render mask");
        return {
            imageData: imageData,
            isVisible: function (x, y) {
                var i = (y * width + x) * 4;
                return data[i + 3] > 0;
                // non-zero alpha means pixel is visible
            },
            set: function (x, y, rgba) {
                var i = (y * width + x) * 4;
                data[i] = rgba[0];
                data[i + 1] = rgba[1];
                data[i + 2] = rgba[2];
                data[i + 3] = rgba[3];
                return this;
            }
        };
    }

    function createField(columns, bounds, mask) {

        /**
         * @returns {Array} wind vector [u, v, magnitude] at the point (x, y), or [NaN, NaN, null] if wind
         *          is undefined at that point.
         */
        function field(x, y) {
            var column = columns[Math.round(x)];
            var m_return = column && column[Math.round(y)] || NULL_WIND_VECTOR;
            return column && column[Math.round(y)] || NULL_WIND_VECTOR;
        }

        /**
         * @returns {boolean} true if the field is valid at the point (x, y)
         */
        field.isDefined = function (x, y) {
            return field(x, y)[2] !== null;
        };

        /**
         * @returns {boolean} true if the point (x, y) lies inside the outer boundary of the vector field, even if
         *          the vector field has a hole (is undefined) at that point, such as at an island in a field of
         *          ocean currents.
         */
        field.isInsideBoundary = function (x, y) {
            return field(x, y) !== NULL_WIND_VECTOR;
        };

        // Frees the massive "columns" array for GC. Without this, the array is leaked (in Chrome) each time a new
        // field is interpolated because the field closure's context is leaked, for reasons that defy explanation.
        field.release = function () {
            columns = [];
        };

        //随机函数？
        field.randomize = function (o) {  // UNDONE: this method is terrible
            var x, y;
            var safetyNet = 0;
            do {
                x = Math.round(_.random(bounds.x, bounds.xMax));
                y = Math.round(_.random(bounds.y, bounds.yMax));
            } while (!field.isDefined(x, y) && safetyNet++ < 30);
            o.x = x;
            o.y = y;
            return o;
        };

        field.overlay = mask.imageData;

        return field;
    }

    /**
     * Calculate distortion of the wind vector caused by the shape of the projection at point (x, y). The wind
     * vector is modified in place and returned by this function.
     *
     * 计算在点 (x、y) 上投影的形状引起的风矢量失真。
     * 风向量在就地修改并由此函数返回。
     */
    function distort(projection, λ, φ, x, y, scale, wind) {
        var u = wind[0] * scale;
        var v = wind[1] * scale;

        //返回一个4个值的数组 0 1 2 3
        var d = µ.distortion(projection, λ, φ, x, y);

        // Scale distortion vectors by u and v, then add.
        // 规模变形向量u和v 然后相加
        wind[0] = d[0] * u + d[2] * v;
        wind[1] = d[1] * u + d[3] * v;
        return wind;
    }

    function interpolateField(globe, grids) {
        if (!globe || !grids) return null;

        var mask = createMask(globe);
        var primaryGrid = grids.primaryGrid;
        var overlayGrid = grids.overlayGrid;

        log.time("interpolating field");
        var d = when.defer(), cancel = this.cancel;

        var projection = globe.projection;
        var bounds = globe.bounds(view);
        // How fast particles move on the screen (arbitrary value chosen for aesthetics).
        var velocityScale = bounds.height * primaryGrid.particles.velocityScale;

        var columns = [];
        var point = [];
        var x = bounds.x;
        var interpolate = primaryGrid.interpolate;
        var overlayInterpolate = overlayGrid.interpolate;
        var hasDistinctOverlay = primaryGrid !== overlayGrid;
        var scale = overlayGrid.scale;

        //这里绝对是根据屏幕横坐标 X 进行差值部分！   遍历 xy 对每一个单位 的屏幕坐标
        function interpolateColumn(x) {
            var column = [];
            for (var y = bounds.y; y <= bounds.yMax; y += 2) {
                if (mask.isVisible(x, y)) {
                    point[0] = x;
                    point[1] = y;
                    //获取基于投影的xy point为屏幕坐标
                    var coord = projection.invert(point);
                    var color = TRANSPARENT_BLACK;
                    var wind = null;
                    if (coord) {
                        // λφ 为对应屏幕坐标的投影坐标
                        var λ = coord[0], φ = coord[1];
                        //isFinite 是否无穷大 验证投影坐标是否合法 某些投影下 并非所有屏幕坐标都有 合法的值
                        // 如果 number 是有限数字（或可转换为有限数字），那么返回 true。否则，如果 number 是 NaN（非数字），或者是正、负无穷大的数，则返回 false。
                        if (isFinite(λ)) {
                            //插值？？ 每一种模式不太一样 在product中对其进行了定义 根据投影坐标 获取风
                            wind = interpolate(λ, φ);
                            var scalar = null;
                            if (wind) {
                                //重新更新 wind[0] wind[1] x y 投影方式  坐标 经纬度 坐标
                                wind = distort(projection, λ, φ, x, y, velocityScale, wind);
                                //wind2 在插值中生成 interpolate 里面生成的么 interpolate
                                scalar = wind[2];
                            }
                            //如果 有overlay
                            if (hasDistinctOverlay) {
                                scalar = overlayInterpolate(λ, φ);
                            }
                            if (µ.isValue(scalar)) {
                                color = scale.gradient(scalar, OVERLAY_ALPHA);
                            }
                        }
                    }
                    //赋值  若不存在 则为 HOLE_VECTOR
                    column[y + 1] = column[y] = wind || HOLE_VECTOR;


                    mask.set(x, y, color).set(x + 1, y, color).set(x, y + 1, color).set(x + 1, y + 1, color);

                    //mask.set(x, y, m_color).set(x + 1, y, m_color).set(x, y + 1, m_color).set(x + 1, y + 1, m_color);

                }
            }
            columns[x + 1] = columns[x] = column;
        }

        report.status("");

        (function batchInterpolate() {
            try {
                if (!cancel.requested) {
                    var start = Date.now();
                    while (x < bounds.xMax) {
                        interpolateColumn(x);
                        x += 2;
                        if ((Date.now() - start) > MAX_TASK_TIME) {
                            // Interpolation is taking too long. Schedule the next batch for later and yield.
                            //计算差值 的 等待
                            report.progress((x - bounds.x) / (bounds.xMax - bounds.x));
                            setTimeout(batchInterpolate, MIN_SLEEP_TIME);
                            return;
                        }
                    }
                }
                d.resolve(createField(columns, bounds, mask));
            }
            catch (e) {
                d.reject(e);
            }
            report.progress(1);  // 100% complete
            log.timeEnd("interpolating field");
        })();

        return d.promise;
    }

    function animate(globe, field, grids) {
        if (!globe || !field || !grids) return;

        var cancel = this.cancel;
        var bounds = globe.bounds(view);
        // maxIntensity is the velocity at which particle color intensity is maximum
        //根据数据的最大最小值 对调色板进行分割 获取 每一个调色板 间隔 的 color 列表  返回18个颜色的数组
        var colorStyles = µ.windIntensityColorScale(INTENSITY_SCALE_STEP, grids.primaryGrid.particles.maxIntensity);
        //buckets 根据 调色板 的个数 进行分组
        var buckets = colorStyles.map(function () {
            return [];
        });
        //计算总数？ 使用当前屏幕宽度 与设置常量相乘
        var particleCount = Math.round(bounds.width * PARTICLE_MULTIPLIER);
        //如果是手机端 则要再次相乘
        if (µ.isMobile()) {
            particleCount *= PARTICLE_REDUCTION;
        }
        //设置隐藏的时候的显示透明度  原为 0.95 0.97
        var fadeFillStyle = µ.isFF() ? "rgba(0, 0, 0, 0.95)" : "rgba(0, 0, 0, 0.97)";  // FF Mac alpha behaves oddly

        log.debug("particle count: " + particleCount);
        var particles = [];
        for (var i = 0; i < particleCount; i++) {
            //随机 的一个坐标点 age （0 - MAX_PARTICLE_AGE） x y 随机 从0 - 各自的max xy 必须是在filed中有值的数据
            particles.push(field.randomize({age: _.random(0, MAX_PARTICLE_AGE)}));
            // particles.push(field.randomize({age: 11}));
        }

        function evolve() {
            buckets.forEach(function (bucket) {
                bucket.length = 0;
            });
            particles.forEach(function (particle) {
                if (particle.age > MAX_PARTICLE_AGE) {
                    field.randomize(particle).age = 0;
                }
                var x = particle.x;
                var y = particle.y;
                //当前位置的向量
                var v = field(x, y);  // vector at current position
                var m = v[2];
                if (m === null) {
                    particle.age = MAX_PARTICLE_AGE;  // particle has escaped the grid, never to return...
                }
                else {
                    //计算下一个位置的坐标 根据当前xy 及当前的
                    var xt = x + v[0];
                    var yt = y + v[1];
                    //判断新的坐标 在field中是否存在
                    if (field.isDefined(xt, yt)) {
                        // Path from (x,y) to (xt,yt) is visible, so add this particle to the appropriate draw bucket.
                        //如果存在 则将其加入 buckets
                        particle.xt = xt;
                        particle.yt = yt;
                        //根据 m的数值 计算这个数据应该在哪一个 buckets 的区间范围内 将其加入
                        buckets[colorStyles.indexFor(m)].push(particle);
                    }
                    else {
                        // Particle isn't visible, but it still moves through the field.
                        // 粒子不可见 但是依旧进行位移 xt yt也许可见 继续向下 在下次便利的时候 不再使用不能被添加的xy
                        particle.x = xt;
                        particle.y = yt;
                    }
                }
                //添加过一次 则 age ++
                particle.age += 1;
            });
        }

        var g = d3.select("#animation").node().getContext("2d");
        g.lineWidth = PARTICLE_LINE_WIDTH;
        g.fillStyle = fadeFillStyle;

        function draw() {
            // Fade existing particle trails.
            var prev = g.globalCompositeOperation;
            g.globalCompositeOperation = "destination-in";
            g.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
            g.globalCompositeOperation = prev;

            // Draw new particle trails.
            buckets.forEach(function (bucket, i) {
                if (bucket.length > 0) {
                    g.beginPath();
                    g.strokeStyle = colorStyles[i];
                    bucket.forEach(function (particle) {
                        g.moveTo(particle.x, particle.y);
                        g.lineTo(particle.xt, particle.yt);
                        particle.x = particle.xt;
                        particle.y = particle.yt;
                    });
                    g.stroke();
                }
            });
        }

        (function frame() {
            try {
                if (cancel.requested) {
                    field.release();
                    return;
                }
                evolve();
                draw();
                setTimeout(frame, FRAME_RATE);
            }
            catch (e) {
                report.error(e);
            }
        })();
    }

    function drawGridPoints(ctx, grid, globe) {
        if (!grid || !globe || !configuration.get("showGridPoints")) return;

        ctx.fillStyle = "rgba(255, 255, 255, 1)";
        // Use the clipping behavior of a projection stream to quickly draw visible points.
        var stream = globe.projection.stream({
            point: function (x, y) {
                ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
            }
        });
        grid.forEachPoint(function (λ, φ, d) {
            if (µ.isValue(d)) {
                stream.point(λ, φ);
            }
        });
    }

    function drawOverlay(field, overlayType) {
        if (!field) return;

        var ctx = d3.select("#overlay").node().getContext("2d"), grid = (gridAgent.value() || {}).overlayGrid;

        µ.clearCanvas(d3.select("#overlay").node());
        µ.clearCanvas(d3.select("#scale").node());
        if (overlayType) {
            if (overlayType !== "off") {
                ctx.putImageData(field.overlay, 0, 0);
            }
            //绘制顶层 grid
            drawGridPoints(ctx, grid, globeAgent.value());
        }

        if (grid) {
            // Draw color bar for reference.
            var colorBar = d3.select("#scale"), scale = grid.scale, bounds = scale.bounds;
            var c = colorBar.node(), g = c.getContext("2d"), n = c.width - 1;
            for (var i = 0; i <= n; i++) {
                var rgb = scale.gradient(µ.spread(i / n, bounds[0], bounds[1]), 1);
                g.fillStyle = "rgb(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ")";
                g.fillRect(i, 0, 1, c.height);
            }

            // Show tooltip on hover.
            colorBar.on("mousemove", function () {
                var x = d3.mouse(this)[0];
                var pct = µ.clamp((Math.round(x) - 2) / (n - 2), 0, 1);
                var value = µ.spread(pct, bounds[0], bounds[1]);
                var elementId = grid.type === "wind" ? "#location-wind-units" : "#location-value-units";
                var units = createUnitToggle(elementId, grid).value();
                colorBar.attr("title", µ.formatScalar(value, units) + " " + units.label);
            });
        }
    }

    /**
     * Extract the date the grids are valid, or the current date if no grid is available.
     * UNDONE: if the grids hold unloaded products, then the date can be extracted from them.
     *         This function would simplify nicely.
     */
    function validityDate(grids) {
        // When the active layer is considered "current", use its time as now, otherwise use current time as
        // now (but rounded down to the nearest three-hour block).
        var THREE_HOURS = 3 * HOUR;
        var now = grids ? grids.primaryGrid.date.getTime() : Math.floor(Date.now() / THREE_HOURS) * THREE_HOURS;
        var parts = configuration.get("date").split("/");  // yyyy/mm/dd or "current"
        var hhmm = configuration.get("hour");
        return parts.length > 1 ?
            Date.UTC(+parts[0], parts[1] - 1, +parts[2], +hhmm.substring(0, 2)) :
            parts[0] === "current" ? now : null;
    }

    /**
     * Display the grid's validity date in the menu. Allow toggling between local and UTC time.
     */
    function showDate(grids) {
        var date = new Date(validityDate(grids)), isLocal = d3.select("#data-date").classed("local");
        var formatted = isLocal ? µ.toLocalISO(date) : µ.toUTCISO(date);
        d3.select("#data-date").text(formatted + " " + (isLocal ? "Local" : "UTC"));
        d3.select("#toggle-zone").text("⇄ " + (isLocal ? "UTC" : "Local"));
    }

    /**
     * Display the grids' types in the menu.
     */
    function showGridDetails(grids) {
        showDate(grids);
        var description = "", center = "";
        if (grids) {
            var langCode = d3.select("body").attr("data-lang") || "en";
            var pd = grids.primaryGrid.description(langCode), od = grids.overlayGrid.description(langCode);
            description = od.name + od.qualifier;
            if (grids.primaryGrid !== grids.overlayGrid) {
                // Combine both grid descriptions together with a " + " if their qualifiers are the same.
                description = (pd.qualifier === od.qualifier ? pd.name : pd.name + pd.qualifier) + " + " + description;
            }
            center = grids.overlayGrid.source;
        }
        d3.select("#data-layer").text(description);
        d3.select("#data-center").text(center);
    }

    /**
     * Constructs a toggler for the specified product's units, storing the toggle state on the element having
     * the specified id. For example, given a product having units ["m/s", "mph"], the object returned by this
     * method sets the element's "data-index" attribute to 0 for m/s and 1 for mph. Calling value() returns the
     * currently active units object. Calling next() increments the index.
     */
    function createUnitToggle(id, product) {
        var units = product.units, size = units.length;
        var index = +(d3.select(id).attr("data-index") || 0) % size;
        return {
            value: function () {
                return units[index];
            },
            next: function () {
                d3.select(id).attr("data-index", index = ((index + 1) % size));
            }
        };
    }

    /**
     * Display the specified wind value. Allow toggling between the different types of wind units.
     */
    function showWindAtLocation(wind, product) {
        var unitToggle = createUnitToggle("#location-wind-units", product), units = unitToggle.value();
        d3.select("#location-wind").text(µ.formatVector(wind, units));
        d3.select("#location-wind-units").text(units.label).on("click", function () {
            unitToggle.next();
            showWindAtLocation(wind, product);
        });
    }

    /**
     * Display the specified overlay value. Allow toggling between the different types of supported units.
     */
    function showOverlayValueAtLocation(value, product) {
        var unitToggle = createUnitToggle("#location-value-units", product), units = unitToggle.value();
        d3.select("#location-value").text(µ.formatScalar(value, units));
        d3.select("#location-value-units").text(units.label).on("click", function () {
            unitToggle.next();
            showOverlayValueAtLocation(value, product);
        });
    }

    // Stores the point and coordinate of the currently visible location. This is used to update the location
    // details when the field changes.
    var activeLocation = {};

    /**
     * Display a local data callout at the given [x, y] point and its corresponding [lon, lat] coordinates.
     * The location may not be valid, in which case no callout is displayed. Display location data for both
     * the primary grid and overlay grid, performing interpolation when necessary.
     */
    function showLocationDetails(point, coord) {
        point = point || [];
        coord = coord || [];
        var grids = gridAgent.value(), field = fieldAgent.value(), λ = coord[0], φ = coord[1];
        if (!field || !field.isInsideBoundary(point[0], point[1])) {
            return;
        }

        clearLocationDetails(false);  // clean the slate
        activeLocation = {point: point, coord: coord};  // remember where the current location is

        if (_.isFinite(λ) && _.isFinite(φ)) {
            d3.select("#location-coord").text(µ.formatCoordinates(λ, φ));
            d3.select("#location-close").classed("invisible", false);
        }

        if (field.isDefined(point[0], point[1]) && grids) {
            var wind = grids.primaryGrid.interpolate(λ, φ);
            if (µ.isValue(wind)) {
                showWindAtLocation(wind, grids.primaryGrid);
            }
            if (grids.overlayGrid !== grids.primaryGrid) {
                var value = grids.overlayGrid.interpolate(λ, φ);
                if (µ.isValue(value)) {
                    showOverlayValueAtLocation(value, grids.overlayGrid);
                }
            }
        }
    }

    function updateLocationDetails() {
        showLocationDetails(activeLocation.point, activeLocation.coord);
    }

    function clearLocationDetails(clearEverything) {
        d3.select("#location-coord").text("");
        d3.select("#location-close").classed("invisible", true);
        d3.select("#location-wind").text("");
        d3.select("#location-wind-units").text("");
        d3.select("#location-value").text("");
        d3.select("#location-value-units").text("");
        if (clearEverything) {
            activeLocation = {};
            d3.select(".location-mark").remove();
        }
    }

    function stopCurrentAnimation(alsoClearCanvas) {
        animatorAgent.cancel();
        if (alsoClearCanvas) {
            µ.clearCanvas(d3.select("#animation").node());
        }
    }

    /**
     * Registers a click event handler for the specified DOM element which modifies the configuration to have
     * the attributes represented by newAttr. An event listener is also registered for configuration change events,
     * so when a change occurs the button becomes highlighted (i.e., class ".highlighted" is assigned or removed) if
     * the configuration matches the attributes for this button. The set of attributes used for the matching is taken
     * from newAttr, unless a custom set of keys is provided.
     */
    function bindButtonToConfiguration(elementId, newAttr, keys) {
        keys = keys || _.keys(newAttr);
        d3.select(elementId).on("click", function () {
            if (d3.select(elementId).classed("disabled")) return;
            configuration.save(newAttr);
        });
        configuration.on("change", function (model) {
            var attr = model.attributes;
            d3.select(elementId).classed("highlighted", _.isEqual(_.pick(attr, keys), _.pick(newAttr, keys)));
        });
    }

    function reportSponsorClick(type) {
        if (ga) {
            ga("send", "event", "sponsor", type);
        }
    }

    /**
     * Registers all event handlers to bind components and page elements together. There must be a cleaner
     * way to accomplish this...
     */
    function init() {
        report.status("Initializing...");

        d3.select("#sponsor-link")
            .attr("target", µ.isEmbeddedInIFrame() ? "_new" : null)
            .on("click", reportSponsorClick.bind(null, "click"))
            .on("contextmenu", reportSponsorClick.bind(null, "right-click"))
        d3.select("#sponsor-hide").on("click", function () {
            d3.select("#sponsor").classed("invisible", true);
        });

        d3.selectAll(".fill-screen").attr("width", view.width).attr("height", view.height);
        // Adjust size of the scale canvas to fill the width of the menu to the right of the label.
        var label = d3.select("#scale-label").node();
        d3.select("#scale")
            .attr("width", (d3.select("#menu").node().offsetWidth - label.offsetWidth) * 0.97)
            .attr("height", label.offsetHeight / 2);

        d3.select("#show-menu").on("click", function () {
            if (µ.isEmbeddedInIFrame()) {
                window.open("http://earth.nullschool.net/" + window.location.hash, "_blank");
            }
            else {
                d3.select("#menu").classed("invisible", !d3.select("#menu").classed("invisible"));
            }
        });

        if (µ.isFF()) {
            // Workaround FF performance issue of slow click behavior on map having thick coastlines.
            d3.select("#display").classed("firefox", true);
        }

        // Tweak document to distinguish CSS styling between touch and non-touch environments. Hacky hack.
        if ("ontouchstart" in document.documentElement) {
            d3.select(document).on("touchstart", function () {
            });  // this hack enables :active pseudoclass
        }
        else {
            d3.select(document.documentElement).classed("no-touch", true);  // to filter styles problematic for touch
        }

        // Bind configuration to URL bar changes.
        d3.select(window).on("hashchange", function () {
            log.debug("hashchange");
            configuration.fetch({trigger: "hashchange"});
        });

        configuration.on("change", report.reset);

        meshAgent.listenTo(configuration, "change:topology", function (context, attr) {
            meshAgent.submit(buildMesh, attr);
        });

        globeAgent.listenTo(configuration, "change:projection", function (source, attr) {
            globeAgent.submit(buildGlobe, attr);
        });

        gridAgent.listenTo(configuration, "change", function () {
            var changed = _.keys(configuration.changedAttributes()), rebuildRequired = false;

            // Build a new grid if any layer-related attributes have changed.
            if (_.intersection(changed, ["date", "hour", "param", "surface", "level"]).length > 0) {
                rebuildRequired = true;
            }
            // Build a new grid if the new overlay type is different from the current one.
            var overlayType = configuration.get("overlayType") || "default";
            if (_.indexOf(changed, "overlayType") >= 0 && overlayType !== "off") {
                var grids = (gridAgent.value() || {}), primary = grids.primaryGrid, overlay = grids.overlayGrid;
                if (!overlay) {
                    // Do a rebuild if we have no overlay grid.
                    rebuildRequired = true;
                }
                else if (overlay.type !== overlayType && !(overlayType === "default" && primary === overlay)) {
                    // Do a rebuild if the types are different.
                    rebuildRequired = true;
                }
            }

            if (rebuildRequired) {
                gridAgent.submit(buildGrids);
            }
        });
        gridAgent.on("submit", function () {
            showGridDetails(null);
        });
        gridAgent.on("update", function (grids) {
            showGridDetails(grids);
        });
        d3.select("#toggle-zone").on("click", function () {
            d3.select("#data-date").classed("local", !d3.select("#data-date").classed("local"));
            showDate(gridAgent.cancel.requested ? null : gridAgent.value());
        });

        function startRendering() {
            rendererAgent.submit(buildRenderer, meshAgent.value(), globeAgent.value());
        }

        rendererAgent.listenTo(meshAgent, "update", startRendering);
        rendererAgent.listenTo(globeAgent, "update", startRendering);

        function startInterpolation() {
            fieldAgent.submit(interpolateField, globeAgent.value(), gridAgent.value());
        }

        function cancelInterpolation() {
            fieldAgent.cancel();
        }

        fieldAgent.listenTo(gridAgent, "update", startInterpolation);
        fieldAgent.listenTo(rendererAgent, "render", startInterpolation);
        fieldAgent.listenTo(rendererAgent, "start", cancelInterpolation);
        fieldAgent.listenTo(rendererAgent, "redraw", cancelInterpolation);

        animatorAgent.listenTo(fieldAgent, "update", function (field) {
            animatorAgent.submit(animate, globeAgent.value(), field, gridAgent.value());
        });
        animatorAgent.listenTo(rendererAgent, "start", stopCurrentAnimation.bind(null, true));
        animatorAgent.listenTo(gridAgent, "submit", stopCurrentAnimation.bind(null, false));
        animatorAgent.listenTo(fieldAgent, "submit", stopCurrentAnimation.bind(null, false));

        overlayAgent.listenTo(fieldAgent, "update", function () {
            overlayAgent.submit(drawOverlay, fieldAgent.value(), configuration.get("overlayType"));
        });
        overlayAgent.listenTo(rendererAgent, "start", function () {
            overlayAgent.submit(drawOverlay, fieldAgent.value(), null);
        });
        overlayAgent.listenTo(configuration, "change", function () {
            var changed = _.keys(configuration.changedAttributes())
            // if only overlay relevant flags have changed...
            if (_.intersection(changed, ["overlayType", "showGridPoints"]).length > 0) {
                overlayAgent.submit(drawOverlay, fieldAgent.value(), configuration.get("overlayType"));
            }
        });

        // Add event handlers for showing, updating, and removing location details.
        inputController.on("click", showLocationDetails);
        fieldAgent.on("update", updateLocationDetails);
        d3.select("#location-close").on("click", _.partial(clearLocationDetails, true));

        // Modify menu depending on what mode we're in.
        configuration.on("change:param", function (context, mode) {
            d3.selectAll(".ocean-mode").classed("invisible", mode !== "ocean");
            d3.selectAll(".wind-mode").classed("invisible", mode !== "wind");
            switch (mode) {
                case "wind":
                    d3.select("#nav-backward-more").attr("title", "-1 Day");
                    d3.select("#nav-backward").attr("title", "-3 Hours");
                    d3.select("#nav-forward").attr("title", "+3 Hours");
                    d3.select("#nav-forward-more").attr("title", "+1 Day");
                    break;
                case "ocean":
                    d3.select("#nav-backward-more").attr("title", "-1 Month");
                    d3.select("#nav-backward").attr("title", "-5 Days");
                    d3.select("#nav-forward").attr("title", "+5 Days");
                    d3.select("#nav-forward-more").attr("title", "+1 Month");
                    break;
            }
        });

        // Add handlers for mode buttons.
        d3.select("#wind-mode-enable").on("click", function () {
            if (configuration.get("param") !== "wind") {
                configuration.save({param: "wind", surface: "surface", level: "level", overlayType: "default"});
            }
        });
        configuration.on("change:param", function (x, param) {
            d3.select("#wind-mode-enable").classed("highlighted", param === "wind");
        });
        d3.select("#ocean-mode-enable").on("click", function () {
            if (configuration.get("param") !== "ocean") {
                // When switching between modes, there may be no associated data for the current date. So we need
                // find the closest available according to the catalog. This is not necessary if date is "current".
                // UNDONE: this code is annoying. should be easier to get date for closest ocean product.
                var ocean = {param: "ocean", surface: "surface", level: "currents", overlayType: "default"};
                var attr = _.clone(configuration.attributes);

                if (attr.date === "current") {
                    configuration.save(ocean);
                    console.log("save");
                }
                else {
                    when.all(products.productsFor(_.extend(attr, ocean))).spread(function (product) {
                        if (product.date) {
                            configuration.save(_.extend(ocean, µ.dateToConfig(product.date)));
                        }
                    }).otherwise(report.error);
                }
                stopCurrentAnimation(true);  // cleanup particle artifacts over continents
            }
        });
        configuration.on("change:param", function (x, param) {
            d3.select("#ocean-mode-enable").classed("highlighted", param === "ocean");
        });

        // Add logic to disable buttons that are incompatible with each other.
        configuration.on("change:overlayType", function (x, ot) {
            d3.select("#surface-level").classed("disabled", ot === "air_density" || ot === "wind_power_density");
        });
        configuration.on("change:surface", function (x, s) {
            d3.select("#overlay-air_density").classed("disabled", s === "surface");
            d3.select("#overlay-wind_power_density").classed("disabled", s === "surface");
        });

        // Add event handlers for the time navigation buttons. 前后时次位移事件
        d3.select("#nav-backward-more").on("click", navigate.bind(null, -10));
        d3.select("#nav-forward-more").on("click", navigate.bind(null, +10));
        d3.select("#nav-backward").on("click", navigate.bind(null, -1));
        d3.select("#nav-forward").on("click", navigate.bind(null, +1));
        d3.select("#nav-now").on("click", function () {
            configuration.save({date: "current", hour: ""});
        });

        d3.select("#option-show-grid").on("click", function () {
            configuration.save({showGridPoints: !configuration.get("showGridPoints")});
        });
        configuration.on("change:showGridPoints", function (x, showGridPoints) {
            d3.select("#option-show-grid").classed("highlighted", showGridPoints);
        });

        // Add handlers for all wind level buttons.
        d3.selectAll(".surface").each(function () {
            var id = this.id, parts = id.split("-");
            bindButtonToConfiguration("#" + id, {param: "wind", surface: parts[0], level: parts[1]});
        });

        // Add handlers for ocean animation types.
        bindButtonToConfiguration("#animate-currents", {param: "ocean", surface: "surface", level: "currents"});

        // Add handlers for all overlay buttons.
        products.overlayTypes.forEach(function (type) {
            bindButtonToConfiguration("#overlay-" + type, {overlayType: type});
        });
        bindButtonToConfiguration("#overlay-wind", {param: "wind", overlayType: "default"});
        bindButtonToConfiguration("#overlay-ocean-off", {overlayType: "off"});
        bindButtonToConfiguration("#overlay-currents", {overlayType: "default"});

        // Add handlers for all projection buttons.
        globes.keys().forEach(function (p) {
            bindButtonToConfiguration("#" + p, {projection: p, orientation: ""}, ["projection"]);
        });

        // When touch device changes between portrait and landscape, rebuild globe using the new view size.
        d3.select(window).on("orientationchange", function () {
            view = µ.view();
            globeAgent.submit(buildGlobe, configuration.get("projection"));
        });
    }

    function start() {
        // Everything is now set up, so load configuration from the hash fragment and kick off change events.
        configuration.fetch();
    }

    when(true).then(init).then(start).otherwise(report.error);

})();
