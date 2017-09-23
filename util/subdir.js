
  var $L = $LAB
      .script('//www.rdbhost.com/vendor/rdbhost/2.3/lib/js/util-bundle;rdbhost.js').wait(
          function() {

            if ( !Rdbhost.featuredetects.hasPromises() )
              $L = $L.script('//www.rdbhost.com/vendor/rdbhost/2.3/vendor/es6-promises/dist/es6-promise.js');
            if ( !Rdbhost.featuredetects.hasFetch() )
              $L = $L.script('//www.rdbhost.com/vendor/rdbhost/2.3/vendor/fetch/fetch.js').wait();
          }
      );


  function render_list(rows, container) {

    var templateContainer, templateRow, i0, prefix, path;

    prefix = path = '';

    templateContainer = container.getElementsByTagName('ul')[0];
    templateRow = templateContainer.getElementsByTagName('li')[0];
    templateContainer.removeChild(templateRow);

    var dirs = [], files = [], items;
     
    function sortf(a, b) {
       if (a.isdir && !b.isdir)
          return -1;
       if (b.isdir && !a.isdir)
          return 1;
       if (a.name < b.name)
          return -1;   
       return 1;   
    }
    rows.sort(sortf);

    _.each(rows, function(r) {

      if (r.name === '')
        return;
      if (r.isdir) {
        r.name = r.name + '/';
        dirfile = 'dir';
      }
      else {
        dirfile = 'file';
      }  

      i0 = templateRow.cloneNode(true);

      i0.innerHTML = templateRow.innerHTML.replace('{name}', r.name).replace('{link}', prefix + path + r.name)
                                          .replace('{cls}', dirfile);
      templateContainer.appendChild(i0);
    });
  }

  $L.wait(function() {
    var domn = {'dev3src.rdbhost.com': 'dev3.rdbhost.com',
                'devsrc.rdbhost.com': 'dev.rdbhost.com',
                'src.rdbhost.com': 'www.rdbhost.com'}[window.location.hostname] || window.location.hostname;
                  
  
    Rdbhost.connect(domn, 12);
    Rdbhost.inline_sql()
        .then(function(d) {
          var rows = d.result_sets ? d.result_sets[0].records.rows : d.records.rows;
          render_list(rows, document);
        })
  });

