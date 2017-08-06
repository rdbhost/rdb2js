
var demo_pass, demo_email, acct_number, domain,
    SUPER_AUTH = undefined, PASSWORD = undefined;

function fake_results_promise() {
    return Promise.resolve({});
}
function MockReader(retObj) {

    retObj = retObj || {};

    function rdgw(json_getter, auth_cache) {
        var this_ = this;
        retObj.json = json_getter.call(this_, auth_cache);

        return fake_results_promise();
    }
    function rdgh(data_extractor, auth_cache) {
        var this_ = this,
            url_formdata = data_extractor.call(this_, auth_cache),
            url = url_formdata[0],
            formData = url_formdata[1];
        retObj.url = url;
        retObj.formData = formData;

        return fake_results_promise();
    }

    return function() {
        return Rdbhost.reader(rdgw, rdgh);
    }
}


module('Notify tests', {

    setup: function (assert) {
        var done = assert.async();

        domain = privat.getItem('domain');
        acct_number = parseInt(privat.getItem('acct_number'), 10);
        demo_email = privat.getItem('demo_email');
        demo_pass = privat.getItem('demo_pass');

        function _t() {
            Rdbhost.paranoid_confirm = false;
            Rdbhost.connect(domain, acct_number);
            var pr = Rdbhost.activate_reloader(Rdbhost.reader());
            pr.then(done);
        }
        Rdbhost.reset_rdbhost(_t, 'clean');
    },
    teardown: function(assert) {
        var done = assert.async();

        Rdbhost.disconnect(1000, '');
        setTimeout(function() {
            done();
        }, 500);
    }
});


// send reader request with query, verify promise fulfilled
//
test('listen request ok', 4, function(assert){

    var done = assert.async();

    var e = Rdbhost.reader()
        .query('SELECT %s AS a')
        .params([1])
        .listen('abc');

    var p = e.get_data();
    ok(p.constructor.toString().indexOf('Promise') >= 0, 'promise is object');
    p.then(function(d) {
            ok(true, 'then called');
            ok(d.result_sets.length == 1, 'result_sets len');
            ok(d.result_sets[0].records.rows[0].a == 1, 'column value === 1');
            clearTimeout(st);
            done();
      })
      .catch(function(e) {
            ok(false, 'then error called '+e.message);
            clearTimeout(st);
            done();
      });

    var st = setTimeout(function() { done(); }, 1000);
});


// send reader listen request with query, verify promise fulfilled
//    and that notify is independently received
//
test('listen request receives ok', 7, function(assert){

    var done = assert.async();
    var notifyrecd = false;

    Rdbhost.once('notify-received:abc', function f(ch, pl) {
        ok('event', 'notify event received');
        ok(ch === 'abc', 'channel is correct');
        ok(pl.substr(0,6) === 'test m', 'payload is correct');
        notifyrecd = true;
    });

    var r = Rdbhost.reader()
        .query("NOTIFY \"abc\", 'test message on channel abc';")
        .listen('abc');

    var p = r.get_data();
    ok(p.constructor.toString().indexOf('Promise') >= 0, 'promise is object');
    p.then(function(d) {
            ok(true, 'then called');
            ok(d.result_sets.length == 1, 'result_sets len');
            ok(d.result_sets[0].row_count[0] == -1, 'row_count === 1');
            if ( notifyrecd ) {
                clearTimeout(st);
                done();
            }
        })
        .catch(function(e) {
            ok(false, 'then error called');
            clearTimeout(st);
            done();
        });

    var st = setTimeout(function() { done(); }, 1000);
});


// send reader listen request with broadcast, verify promise fulfilled (with -1 results)
//    and that notify is independently received
//
test('listen request receives broadcast ok', 7, function(assert){

    var done = assert.async();
    var notifyrecd = false;

    Rdbhost.once('notify-received:abc', function f(ch, pl) {
        ok('event', 'notify event received');
        ok(ch === 'abc', 'channel is correct');
        ok(pl.substr(0,6) === 'test b', 'payload is correct');
        notifyrecd = true;
    });

    var ret = {};
    var r = Rdbhost.reader() // MockReader(ret)()
        // .query("NOTIFY \"abc\", 'test message on channel abc';")
        .broadcast('abc', 'test broadcast')
        .listen('abc');

    var p = r.get_data();

    ok(p.constructor.toString().indexOf('Promise') >= 0, 'promise is object');
    p.then(function(d) {
        ok(true, 'then called');
        ok(d.result_sets.length == 1, 'result_sets len');
        ok(d.result_sets[0].row_count[0] == -1, 'row_count === 1');
        if ( notifyrecd ) {
            clearTimeout(st);
            done();
        }
    })
        .catch(function(e) {
            ok(false, 'then error called '+e.message);
            clearTimeout(st);
            done();
        });

    var st = setTimeout(function() { done(); }, 1000);
});


