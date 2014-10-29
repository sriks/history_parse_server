
var engine = require('cloud/controllers/engine.js')

/*
Test method
*/
Parse.Cloud.define("test", function(request, response) {
   engine.fetchToday(null, function(err, result) {
       response.success(result);      
   });
});

Parse.Cloud.job("fetchtoday", function(request, status) {
    engine.fetchToday(null, function(err, result) {
        if(err)
            status.error(JSON.stringify(err));
        else
            status.success(JSON.stringify(result));    
    });
});

