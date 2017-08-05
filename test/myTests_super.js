
var domain, acct_number, demo_email, demo_pass,
    PASSWORD = undefined;


QUnit.module('Authorization tests', {

    beforeEach: function (assert) {
        console.log('beforeEach');
        var done = assert.async();
        domain = privat.getItem('domain');
        acct_number = parseInt(privat.getItem('acct_number'), 10);
        demo_email = privat.getItem('demo_email');
        demo_pass = privat.getItem('demo_pass');

        Rdbhost.reset_rdbhost(undefined, 'clean');
        Rdbhost.paranoid_confirm = false;
        Rdbhost.connect(domain, acct_number);
        done();
    },
    afterEach: function(assert) {
        console.log('afterEach');
        var done = assert.async();

        Rdbhost.reset_rdbhost(done, 'clean');
    }
});

// send super request, cancel authorization dialog
//
QUnit.test('super request cancel', function(assert) {

    console.log('test super req cancel');
    var done = assert.async();
    var e = Rdbhost.super()
                   .query('SELECT 1 AS a;');

    var p = e.get_data();
    ok(p.constructor.toString().indexOf('Promise') >= 0, p);
    p.then(function(d) {
            ok(false, 'then called');
            clearTimeout(st);
            done();
        })
        .catch(function(e) {
            ok(true, 'then error called');
            ok(e.message.substr(0, 11) === 'authorizati', 'cancellation ');
            clearTimeout(st);
            done();
        });

    Rdbhost.once('form-displayed', function() {
        setTimeout(function() {

            var frm = document.getElementById('partial-super-auth'),
                cncl = frm.querySelector('.cancel');
            ok(frm.textContent.indexOf('SELECT 1') >= 0, 'sql found');
            cncl.click();
        }, 100)
    });

    var st = setTimeout(function() { done(); }, 5000);
});


// send super request, confirm with authorization dialog
//
QUnit.test('super request confirm', function(assert) {

    console.log('test super req confirm');
    var done = assert.async();
    var e = Rdbhost.super()
        .query('SELECT 1 AS b');

    var p = e.get_data();
    ok(p.constructor.toString().indexOf('Promise') >= 0, p);
    p.then(function(d) {
            ok(true, 'then called');
            ok(d.result_sets[0].records.rows[0].b === 1, d.status);
            clearTimeout(st);
            done();
        })
        .catch(function(e) {
            ok(false, 'then error called');
            clearTimeout(st);
            done();
        });

    Rdbhost.once('form-displayed', function() {
        setTimeout(function () {
            var frm = document.getElementById('partial-super-auth'),
                eml = frm.querySelector("input[name='email']"),
                pw = frm.querySelector("input[name='password']"),
                sub = frm.querySelector("input[type='submit']");

            ok(frm.textContent.indexOf('SELECT 1 AS b') >= 0, 'sql found');

            eml.value = demo_email;
            pw.value = demo_pass;
            sub.click();
        }, 500)
    });

    var st = setTimeout(function() { done(); }, 5000);
});


// send super request, confirm with authorization dialog
//
QUnit.test('super request http confirm', function(assert) {

    console.log('test super req http confirm');
    var done = assert.async();
    var e = Rdbhost.super()
        .query('SELECT 1 AS c;')
        .form_data(new FormData());

    var p = e.get_data();
    ok(p.constructor.toString().indexOf('Promise') >= 0, p);
    p.then(function(d) {
            ok(true, 'then called');
            ok(d.result_sets[0].records.rows[0].c === 1, d.status);
            clearTimeout(st);
            done();
        })
        .catch(function(e) {
            ok(false, 'then error called');
            clearTimeout(st);
            done();
        });

    Rdbhost.once('form-displayed', function() {
        setTimeout(function () {
            var frm = document.getElementById('partial-super-auth'),
                eml = frm.querySelector("input[name='email']"),
                pw = frm.querySelector("input[name='password']"),
                sub = frm.querySelector("input[type='submit']");

            eml.value = demo_email;
            pw.value = demo_pass;
            sub.click();
        }, 500)
    });

    var st = setTimeout(function() { done(); }, 5000);
});



