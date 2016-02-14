
/*
*
* tests for the SQLEngine
*
*
*/

PASSWORD = undefined;

function get_password() {

    if ( ! PASSWORD )
        PASSWORD = 'horosh00'; //prompt('password');
    return PASSWORD;
}


module('Confirm tests', {

    setup: function () {
        Rdbhost.connect(domain, acct_number);
        get_password();
        Rdbhost.paranoidConfirm = true;
    },
    teardown: function() {
        QUnit.stop();
        Rdbhost.once('connection-closed:super', function() {
            QUnit.start()
        });
        Rdbhost.disconnect(1000, '');
    }
});

// send super request via http, cancel authorization dialog
//
asyncTest('super request http cancel-confirm', 4, function() {

    var fd = new FormData();
    var e = Rdbhost.super()
        .query('SELECT 1 AS a');

    var p = e.go();
    ok(p.constructor.toString().indexOf('Promise') >= 0, p);
    p.then(function(d) {
            ok(true, 'then called');

            var p1 = Rdbhost.super().query('SELECT 2 AS b;').form_data(fd).go();
            ok(p1.constructor.toString().indexOf('Promise') >= 0, p1);
            p1.then(function(d) {
                    ok(false, '2nd request confirm not canceled');
                    clearTimeout(st);
                    start();
                })
                .catch(function(e) {
                    ok(true, '2nd request confirm canceled');
                    clearTimeout(st);
                    start();
                });

        })
        .catch(function(e) {
            ok(false, 'cancel error thrown on prep')
        });

    //setTimeout(function() {
    //    var frm = document.getElementById('partial-super-confirm'),
    //        sub = frm.querySelector("input[type='submit']");
    //    sub.click();
    //}, 500);

    setTimeout(function() {
        var frm = document.getElementById('partial-super-auth'),
            eml = frm.querySelector("input[name='email']"),
            pw = frm.querySelector("input[name='password']"),
            sub = frm.querySelector("input[type='submit']");

        eml.value = demo_email;
        pw.value = get_password();
        sub.click();
    }, 1000);

    setTimeout(function() {
        var frm = document.getElementById('partial-super-confirm'),
            cncl = frm.querySelector('.cancel');
        cncl.click();
    }, 1500);

    var st = setTimeout(function() { start(); }, 5000);
});


// send super request, cancel authorization dialog
//
asyncTest('super request http confirm-YES', 5, function() {

    var fd = new FormData();
    var e = Rdbhost.super()
        .query('SELECT 1 AS a');

    var p = e.go();
    ok(p.constructor.toString().indexOf('Promise') >= 0, p);
    p.then(function(d) {
        ok(true, 'then called');

        var p1 = Rdbhost.super().query('SELECT 2 AS b;').form_data(fd).go();
        ok(p1.constructor.toString().indexOf('Promise') >= 0, p1);
        p1.then(function(d) {
                ok(true, '2nd request confirm not canceled');
                ok(d.status[1] === 'OK', d.status);
                clearTimeout(st);
                start();
            })
            .catch(function(e) {
                ok(false, '2nd request confirm canceled');
                clearTimeout(st);
                start();
            });

    });

    setTimeout(function() {
        var frm = document.getElementById('partial-super-auth'),
            eml = frm.querySelector("input[name='email']"),
            pw = frm.querySelector("input[name='password']"),
            sub = frm.querySelector("input[type='submit']");

        eml.value = demo_email;
        pw.value = get_password();
        sub.click();
    }, 500);

    setTimeout(function() {
        var frm = document.getElementById('partial-super-confirm'),
            sub = frm.querySelector("input[type='submit']");
        sub.click();
    }, 1000);


    var st = setTimeout(function() { start(); }, 5000);
});


// send super request via ws, cancel authorization dialog
//
asyncTest('super request ws cancel-confirm', 4, function() {

    var e = Rdbhost.super()
        .query('SELECT 1 AS a');

    var p = e.go();
    ok(p.constructor.toString().indexOf('Promise') >= 0, p);
    p.then(function(d) {
        ok(true, 'then called');

        var p1 = Rdbhost.super().query('SELECT 2 AS b;').go();
        ok(p1.constructor.toString().indexOf('Promise') >= 0, p1);
        p1.then(function(d) {
                ok(false, '2nd request confirm not canceled');
                clearTimeout(st);
                start();
            })
            .catch(function(e) {
                ok(true, '2nd request confirm canceled');
                clearTimeout(st);
                start();
            });

    });

    setTimeout(function() {
        var frm = document.getElementById('partial-super-auth'),
            eml = frm.querySelector("input[name='email']"),
            pw = frm.querySelector("input[name='password']"),
            sub = frm.querySelector("input[type='submit']");

        eml.value = demo_email;
        pw.value = get_password();
        sub.click();
    }, 500);

    setTimeout(function() {
        var frm = document.getElementById('partial-super-confirm'),
            cncl = frm.querySelector('.cancel');
        cncl.click();
    }, 1000);

    var st = setTimeout(function() { start(); }, 5000);
});


// send super request, cancel authorization dialog
//
asyncTest('super request ws confirm-YES', 5, function() {

    var e = Rdbhost.super()
        .query('SELECT 1 AS a');

    var p = e.go();
    ok(p.constructor.toString().indexOf('Promise') >= 0, p);
    p.then(function(d) {
        ok(true, 'then called');

        var p1 = Rdbhost.super().query('SELECT 2 AS b;').go();
        ok(p1.constructor.toString().indexOf('Promise') >= 0, p1);
        p1.then(function(d) {
                ok(true, '2nd request confirm not canceled');
                ok(d.status[1] === 'OK', d.status);
                clearTimeout(st);
                start();
            })
            .catch(function(e) {
                ok(false, '2nd request confirm canceled');
                clearTimeout(st);
                start();
            });

    });

    setTimeout(function() {
        var frm = document.getElementById('partial-super-auth'),
            eml = frm.querySelector("input[name='email']"),
            pw = frm.querySelector("input[name='password']"),
            sub = frm.querySelector("input[type='submit']");

        eml.value = demo_email;
        pw.value = get_password();
        sub.click();
    }, 500);

    setTimeout(function() {
        var frm = document.getElementById('partial-super-confirm'),
            sub = frm.querySelector("input[type='submit']");
        sub.click();
    }, 1000);


    var st = setTimeout(function() { start(); }, 5000);
});


/*
*
*/
