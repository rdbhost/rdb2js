
/*
*
* tests for the SQLEngine
*
*
*/

var domain, acct_number;

module('Connection tests', {

    beforeEach: function () {
        domain = privat.getItem('domain');
        acct_number = parseInt(privat.getItem('acct_number'), 10);
        Rdbhost.connect(domain, acct_number);
    },
    afterEach: function() {
        Rdbhost.disconnect(1000, '');
    }
});

// create connection
test('connected event', function(assert){

    var done = assert.async();

    Rdbhost.once('connection-opened', function f() {
        ok('event', 'opened event received');
        Rdbhost.disconnect(1000, 'testing');
    });

    Rdbhost.once('connection-closed', function f() {
        ok('event', 'closed event received');
        clearTimeout(st);
        done();
    });

    var st = setTimeout(function() {
        ok(false, 'event received');
        done();
    }, 2000);

    Rdbhost.connect(domain, acct_number);
    var e = Rdbhost.preauth();
    ok(e, 'connection created');
    // ok('authCode' in e, 'conn has authCode attribute ');
    ok(e.role === 'preauth', 'role is preauth ');

});

module('Request tests', {

    beforeEach: function () {
        domain = privat.getItem('domain');
        acct_number = parseInt(privat.getItem('acct_number'), 10);
        Rdbhost.reset_rdbhost(undefined, 'clean');
        Rdbhost.paranoid_confirm = false;
        Rdbhost.connect(domain, acct_number);
    },
    afterEach: function() {
        Rdbhost.disconnect(1000, '');
    }
});

// send preauth request without query
test('request fail', 2, function() {

    var e = new Rdbhost.preauth();
    ok(e, 'connection created');
    try { e.get_data(); }
    catch (e) {
        ok(e.message === 'no query was provided', e.message);
    }
});

// send readerrequest with query, verify connection event
//
test('reader request ok', 5, function(assert){

    var done = assert.async();

    var e = Rdbhost.reader()
                   .query('SELECT 1 AS a');
    ok(e, 'connection created');

    Rdbhost.once('connection-opened:reader', function f() {

        ok('event', 'opened event received');
        var p = e.get_data();
        ok(p.constructor.toString().indexOf('Promise') >= 0, 'promise is Promise');
        p.then(function(d) {
                ok(true, 'then called');
                ok(d.result_sets[0].rows[0].a === 1, d.status);
                clearTimeout(st);
                done();
            })
            .catch(function(e) {
                ok(false, 'then error called '+e.message);
                clearTimeout(st);
                done();
            })
    });

    var st = setTimeout(function() { done(); }, 5000);
});



// send reader request with query, verify promise fulfilled
//
test('reader request ok 2', 3, function(assert){

    var done = assert.async();

    var e = Rdbhost.reader()
                   .query('SELECT 1 AS a');

    var p = e.get_data();
    ok(p.constructor.toString().indexOf('Promise') >= 0, 'promise is Promise');
    p.then(function(d) {
            ok(true, 'then called');
            ok(d.result_sets[0].rows[0].a === 1, d.status);
            clearTimeout(st);
            done();
        })
        .catch(function(e) {
            ok(false, 'then error called '+ e.message);
            clearTimeout(st);
            done();
        });

    var st = setTimeout(function() { done(); }, 5000);
});

// send reader request with query and namedParams, verify promise fulfilled
//
test('reader request ok namedParams', 3, function(assert){

    var done = assert.async();

    var e = Rdbhost.reader()
        .query('SELECT %(b)s AS a')
        .params({'b': 1});

    var p = e.get_data();
    ok(p.constructor.toString().indexOf('Promise') >= 0, 'promise is Promise');
    p.then(function(d) {
            ok(true, 'then called');
            ok(d.result_sets[0].rows[0].a === '1', d.status);
            clearTimeout(st);
            done();
        })
        .catch(function(e) {
            ok(false, 'then error called '+ e.message);
            clearTimeout(st);
            done();
        });

    var st = setTimeout(function() { done(); }, 5000);
});