// send super request, confirm with authorization dialog
//
QUnit.test('super request http cancel', function(assert) {

    console.log('test super req http cancel');

    var done = assert.async();
    var e = Rdbhost.super()
        .query('SELECT 1 AS d;')
        .form_data(new FormData());

    var p = e.get_data();
    ok(p.constructor.toString().indexOf('Promise') >= 0, p);
    p.then(function(d) {
            ok(false, 'then called');
            clearTimeout(st);
            done();
        })
        .catch(function(e) {
            ok(true, 'then error called');
            ok(e.message.substr(0, 11) === 'authorizati', 'cancellation ');
            clearTimeout(st);
            done();
        });

    Rdbhost.once('form-displayed', function() {
        setTimeout(function () {
            var frm = document.getElementById('partial-super-auth'),
                cncl = frm.querySelector('.cancel');
            cncl.click();
        }, 500)
    });

    var st = setTimeout(function() { done(); }, 5000);
});


QUnit.module('modal-force tests', {

    beforeEach: function (assert) {

        console.log('beforeEach 1');
        domain = privat.getItem('domain');
        acct_number = parseInt(privat.getItem('acct_number'), 10);

        Rdbhost.reset_rdbhost(undefined, 'clean');
        Rdbhost.paranoid_confirm = false;
        Rdbhost.connect(domain, acct_number);

        Rdbhost.clickrecd = [];
        Rdbhost.clicktried = [];
        function oclick(evt) {
            Rdbhost.clickrecd.push(evt);
        }

        // add an a tag to page
        var el = document.createElement('a'),
            href = document.createAttribute('href'),
            id = document.createAttribute('id');
        href.value = '#';
        id.value = 'test-link';
        el.setAttributeNode(href);
        el.setAttributeNode(id);
        el.addEventListener('click', oclick);

        document.body.appendChild(el);

    },
    afterEach: function(assert) {

        console.log('afterEach 1');
        var done = assert.async();
        Rdbhost.reset_rdbhost(done, 'clean');
        var el = document.getElementById('test-link');
        document.body.removeChild(el);
        delete Rdbhost.clickrecd;
        delete Rdbhost.clicktried;
    }
});

// send super request, cancel authorization dialog
//
QUnit.test('super request modal', function(assert) {

    console.log('test super req modal');

    var el = document.getElementById('test-link');
    el.click();
    Rdbhost.clicktried.push(1);

    var done = assert.async();
    var e = Rdbhost.super()
        .query('SELECT 1 AS e');

    var p = e.get_data();
    ok(p.constructor.toString().indexOf('Promise') >= 0, p);
    p.then(function(d) {
            ok(false, 'then called');
            clearTimeout(st);
            done();
        })
        .catch(function(e) {
            ok(true, 'then error called');
            clearTimeout(st);
            ok(Rdbhost.clickrecd.length === 1, 'wrong number clicks '+Rdbhost.clickrecd.length);
            ok(Rdbhost.clicktried.length === 2, 'wrong number click tries '+Rdbhost.clicktried.length);
            done();
        });

    setTimeout(function() {
        el.click();
        Rdbhost.clicktried.push(1);
    }, 500);
    Rdbhost.once('form-displayed', function() {
        setTimeout(function () {
            var frm = document.getElementById('partial-super-auth'),
                cncl = frm.querySelector('.cancel');
            cncl.click();
        }, 800)
    });

    var st = setTimeout(function() { done(); }, 5000);
});



// var domain, acct_number, demo_email, demo_pass,
//    PASSWORD = undefined;


module('Confirm tests', {

    beforeEach: function () {
        domain = privat.getItem('domain');
        demo_email = privat.getItem('demo_email');
        demo_pass = privat.getItem('demo_pass');
        acct_number = parseInt(privat.getItem('acct_number'), 10);

        Rdbhost.reset_rdbhost(undefined, 'clean');
        Rdbhost.paranoid_confirm = true;
        Rdbhost.connect(domain, acct_number);
    },
    afterEach: function(assert) {
        var done = assert.async();
        Rdbhost.reset_rdbhost(done, 'clean');
    }
});