// send reader listen request with broadcast and query, verify promise fulfilled (with -1 results)
//    and that notify is independently received
//
test('listen request receives broadcast and results', 8, function(assert){

    var done = assert.async();
    var notifyrecd = false;

    Rdbhost.once('notify-received:abc', function f(ch, pl) {
        ok('event', 'notify event received');
        ok(ch === 'abc', 'channel is correct');
        ok(pl.substr(0,6) === 'test b', 'payload is correct');
        notifyrecd = true;
    });

    var ret = {};
    var r = Rdbhost.reader() // MockReader(ret)()
        .broadcast('abc', 'test broadcast')
        .listen('abc')
        .query("SELECT 'wonderful';");

    var p = r.get_data();

    ok(p.constructor.toString().indexOf('Promise') >= 0, 'promise is object');
    p.then(function(d) {
        ok(true, 'then called');
        ok(d.result_sets.length == 2, 'result_sets len');
        ok(d.result_sets[0].row_count[0] == 1, 'row_count[0] === 1');
        ok(d.result_sets[1].row_count[0] == -1, 'row_count[1] === -1');
        if ( notifyrecd ) {
            clearTimeout(st);
            done();
        }
    })
        .catch(function(e) {
            ok(false, 'then error called '+e.message);
            clearTimeout(st);
            done();
        });

    var st = setTimeout(function() { done(); }, 1000);
});


// send super listen request with query, verify promise fulfilled
//    and that notify is independently received
//
test('listen request invokes reloader on image', 8, function(assert){

    var done = assert.async();
    var notifyrecd = false;

    // add a (nonexistant) image tag to page
    var el = document.createElement('img'),
        src = document.createAttribute('src'),
        id = document.createAttribute('id');
    src.value = '/dummy.gif';
    id.value = 'test-image';
    el.setAttributeNode(src);
    el.setAttributeNode(id);
    document.body.appendChild(el);
    var savedImgSrc = el.src;

    Rdbhost.once('notify-received:rdbhost_ftp_channel:super', function f(ch, pl) {
        ok(false, 'notify-received should not be received');
    });
    Rdbhost.once('reload-request', function f(ch, pl) {
        ok('event', 'notify event received');
        ok(ch === 'rdbhost_ftp_channel:super', 'channel is correct');
        ok(pl.substr(0,6) === 'SAVE F', 'payload is correct');
        notifyrecd = true;
        setTimeout(function() {
            var el1 = document.getElementById('test-image');
            ok(el1.src !== savedImgSrc, 'src '+el1.src);
        }, 20);
    });

    var r = Rdbhost.super()
        .query("NOTIFY \"rdbhost_ftp_channel:super\", 'SAVE FILE /dummy.gif';")
        .listen('rdbhost_ftp_channel:super');

    function cleanup() {
        setTimeout(function() {
            clearTimeout(st);
            clearTimeout(st1);
            document.body.removeChild(el);
            done();
        }, 50)
    }

    var p = r.get_data();
    ok(p.constructor.toString().indexOf('Promise') >= 0, 'promise is object');
    p.then(function(d) {
            ok(true, 'then called');
            ok(d.result_sets.length == 1, 'result_sets len');
            ok(d.result_sets[0].row_count[0] == -1, 'row_count === 1');
            if ( notifyrecd ) {
                cleanup();
            }
        })
        .catch(function(e) {
            ok(false, 'then error called');
            cleanup();
        });

    var st1 = setTimeout(function() {
        var frm = document.getElementById('partial-super-auth'),
            eml = frm.querySelector("input[name='email']"),
            pw = frm.querySelector("input[name='password']"),
            sub = frm.querySelector("input[type='submit']");

        eml.value = demo_email;
        pw.value = privat.getItem('demo_pass');
        sub.click();
    }, 1500);

    var st = setTimeout(function() { done(); }, 11000);
});


// send reader listen request with preauth query, verify promise fulfilled
//    but no notifies received
//
test('listen request ignored from wrong role', 4, function(assert){

    var done = assert.async();

    // add a (nonexistant) image tag to page
    var el = document.createElement('img'),
        src = document.createAttribute('src'),
        id = document.createAttribute('id');
    src.value = '/dummy.gif';
    id.value = 'test-image';
    el.setAttributeNode(src);
    el.setAttributeNode(id);
    document.body.appendChild(el);
    var savedImgSrc = el.src;

    function cleanup() {
        setTimeout(function() {
            clearTimeout(st);
            document.body.removeChild(el);
            done();
        }, 50)
    }

    Rdbhost.once('notify-received:rdbhost_ftp_channel:reader', function f(ch, pl) {
        ok(false, 'notify-received should not be received');
    });

    var r = Rdbhost.preauth()
        .query("NOTIFY \"rdbhost_ftp_channel:reader\", 'SAVE FILE /dummy.gif';")
        .listen('rdbhost_ftp_channel:reader');

    var p = r.get_data();
    ok(p.constructor.toString().indexOf('Promise') >= 0, 'promise is object');
    p.then(function(d) {
            ok(true, 'then called');
            ok(d.result_sets.length == 1, 'result_sets len');
            ok(d.result_sets[0].row_count[0] == -1, 'row_count === 1');
        })
        .catch(function(e) {
            ok(false, 'then error called');
        });

    setTimeout(function() {
        var frm = document.getElementById('partial-preauth-auth');
        if ( !frm )
            return;

        var eml = frm.querySelector("input[name='email']"),
            pw = frm.querySelector("input[name='password']"),
            sub = frm.querySelector("input[type='submit']");

        eml.value = demo_email;
        pw.value = privat.getItem('demo_pass');
        sub.click();
    }, 500);

    var st = setTimeout(function() {
        cleanup();
    }, 1000);
});