// send reader request with query and namedParams, verify promise fulfilled
//
test('reader request ok args', 3, function(assert){

    var done = assert.async();

    var e = Rdbhost.reader()
        .query('SELECT %s AS a')
        .params([1]);

    var p = e.get_data();
    ok(p.constructor.toString().indexOf('Promise') >= 0, 'promise is Promise');
    p.then(function(d) {
            ok(true, 'then called');
            ok(d.result_sets[0].rows[0].a === '1', d.status);
            clearTimeout(st);
            done();
        })
        .catch(function(e) {
            ok(false, 'then error called '+ e.message);
            clearTimeout(st);
            done();
        });

    var st = setTimeout(function() { done(); }, 5000);
});

// send reader request with repeated query, verify promise fulfilled
//
test('repeat request ok', 4, function(assert){

    var done = assert.async();

    var e = Rdbhost.reader()
                   .query('SELECT %s AS a')
                   .params([1,2])
                   .repeat(2);

    var p = e.get_data();
    ok(p.constructor.toString().indexOf('Promise') >= 0, 'promise is Promise');
    p.then(function(d) {
          ok(true, 'then called');
          ok(d.result_sets.length === 2, d.result_sets.length);

          var p1 = e.clone().repeat().get_data();
          p1.then(function(d1) {
              ok(d1.result_sets.length == 1, 'result_sets_length === 1');
              clearTimeout(st);
              done();
          });
      })
      .catch(function(e) {
          ok(false, 'then error called '+ e.message);
          clearTimeout(st);
          done();
      });

    var st = setTimeout(function() { done(); }, 5000);
});


// send reader request with query multiple times by cloning, verify promise fulfilled
//
test('cloned request ok', 8, function(assert){

    var done = assert.async();

    var r1 = Rdbhost.reader()
        .query('SELECT %s AS a')
        .params([1]);

    var r2 = r1.clone().params([5]);

    var p1 = r1.get_data();
    ok(p1.constructor.toString().indexOf('Promise') >= 0, 'promise is Promise');
    var p1a = p1.then(function(d) {
            ok(true, 'then called');
            ok(d.result_sets.length === 1, d.result_sets.length);
            ok(d.result_sets[0].rows[0].a === '1', 'value1 '+d.result_sets[0].rows[0].a);
        })
        .catch(function(e) {
            ok(false, 'then error called '+ e.message);
        });

    var p2 = r2.get_data();
    ok(p2.constructor.toString().indexOf('Promise') >= 0, 'promise is Promise');
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
            done();
        },
        function(e) {
            clearTimeout(st);
            done();
        });

    var st = setTimeout(function() { done(); }, 5000);
});


// send reader request with query multiple times by cloning, one failing, verify promise fulfilled
//
test('cloned request ok 2', 7, function(assert){

    var done = assert.async();

    var r1 = Rdbhost.reader()
        .query('SELECT %s AS a')
        .params([1]);

    var r2 = r1.clone().query('SLCT 1;');

    var p1 = r1.get_data();
    ok(p1.constructor.toString().indexOf('Promise') >= 0, 'promise is Promise');
    var p1a = p1.then(function(d) {
            ok(true, 'then called');
            ok(d.result_sets.length === 1, d.result_sets.length);
            ok(d.result_sets[0].rows[0].a === '1', 'value1 '+d.result_sets[0].rows[0].a);
        })
        .catch(function(e) {
            ok(false, 'then error called '+e.message);
        });

    var p2 = r2.get_data();
    ok(p2.constructor.toString().indexOf('Promise') >= 0, 'promise is Promise');
    var p2a = p2.then(function(d) {
            ok(false, 'then called');
        })
        .catch(function(e) {
            ok(true, 'then error called');
            ok(e.message.indexOf('syntax error at') >= 0, 'error message ok')
        });

    Promise.all([p1a, p2a]).then(function(d) {
            clearTimeout(st);
            done();
        },
        function(e) {
            clearTimeout(st);
            done();
        });

    var st = setTimeout(function() { done(); }, 5000);
});


