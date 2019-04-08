// heartrate.gs -- supports downloading heart rate data
// Intraday data access requires special permission from Fitbit

/*
* Do not change these key names. These are just keys to access these properties once you set them up by running the Setup function from the Fitbit menu
*/
// Key of ScriptProperty for Firtbit consumer key.
var CONSUMER_KEY_PROPERTY_NAME = "fitbitConsumerKey";
// Key of ScriptProperty for Fitbit consumer secret.
var CONSUMER_SECRET_PROPERTY_NAME = "fitbitConsumerSecret";

var SERVICE_IDENTIFIER = 'fitbit';
var GET_HEART_RATE_DATA = 1; // set this to 0 if you want to do step data instead


function onOpen() {
   
    SpreadsheetApp.getUi()
    .createMenu("Intraday Fitbit HeartRate")
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
    ScriptProperties.setProperty(CONSUMER_KEY_PROPERTY_NAME, key);
}

function getConsumerKey() {
    var key = ScriptProperties.getProperty(CONSUMER_KEY_PROPERTY_NAME);
    if (key == null) {
        key = "";
    }
    return key;
}

function setLoggables(loggable) {
    ScriptProperties.setProperty("loggables", loggable);
}

function getLoggables() {
    var loggable = ScriptProperties.getProperty("loggables");
    if (loggable == null) {
        loggable = LOGGABLES;
    } else {
        loggable = loggable.split(',');
    }
    return loggable;
}

function setConsumerSecret(secret) {
    ScriptProperties.setProperty(CONSUMER_SECRET_PROPERTY_NAME, secret);
}

function getConsumerSecret() {
    var secret = ScriptProperties.getProperty(CONSUMER_SECRET_PROPERTY_NAME);
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
    ScriptProperties.setProperty("firstDate", firstDate);
}

function getFirstDate() {
    var firstDate = ScriptProperties.getProperty("firstDate");
    if (firstDate == null) {
        firstDate = "2012-01-01";
    }
    return firstDate;
}

function setLastDate(lastDate) {
    ScriptProperties.setProperty("lastDate", lastDate);
}

function getLastDate() {
    var lastDate = ScriptProperties.getProperty("lastDate");
    if (lastDate == null) {
      var today = new Date();
      lastDate = Utilities.formatDate(new Date(), SpreadsheetApp.getActive().getSpreadsheetTimeZone(),"yyyy-mm-dd");
    }
    return lastDate;
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

      .setScope('activity heartrate profile')
      
      .setTokenHeaders({
        'Authorization': 'Basic ' + Utilities.base64Encode(getConsumerKey() + ':' + getConsumerSecret())
      });

}

function clearService(){
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

function getUser() {
  var service = getFitbitService();

  var options = {
          headers: {
      "Authorization": "Bearer " + service.getAccessToken(),
        "method": "GET"
          }};
  var response = UrlFetchApp.fetch("https://api.fitbit.com/1/user/-/profile.json",options);
  var o = JSON.parse(response.getContentText());
  return o.user;
}

function getIntradayActivity() {
  if (GET_HEART_RATE_DATA) {
    return ["activities-heart-intraday"];
  }
  else {
    return  ["activities-steps-intraday"];
  }
}

function getFetchString(dateString) {
  if (GET_HEART_RATE_DATA) {
    return "https://api.fitbit.com/1/user/-/activities/heart/date/"+dateString+"/1d/1sec/time/00:00/23:59.json";
  }
  else {
    return "https://api.fitbit.com/1/user/-/activities/steps/date/" + dateString+ "/" + dateString + ".json"
  }
}

function getActivity() {
  if (GET_HEART_RATE_DATA) {
    return ["activities/heart"];
  }
  else {
    return  ["activities/log/steps"];
  }
}
function refreshTimeSeries() {
  if (!isConfigured()) {
    setup();
    return;
  }
    var user = getUser();
    var doc = SpreadsheetApp.getActiveSpreadsheet();
    doc.getActiveSheet().clear();
    doc.setFrozenRows(2);
    // two header rows
    doc.getRange("a1").setValue(user.fullName);
    doc.getRange("a1").setComment("DOB:" + user.dateOfBirth)
    doc.getRange("b1").setValue(user.country + "/" + user.state + "/" + user.city);

    var options =
        {headers:{
        "Authorization": 'Bearer ' + getFitbitService().getAccessToken(),
        "method": "GET"
        }};
    	var activities = getActivity();
    	var intradays = getIntradayActivity();

	var lastIndex = 0;
    for (var activity in activities) {
    	var index = 0;
	 	var dateString = getFirstDate();
	 	date = parseDate(dateString);
        var table = new Array();
	    while (1) {
          var currentActivity = activities[activity];
          try {
            var result = UrlFetchApp.fetch(getFetchString(dateString), options);
          } catch(exception) {
            Logger.log(exception);
          }
          var o = JSON.parse(result.getContentText());

          var cell = doc.getRange('a3');
          var titleCell = doc.getRange("a2");
          titleCell.setValue("Date");
          var title = currentActivity.split("/");
          title = title[title.length - 1];
          titleCell.offset(0, 1 + activity * 1.0).setValue(title);
          var row = o[intradays[activity]]["dataset"];

          for (var j in row) {
            var val = row[j];
            var arr = new Array(2);
            arr[0] = dateString + ' ' + val["time"];
            arr[1] = val["value"];
            table.push(arr);
            // set the value index index
            index++;
          }

          date.setDate(date.getDate()+1);
          dateString = Utilities.formatDate(date, "GMT", "yyyy-MM-dd");
          if (dateString > getLastDate()) {
            break;
          }
        }
      
      Logger.log("Found " + table.length + " rows");
      if (table.length == 0) {
        SpreadsheetApp.getUi().alert('No data in the time range');
        return;
      }
      // Batch set values of table, much faster than doing each time per loop run, this wouldn't work as is if there were multiple activities being listed
      doc.getRange("A3:B"+(table.length+2)).setValues(table);
	}
}

// parse a date in yyyy-mm-dd format
function parseDate(input) {
  var parts = input.match(/(\d+)/g);
  // new Date(year, month [, date [, hours[, minutes[, seconds[, ms]]]]])
  return new Date(parts[0], parts[1]-1, parts[2]); // months are 0-based
}

// parse a date in 2011-10-25T23:57:00.000 format
function parseDate2(input) {
  var parts = input.match(/(\d+)/g);
  return new Date(parts[0], parts[1]-1, parts[2], parts[3], parts[4]);
}