// verify that reloader filters pages
//   should not reload page
//
test('listen reloader filters on paths', 7, function(assert){

    var done = assert.async();
    var notifyrecd = false;

    Rdbhost.once('notify-received:rdbhost_ftp_channel:reader', function f(ch, pl) {
        ok(fail, 'notify-received should not be received');
    });
    Rdbhost.once('reload-request:rdbhost_ftp_channel:reader', function f(ch, pl) {
        ok('event', 'notify event received');
        ok(ch === 'rdbhost_ftp_channel:reader', 'channel is correct');
        ok(pl.substr(0,6) === 'SAVE F', 'payload is correct');
        notifyrecd = true;
    });

    var r = Rdbhost.reader()
        .query("NOTIFY \"rdbhost_ftp_channel:reader\", 'SAVE FILE /in.html';")
        .listen('rdbhost_ftp_channel:reader');

    function cleanup() {
        setTimeout(function() {
            clearTimeout(st);
            done();
        }, 50)
    }

    var p = r.get_data();
    ok(p.constructor.toString().indexOf('Promise') >= 0, 'promise is object');
    p.then(function(d) {
            ok(true, 'then called');
            ok(d.result_sets.length == 1, 'result_sets len');
            ok(d.result_sets[0].row_count[0] == -1, 'row_count === 1');
            if ( notifyrecd ) {
                cleanup();
            }
        })
        .catch(function(e) {
            ok(false, 'then error called');
            cleanup();
        });

    var st = setTimeout(function() { done(); }, 1000);
});


// check that listen is applied independently of query in
//    cloned queries
//
test('listen request receives w cloning', 12, function(assert){

    var done = assert.async();
    var notifyrecd = 0;

    Rdbhost.on('notify-received:abc', function f(ch, pl) {
        ok('event', 'notify event received');
        ok(ch === 'abc', 'channel is correct');
        if (pl.substr(0,8) === 'test mes')
            ok(true, 'payload 1 is correct');
        if (pl.substr(0,8) === 'another ')
            ok(true, 'payload 2 is correct');
        notifyrecd = notifyrecd + 1;
    });

    var r1 = Rdbhost.reader()
        .query("NOTIFY \"abc\", 'test message on channel abc';")
        .listen('abc');

    var r2 = r1.clone()
        .query("NOTIFY \"abc\", 'another test msg on ';");

    var p1 = r1.get_data();
    ok(p1.constructor.toString().indexOf('Promise') >= 0, 'promise is object');
    p1.then(function(d) {
            // ok(true, 'then called');
            ok(d.result_sets.length == 1, 'result_sets len');
            ok(d.result_sets[0].row_count[0] == -1, 'row_count === 1');
            if ( notifyrecd > 1 ) {
                clearTimeout(st);
                Rdbhost.off('notify-received:abc');
                done();
            }
        })
        .catch(function(e) {
            ok(false, 'then error called');
            clearTimeout(st);
            done();
        });

    var p2 = r2.get_data();
    ok(p2.constructor.toString().indexOf('Promise') >= 0, 'promise is object');
    p2.then(function(d) {
            // ok(true, 'then called');
            ok(d.result_sets.length == 1, 'result_sets len');
            ok(d.result_sets[0].row_count[0] == -1, 'row_count === 1');
            if ( notifyrecd > 1 ) {
                clearTimeout(st);
                Rdbhost.off('notify-received:abc');
                done();
            }
        })
        .catch(function(e) {
            ok(false, 'then error called');
            clearTimeout(st);
            done();
        });

    var st = setTimeout(function() {
        Rdbhost.off('notify-received:abc');
        done();
    }, 1000);
});


/*

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
        .query('SELECT 1 AS a; /!* testing-delete *!/');

    var p = e.get_data();
    ok(p.constructor.toString().indexOf('Promise') >= 0, p);
    p.then(function(d) {
            ok(false, 'then called');
            clearTimeout(st);
            done();
        })
        .catch(function(e) {
            ok(true, 'then error called');
            ok(e.message.substr(0, 11) === 'Failed to f', e.message);
            clearTimeout(st);
            done();
        });

    Rdbhost.once('connection-open-failed', function(evt) {
        ok(true, 'connection-open-failed event emitted');
    });

    var st = setTimeout(function() {
        done();
    }, 50000);
});


*/

/*
*
*/
