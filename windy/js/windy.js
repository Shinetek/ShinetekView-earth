/**
 * Created by lenovo on 2017/4/20.
 */

var FRAME_RATE = 20;
var Windy = function (a) {
    var b = .003 * (Math.pow(window.devicePixelRatio, 1 / 3) || 1),
        c = Math.pow(window.devicePixelRatio, 1 / 3) || 1.6,
        d = 1E3 / 15,
        e = [NaN, NaN, null],

        //5点计算法?
        f = function (a, b, c, d, e, f) {
            var g = 1 - a, h = 1 - b, k = g * h, h = a * h, g = g * b;
            a *= b;
            return [c[0] * k + d[0] * h + e[0] * g + f[0] * a,
                c[1] * k + d[1] * h + e[1] * g + f[1] * a,
                c[2] * k + d[2] * h + e[2] * g + f[2] * a]
        },
    //g 为product 的缩略
        g = function (a, b, c) {
            var d = a.data, e = b.data;
            return {
                header: a.header, data: function (a) {
                    return [d[a], e[a], c.data[a]]
                },
                interpolate: f
            }
        }, h = function (a) {
            var b = null, c = null, d = null;
            //直接使用了abc 三个数据 风速 和温度 使用温度来标识 风的颜色
            a.forEach(function (a) {
                switch (a.header.parameterCategory + "," + a.header.parameterNumber) {
                    case "2,2":
                        b = a;
                        break;
                    case "2,3":
                        c = a;
                        break;
                    case "0,0":
                        d = a
                }
            });
            return g(b, c, d)
        },
        // 解析函数
        k = function (a, b) {
            var c = h(a), d = c.header, e = d.lo1, f = d.la1, g = d.dx, k = d.dy, l = d.nx, m = d.ny, n = new Date(d.refTime);
            n.setHours(n.getHours() + d.forecastTime);
            for (var p = [], d = 0, q = 360 <= Math.floor(l * g), t = 0; t < m; t++) {
                for (var u = [], v = 0; v < l; v++, d++)u[v] = c.data(d);
                q && u.push(u[0]);
                p[t] = u
            }
            //执行b 将其转化为 uv 及向量
            b({
                date: n,
                interpolate: function (a, b) {
                    var d = a - e, d = (d - 360 * Math.floor(d / 360)) / g, h = (f - b) / k, l = Math.floor(d), m = l + 1, n = Math.floor(h), q;
                    if (q = p[n]) {
                        var t = q[l], u = q[m];
                        if (null !== t && void 0 !== t && null !== u && void 0 !== u && (q = p[n + 1])) {
                            var v = q[l], m = q[m];
                            if (null !== v && void 0 !== v && null !== m && void 0 !== m)return c.interpolate(d - l, h - n, t, u, v, m)
                        }
                    }
                    return null
                }
            })
        }, l = function (a, b, c) {
            function d(b, c) {
                var f = a[Math.round(b)];
                return f && f[Math.round(c)] || e
            }

            d.release = function () {
                delete a;
                a = []
            };
            d.randomize = function (a) {
                var c, e, f = 0;
                do c = Math.round(Math.floor(Math.random() * b.width) +
                    b.x), e = Math.round(Math.floor(Math.random() * b.height) + b.y); while (null === d(c, e)[2] && 30 > f++);
                a.x = c;
                a.y = e;
                return a
            };
            c(b, d)
        }, m = function (a, b, c) {
            var d = a[0];
            return {
                x: Math.round(d[0]),
                y: Math.max(Math.floor(d[1], 0), 0),
                xMax: b,
                yMax: Math.min(Math.ceil(a[1][1], c), c - 1),
                width: b,
                height: c
            }
        }, n = function (a) {
            return Math.log(Math.tan(a / 2 + Math.PI / 4))
        }, p = function (a, b, c) {
            var d = n(c.south), e = n(c.north), f = c.width / (c.east - c.west), d = c.height / (e - d);
            a = n(a / 180 * Math.PI);
            return [(b / 180 * Math.PI - c.west) * f, (e - a) * d]
        }, q = function (a, c, d, e) {
            for (var f =
                b * Math.pow((d.south - d.north) * (d.west - d.east), .3), g = [], h = c.x; h < c.width; h += 2) {
                for (var k = h, m = [], n = c.y; n <= c.yMax; n += 2) {
                    var q;
                    q = d;
                    var t = q.east - q.west, u = q.width / (t / (Math.PI / 180)) * 360 / (2 * Math.PI);
                    q = [q.west / (Math.PI / 180) + k / q.width * (t / (Math.PI / 180)), 180 / Math.PI * (2 * Math.atan(Math.exp((q.height + u / 2 * Math.log((1 + Math.sin(q.south)) / (1 - Math.sin(q.south))) - n) / u)) - Math.PI / 2)];
                    var v = q[0], x = q[1];
                    if (isFinite(v) && (q = a.interpolate(v, x))) {
                        var t = q[0] * f, u = q[1] * f, y = v, z = x, v = k, x = n, R = d, T = 2 * Math.PI, O = Math.pow(10, -5.2), P = 0 > y ? O :
                            -O, O = 0 > z ? O : -O, S = p(z, y + P, R), y = p(z + O, y, R), z = Math.cos(z / 360 * T), v = [(S[0] - v) / P / z, (S[1] - x) / P / z, (y[0] - v) / O, (y[1] - x) / O];
                        q[0] = v[0] * t + v[2] * u;
                        q[1] = v[1] * t + v[3] * u;
                        m[n + 1] = m[n] = q
                    }
                }
                g[k + 1] = g[k] = m
            }
            l(g, c, e)
        }, t, u, y = function (b, e, f) {
            //重新计算
            function g() {
                l.forEach(function (a) {
                    a.length = 0
                });
                t.forEach(function (a) {
                    90 < a.age && (e.randomize(a).age = ~~(90 * Math.random() / 2));
                    var b = a.x, c = a.y, d = e(b, c), f = d[2];
                    null === f ? a.age = 90 : (b += d[0], c += d[1], null !== e(b, c)[0] ? (a.xt = b, a.yt = c, l[k.indexFor(f)].push(a)) : (a.x = b, a.y = c));
                    a.age += 1
                })
            }

//重新绘制
            function h() {
                n.save();
                n.globalAlpha = .16;
                n.globalCompositeOperation = "destination-out";
                n.fillStyle = "#000";
                n.fillRect(b.x, b.y, b.width, b.height);
                n.restore();
                l.forEach(function (a, b) {
                    0 < a.length && (n.beginPath(), n.strokeStyle = k[b], a.forEach(function (a) {
                        n.moveTo(a.x, a.y);
                        n.lineTo(a.xt, a.yt);
                        a.x = a.xt;
                        a.y = a.yt
                    }), n.stroke())
                })
            }

            var k = function (a, b) {
                result = "rgb(36,104, 180);rgb(60,157, 194);rgb(128,205,193 );rgb(151,218,168 );rgb(198,231,181);rgb(238,247,217);rgb(255,238,159);rgb(252,217,125);rgb(255,182,100);rgb(252,150,75);rgb(250,112,52);rgb(245,64,32);rgb(237,45,28);rgb(220,24,32);rgb(180,0,35)".split(";");
                result.indexFor = function (c) {
                    return Math.max(0, Math.min(result.length - 1, Math.round((c - a) / (b - a) * (result.length - 1))))
                };
                return result
            }(261.15, 317.15), l = k.map(function () {
                return []
            });
            f = Math.round(b.width * b.height * .01 * Math.pow((f.south - f.north) * (f.west - f.east), .24));
            /android|blackberry|iemobile|ipad|iphone|ipod|opera mini|webos/i.test(navigator.userAgent) && (f /= c);
            t = t || [];
            t.length > f && (t = t.slice(0, f));
            for (var m = t.length; m < f; m++)t.push(e.randomize({age: ~~(90 * Math.random()) + 0}));
            var n = a.canvas.getContext("2d");
            n.lineWidth = 1;
            var p = Date.now();
            (function G() {
                u = requestAnimationFrame(G);
                var a = Date.now();
                delta = a - p;
                delta > d && (p = a - delta % d, g(), h())
            })()
        }, x = function (b, c, d, e) {
            var f = {
                south: e[0][1] / 180 * Math.PI,
                north: e[1][1] / 180 * Math.PI,
                east: e[1][0] / 180 * Math.PI,
                west: e[0][0] / 180 * Math.PI,
                width: c,
                height: d
            };
            v();
            k(a.data, function (a) {
                q(a, m(b, c, d), f, function (a, b) {
                    z.field = b;
                    y(a, b, f)
                })
            })
        }, v = function () {
            z.field && z.field.release();
            u && cancelAnimationFrame(u)
        }, z = {
            params: a, start: x, stop: v, update: function (b, c, d, e, f) {
                delete a.data;
                a.data =
                    b;
                f && x(c, d, e, f)
            }, shift: function (b, c) {
                var d = a.canvas, e = d.width, f = d.height, d = d.getContext("2d");
                if (e > b && f > c) {
                    var g = function (a, b) {
                        return Math.max(0, Math.min(a, b))
                    }, h = d.getImageData(g(e, -b), g(f, -c), g(e, e - b), g(f, f - c));
                    d.clearRect(0, 0, e, f);
                    d.putImageData(h, g(e, b), g(f, c));
                    e = 0;
                    for (f = t.length; e < f; e++)t[e].x += b, t[e].y += c
                }
            }
        };
    return z
};


window.requestAnimationFrame = function () {
    return window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame || function (a) {
            return window.setTimeout(a, 1E3 / FRAME_RATE)
        }
}();
window.cancelAnimationFrame || (window.cancelAnimationFrame = function (a) {
    clearTimeout(a)
});