// send super request via http, cancel authorization dialog
//
QUnit.test('super request http cancel-confirm', 4, function(assert) {

    var done = assert.async();

    var fd = new FormData();
    var e = Rdbhost.super()
        .query('SELECT 1 AS a');

    var p = e.get_data();
    ok(p.constructor.toString().indexOf('Promise') >= 0, p);
    p.then(function(d) {
            ok(true, 'then called');

            var p1 = Rdbhost.super().query('SELECT 2 AS b;').form_data(fd).get_data();
            ok(p1.constructor.toString().indexOf('Promise') >= 0, p1);
            p1.then(function(d) {
                    ok(false, '2nd request confirm not canceled');
                    clearTimeout(st);
                    done();
                })
                .catch(function(e) {
                    ok(true, '2nd request confirm canceled');
                    clearTimeout(st);
                    done();
                });

        })
        .catch(function(e) {
            ok(false, 'cancel error thrown on prep '+e.message);
            done();
        });

    Rdbhost.once('form-displayed', function() {
        setTimeout(function () {
            var frm = document.getElementById('partial-super-auth'),
                eml = frm.querySelector("input[name='email']"),
                pw = frm.querySelector("input[name='password']"),
                sub = frm.querySelector("input[type='submit']");

            eml.value = demo_email;
            pw.value = demo_pass;

            setTimeout(function() {
                Rdbhost.once('form-displayed', function() {
                    setTimeout(function() {
                        var frm = document.getElementById('partial-confirm'),
                            cncl = frm.querySelector('.cancel');
                        cncl.click();
                    }, 100)
                }, 500);
            }, 2);

            sub.click();
        }, 100);
    });

    var st = setTimeout(function() { done(); }, 5000);
});


// send super request, confirm authorization dialog
//
QUnit.test('super request http confirm-YES', 5, function(assert) {

    var done = assert.async();

    var fd = new FormData();
    var e = Rdbhost.super()
        .query('SELECT 1 AS a');

    var p = e.get_data();
    ok(p.constructor.toString().indexOf('Promise') >= 0, p);
    p.then(function(d) {
        ok(true, 'then called');

        var p1 = Rdbhost.super().query('SELECT 2 AS b;').form_data(fd).get_data();
        ok(p1.constructor.toString().indexOf('Promise') >= 0, p1);
        p1.then(function(d) {
                ok(true, '2nd request confirm not canceled');
                ok(d.status[1] === 'OK', d.status);
                clearTimeout(st);
                done();
            })
            .catch(function(e) {
                ok(false, '2nd request confirm canceled');
                clearTimeout(st);
                done();
            });

    });

    Rdbhost.once('form-displayed', function() {
        setTimeout(function () {
            var frm = document.getElementById('partial-super-auth'),
                eml = frm.querySelector("input[name='email']"),
                pw = frm.querySelector("input[name='password']"),
                sub = frm.querySelector("input[type='submit']");

            eml.value = demo_email;
            pw.value = demo_pass;

            setTimeout(function() {
                Rdbhost.once('form-displayed', function() {
                    setTimeout(function() {
                        var frm = document.getElementById('partial-confirm'),
                            sub = frm.querySelector("input[type='submit']");
                        sub.click();
                    }, 100)
                }, 500);
            }, 2);

            sub.click();
        }, 100);
    });

    var st = setTimeout(function() { done(); }, 5000);
});


// send super request via ws, cancel authorization dialog
//
QUnit.test('super request ws cancel-confirm', 4, function(assert) {

    var done = assert.async();

    var e = Rdbhost.super()
        .query('SELECT 1 AS a');

    var p = e.get_data();
    ok(p.constructor.toString().indexOf('Promise') >= 0, p);
    p.then(function(d) {
        ok(true, 'then called');

        var p1 = Rdbhost.super().query('SELECT 2 AS b;').get_data();
        ok(p1.constructor.toString().indexOf('Promise') >= 0, p1);
        p1.then(function(d) {
                ok(false, '2nd request confirm not canceled');
                clearTimeout(st);
                done();
            })
            .catch(function(e) {
                ok(true, '2nd request confirm canceled');
                clearTimeout(st);
                done();
            });

    });

    Rdbhost.once('form-displayed', function() {
        setTimeout(function () {
            var frm = document.getElementById('partial-super-auth'),
                eml = frm.querySelector("input[name='email']"),
                pw = frm.querySelector("input[name='password']"),
                sub = frm.querySelector("input[type='submit']");

            eml.value = demo_email;
            pw.value = demo_pass;
            sub.click();
        }, 500);

        setTimeout(function() {
            var frm = document.getElementById('partial-confirm'),
                cncl = frm.querySelector('.cancel');
            cncl.click();
        }, 1500);

    });

    var st = setTimeout(function() { done(); }, 5000);
});


