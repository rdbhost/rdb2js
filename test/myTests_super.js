
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
        Rdbhost.connect(domain, acct_number);
        done();
    },
    afterEach: function(assert) {
        console.log('afterEach');
        var done = assert.async();

        Rdbhost.reset_rdbhost(done)
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
            ok(d.result_sets[0].rows[0].b === 1, d.status);
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
            ok(d.result_sets[0].rows[0].c === 1, d.status);
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
        Rdbhost.connect(domain, acct_number);
        // get_password();

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
        Rdbhost.reset_rdbhost(done);
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
        Rdbhost.connect(domain, acct_number);
        Rdbhost.paranoid_confirm = true;
    },
    afterEach: function(assert) {
        var done = assert.async();
        Rdbhost.reset_rdbhost(done);
    }
});

// send super request via http, cancel authorization dialog
//
test('super request http cancel-confirm', 4, function(assert) {

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
            ok(false, 'cancel error thrown on prep')
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
        }, 1000)
    });

    setTimeout(function() {
        var frm = document.getElementById('partial-confirm'),
            cncl = frm.querySelector('.cancel');
        cncl.click();
    }, 1500);

    var st = setTimeout(function() { done(); }, 5000);
});


// send super request, cancel authorization dialog
//
test('super request http confirm-YES', 5, function(assert) {

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
            sub.click();
        }, 500)
    });

    setTimeout(function() {
        var frm = document.getElementById('partial-confirm'),
            sub = frm.querySelector("input[type='submit']");
        sub.click();
    }, 1000);


    var st = setTimeout(function() { done(); }, 5000);
});


// send super request via ws, cancel authorization dialog
//
test('super request ws cancel-confirm', 4, function(assert) {

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
        }, 500)
    });

    setTimeout(function() {
        var frm = document.getElementById('partial-confirm'),
            cncl = frm.querySelector('.cancel');
        cncl.click();
    }, 1000);

    var st = setTimeout(function() { done(); }, 5000);
});


// send super request, cancel authorization dialog
//
test('super request ws confirm-YES', 5, function(assert) {

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
        }, 500)
    });

    setTimeout(function() {
        var frm = document.getElementById('partial-confirm'),
            sub = frm.querySelector("input[type='submit']");
        sub.click();
    }, 1000);


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
        Rdbhost.connect(domain, acct_number, window.location.origin + path);
        // get_password();
    },
    afterEach: function(assert) {
        var done = assert.async();
        Rdbhost.reset_rdbhost(done);
    }
});


// send super request, confirm with authorization dialog from alt location
//
test('super request alt path', 4, function(assert) {

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



/*
*
*/
