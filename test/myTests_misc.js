

PASSWORD = undefined;


module('CorsTest tests', {

    beforeEach: function () {
        var domain = private.getItem('domain'),
            acct_number = private.getItem('acct_number');
        Rdbhost.connect(domain, 1);
    },
    afterEach: function() {
        Rdbhost.disconnect(1000, '');
    }
});

// /acct/corstest

// send preauth request with query, verify promise fulfilled with error
//
test('reader wrong-account request', 4, function(assert) {

    var done = assert.async();

    var e = Rdbhost.reader()
        .form_data(new FormData())
        .query('SELECT 1 AS a; /* testing-delete */');

    var p = e.go();
    ok(p.constructor.toString().indexOf('Promise') >= 0, p);
    p.then(function(d) {
            ok(false, 'then called');
            clearTimeout(st);
            done();
        })
        .catch(function(e) {
            ok(true, 'then error called');
            ok(e.message.toLowerCase().indexOf('failed')>=0 || e.message.toLowerCase().indexOf('error')>=0, e.message);
            clearTimeout(st);
            setTimeout(function() {

                done();
            }, 100);
        });

    Rdbhost.once('connection-open-failed', function(evt) {
        ok(true, 'connection-open-failed event emitted');
    });

    var st = setTimeout(function() {
        done();
    }, 50000);
});


module('Alternate Template Location tests', {

    beforeEach: function (assert) {
        var domain = private.getItem('domain'),
            acct_number = parseInt(private.getItem('acct_number'), 10);

        if (!window.location.origin) {
            window.location.origin = window.location.protocol + "//" + window.location.hostname +
                (window.location.port ? ':' + window.location.port: '');
        }
        var path = window.location.pathname.replace('/test_runner_misc.html', '/tpl/');
        Rdbhost.connect(domain, acct_number, window.location.origin + path);
        // get_password();
    },
    afterEach: function(assert) {
        var done = assert.async();
        Rdbhost.once('connection-closed:super', function() {
            done();
        });
        Rdbhost.disconnect(1000, '');
    }
});


// send super request, confirm with authorization dialog from alt location
//
test('super request alt path', 4, function(assert) {

    var done = assert.async();

    var e = Rdbhost.super()
        .query('SELECT 1 AS a;')
        .form_data(new FormData());

    var p = e.go();
    ok(p.constructor.toString().indexOf('Promise') >= 0, p);
    p.then(function(d) {
            ok(false, 'then called');
            clearTimeout(st);
            done();
        })
        .catch(function(e) {
            ok(true, 'then error called');
            ok(e.message.substr(0, 11) === 'authorizati', 'cancellation '+ e.message);
            clearTimeout(st);
            done();
        });

    setTimeout(function() {
        var frm = document.getElementById('partial-super-auth'),
            cncl = frm.querySelector('.cancel');
        ok(frm.textContent.indexOf('ALTERNATE LOCAT') >= 0, 'ALTERN .. text found');
        cncl.click();
    }, 500);

    var st = setTimeout(function() { done(); }, 5000);
});



/*
*
*/