// send super request, cancel authorization dialog
//
QUnit.test('super request ws confirm-YES', 5, function(assert) {

    var done = assert.async();

    var e = Rdbhost.super()
        .query('SELECT 1 AS a');

    var p = e.get_data();
    ok(p.constructor.toString().indexOf('Promise') >= 0, p);
    p.then(function(d) {
        ok(true, 'then called');

        var p1 = Rdbhost.super().query('SELECT 2 AS b;').get_data();
        ok(p1.constructor.toString().indexOf('Promise') >= 0, p1);
        p1.then(function(d) {
                ok(true, '2nd request confirm not canceled');
                ok(d.status[1] === 'OK', d.status);
                clearTimeout(st);
                done();
            })
            .catch(function(e) {
                ok(false, '2nd request confirm canceled');
                clearTimeout(st);
                done();
            });

    });

    Rdbhost.once('form-displayed', function() {
        setTimeout(function () {
            var frm = document.getElementById('partial-super-auth'),
                eml = frm.querySelector("input[name='email']"),
                pw = frm.querySelector("input[name='password']"),
                sub = frm.querySelector("input[type='submit']");

            eml.value = demo_email;
            pw.value = demo_pass;
            sub.click();
        }, 500);

        setTimeout(function() {
            var frm = document.getElementById('partial-confirm'),
                sub = frm.querySelector("input[type='submit']");
            sub.click();
        }, 1000);

    });


    var st = setTimeout(function() { done(); }, 5000);
});


module('Alternate Template Location tests', {

    beforeEach: function (assert) {
        var domain = privat.getItem('domain'),
            acct_number = parseInt(privat.getItem('acct_number'), 10);

        if (!window.location.origin) {
            window.location.origin = window.location.protocol + "//" + window.location.hostname +
                (window.location.port ? ':' + window.location.port: '');
        }
        var path = window.location.pathname.replace('/test_runner_super.html', '/tpl/');

        Rdbhost.reset_rdbhost(undefined, 'clean');
        Rdbhost.paranoid_confirm = true;
        Rdbhost.connect(domain, acct_number, window.location.origin + path);
        // get_password();
    },
    afterEach: function(assert) {
        var done = assert.async();
        Rdbhost.reset_rdbhost(done, 'clean');
    }
});


// send super request, confirm with authorization dialog from alt location
//
QUnit.test('super request alt path', 4, function(assert) {

    var done = assert.async();

    var e = Rdbhost.super()
        .query('SELECT 1 AS a;')
        .form_data(new FormData());

    var p = e.get_data();
    ok(p.constructor.toString().indexOf('Promise') >= 0, p);
    p.then(function(d) {
            ok(false, 'then called');
            clearTimeout(st);
            done();
            done();
        })
        .catch(function(e) {
            ok(true, 'then error called');
            ok(e.message.substr(0, 11) === 'authorizati', 'cancellation '+ e.message);
            clearTimeout(st);
            done();
        });

    Rdbhost.once('form-displayed', function() {
        setTimeout(function () {
            var frm = document.getElementById('partial-super-auth'),
                cncl = frm.querySelector('.cancel');
            ok(frm.textContent.indexOf('ALTERNATE LOCAT') >= 0, 'ALTERN .. text found');
            cncl.click();
        }, 500)
    });

    var st = setTimeout(function() { done(); }, 5000);
});


module('Paranoid Form tests', {

    beforeEach: function (assert) {
        var done = assert.async();
        var domain = privat.getItem('domain'),
            acct_number = parseInt(privat.getItem('acct_number'), 10);
        demo_email = privat.getItem('demo_email');
        demo_pass = privat.getItem('demo_pass');

        Rdbhost.reset_rdbhost(done, 'clean');
        Rdbhost.paranoid_confirm = true;
        Rdbhost.connect(domain, acct_number);
    },
    afterEach: function(assert) {
        var done = assert.async();
        Rdbhost.reset_rdbhost(done, 'clean');
    }
});


