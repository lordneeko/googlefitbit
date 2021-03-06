//--------
// intraday_all.gs -- Supports downloading all intraday data
// Currently fetches steps, floors, calories and heart rate
//
// Your google sheets must have one sheet that is called "Sheet1"
//
// Based on https://github.com/simonbromberg/googlefitbit intraday.gs
// Read instructions first on above URL
//
// Change activities if you want more stuff
// The heart rate activity always needs to be last!
var activities = ["activities/steps", "activities/calories", "activities/floors", "activities/distance", "activities/heart"];

// Set the sheet name where data will be downloaded. Nothing else should be in this sheet

var mySheetName = "Sheet1";

// If you want want to filter out empty rows from the data, set this to true. If heartrate and steps is zero, the row is considered empty.

var filterEmptyRows = true;


/*
 * Do not change these key names. These are just keys to access these properties once you set them up by running the Setup function from the Fitbit menu
 */
// Key of userProperties for Firtbit consumer key.
var CONSUMER_KEY_PROPERTY_NAME = "fitbitConsumerKey";
// Key of userProperties for Fitbit consumer secret.
var CONSUMER_SECRET_PROPERTY_NAME = "fitbitConsumerSecret";

var SERVICE_IDENTIFIER = 'fitbit';

var userProperties = PropertiesService.getUserProperties();

function onOpen() {
   
    SpreadsheetApp.getUi()
    .createMenu("Intraday Fitbit")
    .addItem('Setup','setup')
    .addItem('Authorize', 'showSidebar')
    .addItem('Reset', 'clearService')
    .addItem("Download data", 'refreshTimeSeries')
    .addToUi();
   
}


function isConfigured() {
    return getConsumerKey() != "" && getConsumerSecret() != "";
}

function setConsumerKey(key) {
    userProperties.setProperty(CONSUMER_KEY_PROPERTY_NAME, key);
}

function getConsumerKey() {
    var key = userProperties.getProperty(CONSUMER_KEY_PROPERTY_NAME);
    if (key == null) {
        key = "";
    }
    return key;
}

function setLoggables(loggable) {
    userProperties.setProperty("loggables", loggable);
}

function getLoggables() {
    var loggable = userProperties.getProperty("loggables");
    if (loggable == null) {
        loggable = LOGGABLES;
    } else {
        loggable = loggable.split(',');
    }
    return loggable;
}

function setConsumerSecret(secret) {
    userProperties.setProperty(CONSUMER_SECRET_PROPERTY_NAME, secret);
}

function getConsumerSecret() {
    var secret = userProperties.getProperty(CONSUMER_SECRET_PROPERTY_NAME);
    if (secret == null) {
        secret = "";
    }
    return secret;
}

function getProjectKey() {
  return ScriptApp.getProjectKey();
}

// function saveSetup saves the setup params from the UI
function saveSetup(e) {
      
    setConsumerKey(e.consumerKey);
    setConsumerSecret(e.consumerSecret);
    setLoggables(e.loggables);
    setFirstDate(e.firstDate);
    
}

function setFirstDate(firstDate) {
    userProperties.setProperty("firstDate", firstDate);
}

function getFirstDate() {
    var firstDate = userProperties.getProperty("firstDate");
    if (firstDate == null) {
        firstDate = "today";
    }
    return firstDate;
}



// function setup accepts and stores the Consumer Key, Consumer Secret, Project Key, firstDate, and list of Data Elements
function setup() {
    
  var html = HtmlService.createHtmlOutputFromFile('Setup').setHeight(1200);
     
    SpreadsheetApp.getUi()
        .showModalDialog(html, 'Setup');
}
function getFitbitService() {
    // Create a new service with the given name. The name will be used when
    // persisting the authorized token, so ensure it is unique within the
    // scope of the property store
    Logger.log(PropertiesService.getUserProperties());
    return OAuth2.createService(SERVICE_IDENTIFIER)

        // Set the endpoint URLs, which are the same for all Google services.
        .setAuthorizationBaseUrl('https://www.fitbit.com/oauth2/authorize')
        .setTokenUrl('https://api.fitbit.com/oauth2/token')

        // Set the client ID and secret, from the Google Developers Console.
        .setClientId(getConsumerKey())
        .setClientSecret(getConsumerSecret())

        // Set the name of the callback function in the script referenced
        // above that should be invoked to complete the OAuth flow.
        .setCallbackFunction('authCallback')

        // Set the property store where authorized tokens should be persisted.
        .setPropertyStore(PropertiesService.getUserProperties())

        .setScope('activity profile heartrate nutrition weight')

        .setTokenHeaders({
            'Authorization': 'Basic ' + Utilities.base64Encode(getConsumerKey() + ':' + getConsumerSecret())
        });

}

