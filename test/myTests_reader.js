
/*
*
* tests for the SQLEngine
*
*
*/
module('Connection tests', {

    setup: function () {
        Rdbhost.connect(domain, acct_number);
    },
    teardown: function() {
        Rdbhost.disconnect(1000, '');
    }
});

// create connection
asyncTest('connected event', function() {

    Rdbhost.once('connection-opened', function f() {
        ok('event', 'opened event received');
        Rdbhost.disconnect(1000, 'testing');
    });

    Rdbhost.once('connection-closed', function f() {
        ok('event', 'closed event received');
        clearTimeout(st);
        start();
    });

    var st = setTimeout(function() {
        ok(false, 'event received');
        start();
    }, 2000);

    Rdbhost.connect(domain, acct_number);
    var e = Rdbhost.preauth();
    ok(e, 'connection created');
    // ok('authCode' in e, 'conn has authCode attribute ');
    ok(e.role === 'preauth', 'role is preauth ');

});

module('Request tests', {

    setup: function () {
        Rdbhost.connect(domain, acct_number);
    },
    teardown: function() {
        Rdbhost.disconnect(1000, '');
    }
});

// send preauth request without query
test('request fail', 2, function() {

    var e = new Rdbhost.preauth();
    ok(e, 'connection created');
    try { e.go(); }
    catch (e) {
        ok(e.message === 'no query was provided', e.message);
    }
});

// send readerrequest with query, verify connection event
//
asyncTest('reader request ok', 5, function() {

    var e = Rdbhost.reader()
                   .query('SELECT 1 AS a');
    ok(e, 'connection created');

    Rdbhost.once('connection-opened:reader', function f() {

        ok('event', 'opened event received');
        var p = e.go();
        ok(p.constructor.name === 'lib$es6$promise$promise$$Promise', p);
        p.then(function(d) {
                ok(true, 'then called');
                ok(d.result_sets[0].rows[0].a === 1, d.status);
                clearTimeout(st);
                start();
            })
            .catch(function(e) {
                ok(false, 'then error called '+e.message);
                clearTimeout(st);
                start();
            })
    });

    var st = setTimeout(function() { start(); }, 5000);
});



// send reader request with query, verify promise fulfilled
//
asyncTest('reader request ok 2', 3, function() {

    var e = Rdbhost.reader()
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
            ok(false, 'then error called '+ e.message);
            clearTimeout(st);
            start();
        });

    var st = setTimeout(function() { start(); }, 5000);
});

// send reader request with repeated query, verify promise fulfilled
//
asyncTest('repeat request ok', 3, function() {

    var e = Rdbhost.reader()
                   .query('SELECT %s AS a')
                   .params([1,2])
                   .repeat(2);

    var p = e.go();
    ok(p.constructor.name === 'lib$es6$promise$promise$$Promise', p);
    p.then(function(d) {
            ok(true, 'then called');
            ok(d.result_sets.length === 2, d.result_sets.length);
            clearTimeout(st);
            start();
      })
      .catch(function(e) {
            ok(false, 'then error called '+ e.message);
            clearTimeout(st);
            start();
      });

    var st = setTimeout(function() { start(); }, 5000);
});


// send reader request with query multiple times by cloning, verify promise fulfilled
//
asyncTest('cloned request ok', 8, function() {

    var r1 = Rdbhost.reader()
        .query('SELECT %s AS a')
        .params([1]);

    var r2 = r1.clone().params([5]);

    var p1 = r1.go();
    ok(p1.constructor.name === 'lib$es6$promise$promise$$Promise', 'p1 is promise');
    var p1a = p1.then(function(d) {
            ok(true, 'then called');
            ok(d.result_sets.length === 1, d.result_sets.length);
            ok(d.result_sets[0].rows[0].a === '1', 'value1 '+d.result_sets[0].rows[0].a);
        })
        .catch(function(e) {
            ok(false, 'then error called '+ e.message);
        });

    var p2 = r2.go();
    ok(p2.constructor.name === 'lib$es6$promise$promise$$Promise', 'p2 is promise');
    var p2a = p2.then(function(d) {
            ok(true, 'then called');
            ok(d.result_sets.length === 1, d.result_sets.length);
            ok(d.result_sets[0].rows[0].a === '5', 'value2 '+d.result_sets[0].rows[0].a);
        })
        .catch(function(e) {
            ok(false, 'then error called '+ e.message);
        });

    Promise.all([p1a, p2a]).then(function(d) {
            clearTimeout(st);
            start();
        },
        function(e) {
            clearTimeout(st);
            start();
        });

    var st = setTimeout(function() { start(); }, 5000);
});