// send super request, confirm authorization dialog
//
QUnit.test('super request http confirm-YES', 5, function(assert) {

    var done = assert.async();

    var fd = new FormData();
    var e = Rdbhost.super()
        .query('SELECT 1 AS a');

    var p = e.get_data();
    ok(p.constructor.toString().indexOf('Promise') >= 0, p);
    p.then(function(d) {
        ok(true, 'then called');

        var p1 = Rdbhost.super().query('SELECT 2 AS b;').form_data(fd).get_data();
        ok(p1.constructor.toString().indexOf('Promise') >= 0, p1);
        p1.then(function(d) {
                ok(true, '2nd request confirm not canceled');
                ok(d.status[1] === 'OK', d.status);
                clearTimeout(st);
                done();
            })
            .catch(function(e) {
                ok(false, '2nd request confirm canceled');
                clearTimeout(st);
                done();
            });

    });

    Rdbhost.once('form-displayed', function() {
        setTimeout(function () {
            var frm = document.getElementById('partial-super-auth'),
                eml = frm.querySelector("input[name='email']"),
                pw = frm.querySelector("input[name='password']"),
                sub = frm.querySelector("input[type='submit']");

            eml.value = demo_email;
            pw.value = demo_pass;

            setTimeout(function() {
                Rdbhost.once('form-displayed', function() {
                    setTimeout(function() {
                        var frm = document.getElementById('partial-confirm'),
                            nm = frm.querySelector('input[name="no_more"]'),
                            sub1 = frm.querySelector("input[type='submit']");

                        sub1.click();
                    }, 100)
                }, 500);
            }, 2);

            sub.click();
        }, 100);
    });

    var st = setTimeout(function() { done(); }, 5000);
});


// send super request, opt-out of confirm on first authorization dialog
//
QUnit.test('super request http confirm-Once-Only', 9, function(assert) {

    var done = assert.async();

    var fd = new FormData();
    var e = Rdbhost.super()
        .query('SELECT 1 AS a');

    var p = e.get_data();
    ok(p.constructor.toString().indexOf('Promise') >= 0, p);
    p.then(function(d) {
        ok(true, 'then called');

        var p1 = Rdbhost.super().query('SELECT 2 AS b;').form_data(fd).get_data();
        ok(p1.constructor.toString().indexOf('Promise') >= 0, p1);
        p1.then(function(d) {
            ok(true, '2nd request confirm not canceled');
            ok(d.status[1] === 'OK', d.status);

            var p2 = Rdbhost.super().query('SELECT 3 AS c;').form_data(fd).get_data();
            ok(p2.constructor.toString().indexOf('Promise') >= 0, p2);
            p2.then(function(d) {
                    ok(true, '3rd request confirm not canceled');
                    ok(d.status[1] === 'OK', d.status);
                    ok(!Rdbhost.paranoid_confirm, 'paranoid_confirm off');
                    clearTimeout(st);
                    done();
                });
            })
            .catch(function(e) {
                ok(false, '3rd request confirm canceled');
                clearTimeout(st);
                done();
            });

    });

    Rdbhost.once('form-displayed', function() {
        setTimeout(function () {
            var frm = document.getElementById('partial-super-auth'),
                eml = frm.querySelector("input[name='email']"),
                pw = frm.querySelector("input[name='password']"),
                sub = frm.querySelector("input[type='submit']");

            eml.value = demo_email;
            pw.value = demo_pass;

            setTimeout(function() {
                Rdbhost.once('form-displayed', function() {
                    setTimeout(function() {
                        var frm = document.getElementById('partial-confirm'),
                            nm = frm.querySelector('input[name="no_more"]'),
                            sub1 = frm.querySelector("input[type='submit']");

                        nm.checked = 'checked';
                        sub1.click();
                    }, 100)
                }, 500);
            }, 2);

            sub.click();
        }, 100);
    });

    var st = setTimeout(function() { done(); }, 5000);
});