function clearService() {
    OAuth2.createService(SERVICE_IDENTIFIER)
        .setPropertyStore(PropertiesService.getUserProperties())
        .reset();
}

function showSidebar() {
    var service = getFitbitService();
    if (!service.hasAccess()) {
        var authorizationUrl = service.getAuthorizationUrl();
        var template = HtmlService.createTemplate(
            '<a href="<?= authorizationUrl ?>" target="_blank">Authorize</a>. ' +
            'Reopen the sidebar when the authorization is complete.');
        template.authorizationUrl = authorizationUrl;
        var page = template.evaluate();
        SpreadsheetApp.getUi().showSidebar(page);
    } else {
        Logger.log("Has access!!!!");
    }
}

function authCallback(request) {
    Logger.log("authcallback");
    var service = getFitbitService();
    var isAuthorized = service.handleCallback(request);
    if (isAuthorized) {
        Logger.log("success");
        return HtmlService.createHtmlOutput('Success! You can close this tab.');
    } else {
        Logger.log("denied");
        return HtmlService.createHtmlOutput('Denied. You can close this tab');
    }
}

function refreshTimeSeries() {
    if (!isConfigured()) {
        setup();
        return;
    }

    var doc = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = doc.getSheetByName(mySheetName);
    var lastrow = sheet.getMaxRows();
    sheet.clear();
    if (lastrow > 3) { sheet.deleteRows(2, lastrow -2); }
    sheet.setFrozenRows(1);

    var options = {
        headers: {
            "Authorization": 'Bearer ' + getFitbitService().getAccessToken(),
            "method": "GET"
        }
    };

    var table = {};

    var titleCell = sheet.getRange("a1");
    titleCell.setValue("Time");

    for (var activity in activities) {

        var dateString = getFirstDate();

        var currentActivity = activities[activity];
        if (currentActivity == "activities/steps") {
            var stepsColumn = parseInt(activity) + 1;
        }
        try {
            if (currentActivity == 'activities/heart') {
                var heartColumn = parseInt(activity) + 1;
                var result = UrlFetchApp.fetch("https://api.fitbit.com/1/user/-/activities/heart/date/" + dateString + "/1d/1min.json", options);
            } else {
                var result = UrlFetchApp.fetch("https://api.fitbit.com/1/user/-/" + currentActivity + "/date/" + dateString + "/1d.json", options);
            }
        } catch (exception) {
            Logger.log(exception);
        }
        var o = JSON.parse(result.getContentText());
        //Logger.log(result.getContentText())

        var title = currentActivity.split("/")[1];
        titleCell.offset(0, 1 + parseInt(activity)).setValue(title);
        var intradaysfield = "activities-" + title + "-intraday"
        var row = o[intradaysfield]["dataset"];

        for (var j in row) {
            var val = row[j];

            index = val["time"];
            if (table[index] instanceof Array) {} else {
                table[index] = new Array()
            }
            table[index][0] = val["time"];
            table[index].push(val["value"])

        }


    }
    var al = activities.length + 1

    //Pad the array - setValues needs a value in each field
    Object.keys(table).forEach(function(key) {
        var tl = table[key].length
        if (tl < al) {
            table[key].push(0)
        }

    });

    //Convert the object to an array - setValues needs an array
    var tablearray = Object.keys(table).map(function(key) {
        return table[key];
    })
    
    if (filterEmptyRows) {
      tablearray = tablearray.filter(function(currarr) { 
              return (currarr[heartColumn] > 0 || currarr[stepsColumn] > 0);
       });
    }


    var range = "R2C1:R" + (tablearray.length + 1) + "C" + al
    if (tablearray[1]) {
      sheet.getRange(range).setValues(tablearray);
    } else {
       SpreadsheetApp.getUi().alert('No data found for chosen day: '+dateString);
    }
}