// send reader request with query multiple times by cloning, one failing, verify promise fulfilled
//
asyncTest('cloned request ok 2', 7, function() {

    var r1 = Rdbhost.reader()
        .query('SELECT %s AS a')
        .params([1]);

    var r2 = r1.clone().query('SLCT 1;');

    var p1 = r1.go();
    ok(p1.constructor.name === 'lib$es6$promise$promise$$Promise', 'p1 is promise');
    var p1a = p1.then(function(d) {
            ok(true, 'then called');
            ok(d.result_sets.length === 1, d.result_sets.length);
            ok(d.result_sets[0].rows[0].a === '1', 'value1 '+d.result_sets[0].rows[0].a);
        })
        .catch(function(e) {
            ok(false, 'then error called '+e.message);
        });

    var p2 = r2.go();
    ok(p2.constructor.name === 'lib$es6$promise$promise$$Promise', 'p2 is promise');
    var p2a = p2.then(function(d) {
            ok(false, 'then called');
        })
        .catch(function(e) {
            ok(true, 'then error called');
            ok(e.message.indexOf('syntax error at') >= 0, 'error message ok')
        });

    Promise.all([p1a, p2a]).then(function(d) {
            clearTimeout(st);
            start();
        },
        function(e) {
            clearTimeout(st);
            start();
        });

    var st = setTimeout(function() { start(); }, 5000);
});


// send reader request with query, verify promise fulfilled
//
asyncTest('proxy request ok', 3, function() {

    var e = Rdbhost.reader()
        .query('SELECT %s AS a')
        .params([1,2])
        .proxy('email');

    var p = e.go();
    ok(p.constructor.name === 'lib$es6$promise$promise$$Promise', p);
    p.then(function(d) {
            ok(false, 'then called');
            clearTimeout(st);
            start();
        })
        .catch(function(e) {
            ok(true, 'then error called');
            ok(e.message.substr(0, 11) === 'error rdb21', e.message);
            clearTimeout(st);
            start();
        });

    var st = setTimeout(function() { start(); }, 5000);
});




module('formData (fetch) tests', {

  setup: function () {
      Rdbhost.connect(domain, acct_number);
  },
  teardown: function() {
      Rdbhost.disconnect(1000, '');
  }
});


// send reader request as formData
//
asyncTest('formData reader request ok', 4, function() {

    var fData = new FormData();
    fData.append('arg000', '1');

    var e = Rdbhost.reader()
        .query('SELECT %s AS a')
        .form_data(fData);
    ok(e, 'connection created');

    var p = e.go();
    ok(p.constructor.name === 'lib$es6$promise$promise$$Promise', p);
    p.then(function(d) {
            ok(true, 'then called');
            ok(d.result_sets[0].rows[0].a === '1', d.status);
            clearTimeout(st);
            start();
        })
        .catch(function(e) {
            ok(false, 'then error called '+e.message);
            clearTimeout(st);
            start();
        });

    var st = setTimeout(function() { start(); }, 5000);
});


// send reader request as formData
//
asyncTest('listen/repeat conflict trapped', 4, function() {

    var fData = new FormData();
    fData.append('arg000', '1');

    var e = Rdbhost.reader()
        .query('SELECT %s AS a')
        .form_data(fData)
        .listen('abc')
        .repeat(2);

    ok(e, 'connection created');

    var p = e.go();
    ok(p.constructor.name === 'lib$es6$promise$promise$$Promise', 'promise is object');
    p.then(function(d) {
            ok(false, 'then called');
            clearTimeout(st);
            start();
        })
        .catch(function(e) {
            ok(true, 'then error called');
            ok(e.message.indexOf('listen and repeat cannot') >= 0, 'correct error message');
            clearTimeout(st);
            start();
        });

    var st = setTimeout(function() { start(); }, 5000);
});



/*
*
*/