// send reader request with query, verify promise fulfilled
//
test('proxy request ok', 3, function(assert){

    var done = assert.async();

    var e = Rdbhost.reader()
        .query('SELECT %s AS a')
        .params([1,2])
        .proxy('email');

    var p = e.get_data();
    ok(p.constructor.toString().indexOf('Promise') >= 0, 'promise is Promise');
    p.then(function(d) {
            ok(false, 'then called');
            clearTimeout(st);
            done();
        })
        .catch(function(e) {
            ok(true, 'then error called');
            ok(e.message.substr(0, 5) === 'rdb21', e.message);
            clearTimeout(st);
            done();
        });

    var st = setTimeout(function() { done(); }, 5000);
});




module('formData (fetch) tests', {

  beforeEach: function () {
      domain = privat.getItem('domain');
      acct_number = parseInt(privat.getItem('acct_number'), 10);
      Rdbhost.connect(domain, acct_number);
  },
  afterEach: function() {
      Rdbhost.disconnect(1000, '');
  }
});


// send reader request as formData
//
test('formData reader request ok', 4, function(assert){

    var done = assert.async();

    var fData = new FormData();
    fData.append('arg000', '1');

    var e = Rdbhost.reader()
        .query('SELECT %s AS a')
        .form_data(fData);
    ok(e, 'connection created');

    var p = e.get_data();
    ok(p.constructor.toString().indexOf('Promise') >= 0, 'promise is Promise');
    p.then(function(d) {
            ok(true, 'then called');
            ok(d.result_sets[0].rows[0].a === '1', d.status);
            clearTimeout(st);
            done();
        })
        .catch(function(e) {
            ok(false, 'then error called '+e.message);
            clearTimeout(st);
            done();
        });

    var st = setTimeout(function() { done(); }, 5000);
});


// use of listen and repeat together throws exception
//
test('listen/repeat conflict trapped', 4, function(assert){

    var done = assert.async();

    var fData = new FormData();
    fData.append('arg000', '1');

    var e = Rdbhost.reader()
        .query('SELECT %s AS a')
        .form_data(fData)
        .listen('abc')
        .repeat(2);

    ok(e, 'connection created');

    var p = e.get_data();
    ok(p.constructor.toString().indexOf('Promise') >= 0, 'promise is Promise');
    p.then(function(d) {
            ok(false, 'then called');
            clearTimeout(st);
            done();
        })
        .catch(function(e) {
            ok(true, 'then error called');
            ok(e.message.indexOf('listen and repeat cannot') >= 0, 'correct error message');
            clearTimeout(st);
            done();
        });

    var st = setTimeout(function() { done(); }, 5000);
});


// use of form_data and params together throws exception
//
test('params/formdata conflict trapped', 1, function() {

    var fData = new FormData();
    fData.append('arg000', '1');

    try {
        var p = Rdbhost.reader()
            .query('SELECT %s AS a')
            .form_data(fData)
            .params([1,2]);
    }
    catch(e) {

        ok(e.message.indexOf('params and FormData cannot be') >= 0, 'params/formdata conflict')
    }

});

// use of two objects to params throws exception
//
test('two objects to params conflict trapped', function() {

    var fData = new FormData();
    fData.append('arg000', '1');

    try {
        var p = Rdbhost.reader()
            .query('SELECT %s AS a')
            .params({a:1}, {b:2});
    }
    catch(e) {

        ok(e.message.indexOf('two objects were provided to p') >= 0, 'params args conflict '+ e.message);
    }

    try {
        var p1 = Rdbhost.reader()
            .query('SELECT %s AS a')
            .params([1], [2]);
    }
    catch(e) {

        ok(e.message.indexOf('two arrays were provided to p') >= 0, 'params args conflict '+ e.message);
    }

    try {
        var p2 = Rdbhost.reader()
            .query('SELECT %s AS a')
            .params([1], {b:2});
        ok(true, 'one of each is ok');

        ok(p2.namedParams, 'namedParams there');
        ok(p2.namedParams.b === 2, 'namedParams.b is correct');
        ok(p2.args, 'arg there');
        ok(p2.args[0] === 1, 'arg is correct');
    }
    catch(e) {

        ok(false, 'unexpected exceptions');
    }

});



module('CorsTest tests', {

    beforeEach: function () {
        var domain = privat.getItem('domain'),
            acct_number = privat.getItem('acct_number');
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

    var p = e.get_data();
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



/*
*
*/
