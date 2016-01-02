
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

module('Authorization tests', {

    setup: function () {
        Rdbhost.connect(domain, acct_number);
        get_password();
    },
    teardown: function() {
        Rdbhost.disconnect(1000, '');
    }
});

// send super request, cancel authorization dialog
//
asyncTest('super request cancel', 3, function() {

    var e = Rdbhost.super()
                   .query('SELECT 1 AS a');

    var p = e.go();
    ok(p.constructor.name === 'lib$es6$promise$promise$$Promise', p);
    p.then(function(d) {
            ok(false, 'then called');
            clearTimeout(st);
            start();
        })
        .catch(function(e) {
            ok(true, 'then error called');
            ok(e.message.substr(0, 11) === 'authorizati', 'cancellation ');
            clearTimeout(st);
            start();
        });

    setTimeout(function() {
        var frm = document.getElementById('super-auth'),
            cncl = frm.querySelector('.cancel');
        cncl.click();
    }, 500);

    var st = setTimeout(function() { start(); }, 5000);
});


// send super request, confirm with authorization dialog
//
asyncTest('super request confirm', 3, function() {

    var e = Rdbhost.super()
        .query('SELECT 1 AS a');

    var p = e.go();
    ok(p.constructor.name === 'lib$es6$promise$promise$$Promise', p);
    p.then(function(d) {
            ok(true, 'then called');
            ok(d.result_sets[0].rows[0].a === 1, d.status);
            clearTimeout(st);
            start();
        })
        .catch(function(e) {
            ok(false, 'then error called');
            clearTimeout(st);
            start();
        });

    setTimeout(function() {
        var frm = document.getElementById('super-auth'),
            eml = frm.querySelector("input[name='email']"),
            pw = frm.querySelector("input[name='password']"),
            sub = frm.querySelector("input[type='submit']");

        eml.value = demo_email;
        pw.value = get_password();
        sub.click();
    }, 500);

    var st = setTimeout(function() { start(); }, 5000);
});


// send super request, confirm with authorization dialog
//
asyncTest('super request http confirm', 3, function() {

    var e = Rdbhost.super()
        .query('SELECT 1 AS a;')
        .form_data(new FormData());

    var p = e.go();
    ok(p.constructor.name === 'lib$es6$promise$promise$$Promise', p);
    p.then(function(d) {
            ok(true, 'then called');
            ok(d.result_sets[0].rows[0].a === 1, d.status);
            clearTimeout(st);
            start();
        })
        .catch(function(e) {
            ok(false, 'then error called');
            clearTimeout(st);
            start();
        });

    setTimeout(function() {
        var frm = document.getElementById('super-auth'),
            eml = frm.querySelector("input[name='email']"),
            pw = frm.querySelector("input[name='password']"),
            sub = frm.querySelector("input[type='submit']");

        eml.value = demo_email;
        pw.value = get_password();
        sub.click();
    }, 500);

    var st = setTimeout(function() { start(); }, 5000);
});



// send super request, confirm with authorization dialog
//
asyncTest('super request http cancel', 3, function() {

    var e = Rdbhost.super()
        .query('SELECT 1 AS a;')
        .form_data(new FormData());

    var p = e.go();
    ok(p.constructor.name === 'lib$es6$promise$promise$$Promise', p);
    p.then(function(d) {
            ok(false, 'then called');
            clearTimeout(st);
            start();
        })
        .catch(function(e) {
            ok(true, 'then error called');
            ok(e.message.substr(0, 11) === 'authorizati', 'cancellation ');
            clearTimeout(st);
            start();
        });

    setTimeout(function() {
        var frm = document.getElementById('super-auth'),
            cncl = frm.querySelector('.cancel');
        cncl.click();
    }, 500);

    var st = setTimeout(function() { start(); }, 5000);
});





/*
*
*/
