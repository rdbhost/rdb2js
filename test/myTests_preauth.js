
/*
*
* tests for the SQLEngine
*
*
*/

var demo_pass, demo_email, domain, acct_number;

// PASSWORD = undefined;
SUPER_AUTH = undefined;



module('Authorization tests', {

    beforeEach: function () {
        QUnit.stop();

        domain = privat.getItem('domain');
        acct_number = parseInt(privat.getItem('acct_number'), 10);
        demo_email = privat.getItem('demo_email');
        demo_pass = privat.getItem('demo_pass');

        Rdbhost.reset_rdbhost(undefined, 'clean');
        Rdbhost.paranoid_confirm = false;
        Rdbhost.connect(domain, acct_number);
        // get_password();
        var p = get_super_auth(acct_number, demo_email, demo_pass);
        p.then(function(d){
            SUPER_AUTH = d.authcode;
            var p1 = Rdbhost.super(SUPER_AUTH)
                .query("DELETE FROM lookup.preauth_queries WHERE query LIKE '%%/* testing-delete */%%';")
                .get_data();
            p1.then(function(d) {
                    QUnit.start();
                }, function(e) {
                    QUnit.start();
                });
        });
    },
    afterEach: function() {
        QUnit.stop();
        Rdbhost.disconnect(1000, '');
        setTimeout(function() {
            QUnit.start()
        }, 500);
    }
});



// send preauth request with query, verify promise fulfilled with error
//
QUnit.test('preauth request cancel', 3, function(assert) {

    var done = assert.async();
    var e = Rdbhost.preauth()
        .query('SELECT 1 AS a; /* testing-delete */');

    var p = e.get_data();
    ok(p.constructor.toString().indexOf('Promise') >= 0, p);
    p.then(function(d) {
            ok(false, 'then called');
            clearTimeout(st);
            done();
        })
        .catch(function(e) {
            ok(true, 'then error called');
            ok(e.message.substr(0, 11) === 'authorizati', e.message);
            clearTimeout(st);
            done();
        });

    Rdbhost.once('form-displayed', function() {
        setTimeout(function() {

            var frm = document.getElementById('partial-preauth-auth'),
                cncl = frm.querySelector('.cancel');
            cncl.click();
        }, 100)
    });

    var st = setTimeout(function() { done(); }, 15000);
});


// send preauth request, confirm with authorization dialog
//
QUnit.test('preauth request confirm', 3, function(assert) {

    var done = assert.async();
    var e = Rdbhost.preauth()
        .query('SELECT 1 AS a; /* testing-delete */');

    var p = e.get_data();
    ok(p.constructor.toString().indexOf('Promise') >= 0, p);
    p.then(function(d) {
            ok(true, 'then called');
            ok(d.result_sets[0].records.rows[0].a === 1, d.status);
            clearTimeout(st);
            done();
        })
        .catch(function(e) {
            ok(false, 'then error called');
            clearTimeout(st);
            done();
        });

    Rdbhost.once('form-displayed', function() {
        setTimeout(function() {

            var frm = document.getElementById('partial-preauth-auth');
            if ( !frm )
                return;

            var eml = frm.querySelector("input[name='email']"),
                pw = frm.querySelector("input[name='password']"),
                sub = frm.querySelector("input[type='submit']");

            eml.value = demo_email;
            pw.value = privat.getItem('demo_pass'); //get_password();
            sub.click();
        }, 100)
    });

    var st = setTimeout(function() { done(); }, 15000);
});


