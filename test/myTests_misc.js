

PASSWORD = undefined;

function get_password() {

    if ( ! PASSWORD )
        PASSWORD = 'horosh00'; //prompt('password');
    return PASSWORD;
}


module('CorsTest tests', {

    setup: function () {
        Rdbhost.connect(domain, bad_acct_number);
    },
    teardown: function() {
        Rdbhost.disconnect(1000, '');
    }
});

// /acct/corstest

// send preauth request with query, verify promise fulfilled with error
//
asyncTest('reader wrong-account request', 4, function() {

    var e = Rdbhost.reader()
        .form_data(new FormData())
        .query('SELECT 1 AS a; /* testing-delete */');

    var p = e.go();
    ok(p.constructor.toString().indexOf('Promise') >= 0, p);
    p.then(function(d) {
            ok(false, 'then called');
            clearTimeout(st);
            start();
        })
        .catch(function(e) {
            ok(true, 'then error called');
            ok(e.message.toLowerCase().indexOf('failed')>=0, e.message);
            clearTimeout(st);
            setTimeout(function() {

                start();
            }, 100);
        });

    Rdbhost.once('connection-open-failed', function(evt) {
        ok(true, 'connection-open-failed event emitted');
    });

    var st = setTimeout(function() {
        start();
    }, 50000);
});


module('Alternate Template Location tests', {

    setup: function () {
        var path = window.location.pathname.replace('/test_runner_misc.html', '/tpl/');
        Rdbhost.connect(domain, acct_number, window.location.origin + path);
        get_password();
    },
    teardown: function() {
        QUnit.stop();
        Rdbhost.once('connection-closed:super', function() {
            QUnit.start()
        });
        Rdbhost.disconnect(1000, '');
    }
});


// send super request, confirm with authorization dialog from alt location
//
asyncTest('super request alt path', 4, function() {

    var e = Rdbhost.super()
        .query('SELECT 1 AS a;')
        .form_data(new FormData());

    var p = e.go();
    ok(p.constructor.toString().indexOf('Promise') >= 0, p);
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
        var frm = document.getElementById('partial-super-auth'),
            cncl = frm.querySelector('.cancel');
        ok(frm.innerText.indexOf('ALTERNATE LOCAT') >= 0, 'ALTERN .. text found');
        cncl.click();
    }, 500);

    var st = setTimeout(function() { start(); }, 5000);
});



/*
*
*/