var stache = {};
function json_reflector(json_getter) {

    var json = json_getter.call(this);
    stache['json'] = json;

    return Promise.resolve('{"done": true}');
}

QUnit.module('Interpolation tests', {

    beforeEach: function (assert) {
        console.log('beforeEach');
        var done = assert.async();
        domain = privat.getItem('domain');
        acct_number = parseInt(privat.getItem('acct_number'), 10);
        demo_email = privat.getItem('demo_email');
        demo_pass = privat.getItem('demo_pass');

        Rdbhost.reset_rdbhost(undefined, 'clean');
        Rdbhost.paranoid_confirm = false;
        Rdbhost.connect(domain, acct_number);

        for (var member in stache) delete stache[member];
        done();
    },
    afterEach: function(assert) {
        console.log('afterEach');
        var done = assert.async();

        Rdbhost.reset_rdbhost(done, 'clean');
    }
});

function on_partial_super_auth_submit() {
    Rdbhost.once('form-displayed', function() {
        setTimeout(function () {
            var frm = document.getElementById('partial-super-auth'),
                eml = frm.querySelector("input[name='email']"),
                pw = frm.querySelector("input[name='password']"),
                sub = frm.querySelector("input[type='submit']");

            eml.value = demo_email;
            pw.value = demo_pass;
            sub.click();
        }, 500)
    });
}

// send super request, with Fixed_Marker dialog
//
QUnit.test('super request Fixed_Marker', function(assert) {

    var done = assert.async();
    var e = Rdbhost.super(null, json_reflector)
        .query('SELECT %s, %s AS a;')
        .params([new Rdbhost.util.Fixed_Marker(1), 1]);

    var p = e.get_data();
    ok(p.constructor.toString().indexOf('Promise') >= 0, p);
    p.then(function(d) {
            ok(true, 'then called');
            clearTimeout(st);

            var data = JSON.parse(stache.json);
            ok(data.q === 'SELECT \'1\', %s AS a;', data.q);
            ok(data.args.length === 1, data.args);

            done();
        })
        .catch(function(e) {
            ok(false, 'then error called');
            clearTimeout(st);
            done();
        });

    on_partial_super_auth_submit();

    var st = setTimeout(function() { done(); }, 5000);
});



// send super request, with Column_Marker dialog
//
QUnit.test('super request Column_Marker', function(assert) {

    var done = assert.async();
    var e = Rdbhost.super(null, json_reflector)
        .query('SELECT %s, %s AS a;')
        .params([new Rdbhost.util.Column_Marker('abc'), 1]);

    var p = e.get_data();
    ok(p.constructor.toString().indexOf('Promise') >= 0, p);
    p.then(function(d) {
        ok(true, 'then called');
        clearTimeout(st);

        var data = JSON.parse(stache.json);
        ok(data.q === 'SELECT "_q_"."abc", %s AS a;', data.q);
        ok(data.args.length === 1, data.args);

        done();
    })
        .catch(function(e) {
            ok(false, 'then error called');
            clearTimeout(st);
            done();
        });

    on_partial_super_auth_submit();

    var st = setTimeout(function() { done(); }, 5000);
});


// send super request, with Null_Marker dialog
//
QUnit.test('super request Null_Marker', function(assert) {

    var done = assert.async();
    var e = Rdbhost.super(null, json_reflector)
        .query('SELECT %s, %s AS a;')
        .params([new Rdbhost.util.Null_Marker(), 1]);

    var p = e.get_data();
    ok(p.constructor.toString().indexOf('Promise') >= 0, p);
    p.then(function(d) {
            ok(true, 'then called');
            clearTimeout(st);

            var data = JSON.parse(stache.json);
            ok(data.q === 'SELECT NULL, %s AS a;', data.q);
            ok(data.args.length === 1, data.args);

            done();
        })
        .catch(function(e) {
            ok(false, 'then error called');
            clearTimeout(st);
            done();
        });

    on_partial_super_auth_submit();

    var st = setTimeout(function() { done(); }, 5000);
});



