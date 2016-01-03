

module('Notify tests', {

    setup: function () {
        Rdbhost.connect(domain, acct_number);
    },
    teardown: function() {
        Rdbhost.disconnect(1000, '');
    }
});




// send reader request with query, verify promise fulfilled
//
asyncTest('listen request ok', 4, function() {

    var e = Rdbhost.reader()
        .query('SELECT %s AS a')
        .params([1])
        .listen('abc');

    var p = e.go();
    ok(p.constructor.name === 'lib$es6$promise$promise$$Promise', p);
    p.then(function(d) {
            ok(true, 'then called');
            ok(d.result_sets.length == 1, 'result_sets len');
            ok(d.result_sets[0].records.rows[0].a == 1, 'column value === 1');
            clearTimeout(st);
            start();
      })
      .catch(function(e) {
            ok(false, 'then error called');
            clearTimeout(st);
            start();
      });

    var st = setTimeout(function() { start(); }, 1000);
});


// send reader listen request with query, verify promise fulfilled
//    and that notify is independently received
//
asyncTest('listen request receives ok', 7, function() {

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

    var p = r.go();
    ok(p.constructor.name === 'lib$es6$promise$promise$$Promise', p);
    p.then(function(d) {
            ok(true, 'then called');
            ok(d.result_sets.length == 1, 'result_sets len');
            ok(d.result_sets[0].row_count[0] == -1, 'row_count === 1');
            if ( notifyrecd ) {
                clearTimeout(st);
                start();
            }
        })
        .catch(function(e) {
            ok(false, 'then error called');
            clearTimeout(st);
            start();
        });

    var st = setTimeout(function() { start(); }, 1000);
});


// send reader listen request with query, verify promise fulfilled
//    and that notify is independently received
//
asyncTest('listen request invokes reloader on image', 8, function() {

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

    Rdbhost.once('notify-received:rdbhost_ftp_channel', function f(ch, pl) {
        ok(fail, 'notify-received should not be received');
    });
    Rdbhost.once('reload-request:rdbhost_ftp_channel', function f(ch, pl) {
        ok('event', 'notify event received');
        ok(ch === 'rdbhost_ftp_channel', 'channel is correct');
        ok(pl.substr(0,6) === 'SAVE F', 'payload is correct');
        notifyrecd = true;
        setTimeout(function() {
            var el1 = document.getElementById('test-image');
            ok(el1.src !== savedImgSrc, 'src '+el1.src);
        }, 10);
    });

    var r = Rdbhost.reader()
        .query("NOTIFY \"rdbhost_ftp_channel\", 'SAVE FILE /dummy.gif';")
        .listen('rdbhost_ftp_channel');

    function cleanup() {
        setTimeout(function() {
            clearTimeout(st);
            document.body.removeChild(el);
            start();
        }, 50)
    }

    var p = r.go();
    ok(p.constructor.name === 'lib$es6$promise$promise$$Promise', p);
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

    var st = setTimeout(function() { start(); }, 1000);
});



/*
*
*/