module('Paranoid Form tests', {

    beforeEach: function (assert) {
        var done = assert.async();
        var domain = privat.getItem('domain'),
            acct_number = parseInt(privat.getItem('acct_number'), 10);
        demo_email = privat.getItem('demo_email');
        demo_pass = privat.getItem('demo_pass');

        Rdbhost.reset_rdbhost(null, 'clean');
        Rdbhost.paranoid_confirm = false;
        Rdbhost.connect(domain, acct_number);

        var p = get_super_auth(acct_number, demo_email, demo_pass);
        p.then(function(d){
            SUPER_AUTH = d.authcode;
            var p1 = Rdbhost.super(SUPER_AUTH)
                .query("DELETE FROM lookup.preauth_queries WHERE query LIKE '%%/* testing-delete */%%';")
                .get_data();
            p1.then(function(d) {
                Rdbhost.paranoid_confirm = true;
                Rdbhost.reset_rdbhost(done, 'clean');
                Rdbhost.connect(domain, acct_number);
                // QUnit.start();
            }, function(e) {
                Rdbhost.paranoid_confirm = true;
                Rdbhost.reset_rdbhost(done, 'clean');
                Rdbhost.connect(domain, acct_number);
                // QUnit.start();
            });
        });
    },
    afterEach: function(assert) {
        var done = assert.async();
        Rdbhost.reset_rdbhost(done, 'clean');
    }
});


// send preauth request, confirm authorization dialog
//
QUnit.test('preauth request http confirm-YES', 5, function(assert) {

    var done = assert.async();

    var fd = new FormData();
    var e = Rdbhost.preauth()
        .query('SELECT 1 AS a /* testing-delete */');

    var p = e.get_data();
    ok(p.constructor.toString().indexOf('Promise') >= 0, p);
    p.then(function(d) {
        ok(true, 'then called');

        var p1 = Rdbhost.preauth().query('SELECT 2 AS b;').form_data(fd).get_data();
        ok(p1.constructor.toString().indexOf('Promise') >= 0, p1);
        p1.then(function(d) {
            ok(true, '2nd request confirm not canceled');
            ok(d.status[1] === 'OK', d.status);
            clearTimeout(st);
            done();
        })
            .catch(function(e) {
                ok(false, '2nd request confirm canceled '+e.message);
                clearTimeout(st);
                done();
            });

    });

    Rdbhost.once('form-displayed', function() {
        setTimeout(function () {
            var frm = document.getElementById('partial-preauth-auth'),
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


// send preauth request, confirm with authorization dialog
//
QUnit.test('preauth request confirm NO', 5, function(assert) {

    var done = assert.async();
    var e = Rdbhost.preauth()
        .query('SELECT 1 AS a; /* testing-delete */');

    var p = e.get_data();
    ok(p.constructor.toString().indexOf('Promise') >= 0, p);
    p.then(function(d) {
            ok(true, 'then called');
            ok(d.result_sets[0].records.rows[0].a === 1, d.status);

            var p1 = Rdbhost.preauth().query('SELECT 2 AS b; /* testing-delete */').get_data();
            ok(p1.constructor.toString().indexOf('Promise') >= 0, p1);
            p1.then(function(d) {
                    ok(false, '2nd request confirm not canceled');
                    ok(d.status[1] === 'OK', d.status);

                })
                .catch(function(e) {
                    ok(true, 'cancelled');
                    clearTimeout(st);
                    done();
                })
        })
        .catch(function(e) {
            ok(false, 'then error called');
            clearTimeout(st);
            done();
        });

    Rdbhost.once('form-displayed', function() {
        setTimeout(function() {

            var frm = document.getElementById('partial-preauth-auth');
            if ( !frm )
                return;

            var eml = frm.querySelector("input[name='email']"),
                pw = frm.querySelector("input[name='password']"),
                sub = frm.querySelector("input[type='submit']");

            eml.value = demo_email;
            pw.value = privat.getItem('demo_pass'); //get_password();

            setTimeout(function() {
                Rdbhost.once('form-displayed', function() {
                    setTimeout(function() {
                        var frm = document.getElementById('partial-confirm'),
                            cncl = frm.querySelector('.cancel');

                        cncl.click();
                    }, 100)
                });
            }, 2);


            sub.click();
        }, 100)
    });

    var st = setTimeout(function() { done(); }, 15000);
});




/*
*
*/