// send super request, with Bare_Marker dialog
//
QUnit.test('super request Bare_Marker', function(assert) {

    var done = assert.async();
    var e = Rdbhost.super(null, json_reflector)
        .query('SELECT %s, %s AS a;')
        .params([new Rdbhost.util.Bare_Marker(1), 1]);

    var p = e.get_data();
    ok(p.constructor.toString().indexOf('Promise') >= 0, p);
    p.then(function(d) {
            ok(true, 'then called');
            clearTimeout(st);

            var data = JSON.parse(stache.json);
            ok(data.q === 'SELECT 1, %s AS a;', data.q);
            ok(data.args.length === 1, data.args);
            ok(Object.keys(data.namedParams).length === 0, Object.keys(data.namedParams));

            done();
        })
        .catch(function(e) {
            ok(false, 'then error called');
            clearTimeout(st);
            done();
        });

    on_partial_super_auth_submit();

    var st = setTimeout(function() { done(); }, 5000);
});



// send super request, with Bare_Marker and named param
//
QUnit.test('super request named Bare_Marker', function(assert) {

    var done = assert.async();
    var e = Rdbhost.super(null, json_reflector)
        .query('SELECT %(abc)s, %(def)s AS a;')
        .params({abc: new Rdbhost.util.Bare_Marker(1), def:1});

    var p = e.get_data();
    ok(p.constructor.toString().indexOf('Promise') >= 0, p);
    p.then(function(d) {
            ok(true, 'then called');
            clearTimeout(st);

            var data = JSON.parse(stache.json);
            ok(data.q === 'SELECT 1, %(def)s AS a;', data.q);
            ok(data.args.length === 0, data.args);
            ok(data.namedParams.def === "1", data.namedParams.def);

            done();
        })
        .catch(function(e) {
            ok(false, 'then error called');
            clearTimeout(st);
            done();
        });

    on_partial_super_auth_submit();

    var st = setTimeout(function() { done(); }, 5000);
});




// send super request, with Subquery_Marker dialog
//
QUnit.test('super request Subquery_Marker', function(assert) {

    var t = {namedParams: {'a': 1}, args: []};

    var done = assert.async();
    var e = Rdbhost.super(null, json_reflector)
        .query('SELECT %s, %s AS a;')
        .params([new Rdbhost.util.Subquery_Marker(t, 'SELECT %(a)s;'), 1]);
    var p = e.get_data();

    ok(p.constructor.toString().indexOf('Promise') >= 0, p);
    p.then(function(d) {
        ok(true, 'then called');
        clearTimeout(st);

        var data = JSON.parse(stache.json);
        ok(data.q === 'SELECT (SELECT %(a)s) AS _q_, %s AS a;', data.q);
        ok(data.args.length === 1, data.args);
        ok(data.namedParams.a === "1", data.namedParams);

        done();
    })
    .catch(function(e) {
        ok(false, 'then error called '+e.message);
        clearTimeout(st);
        done();
    });

    on_partial_super_auth_submit();

    var st = setTimeout(function() { done(); }, 5000);
});




// send super request, with multiple wrappers
//
QUnit.test('super request multiple Wrapper', function(assert) {

    var t = {namedParams: {'a': 1}, args: []};

    var done = assert.async();
    var e = Rdbhost.super(null, json_reflector)
        .query('SELECT %s, %s, %(abc)s, %(hmm)s  AS a;')
        .params([new Rdbhost.util.Subquery_Marker(t, 'SELECT %(a)s;'), 1],
                 {abc: new Rdbhost.util.Fixed_Marker('alpha'),
                  hmm: new Rdbhost.util.Column_Marker('beta')});
    var p = e.get_data();

    ok(p.constructor.toString().indexOf('Promise') >= 0, p);
    p.then(function(d) {
            ok(true, 'then called');
            clearTimeout(st);

            var data = JSON.parse(stache.json);
            ok(data.q === 'SELECT (SELECT %(a)s) AS _q_, %s, \'alpha\', "_q_"."beta"  AS a;', data.q);
            ok(data.args.length === 1, data.args);
            ok(data.namedParams.a === "1", data.namedParams);
            done();
        })
        .catch(function(e) {
            ok(false, 'then error called '+e.message);
            clearTimeout(st);
            done();
        });

    on_partial_super_auth_submit();

    var st = setTimeout(function() { done(); }, 5000);
});






/*
*
*/
